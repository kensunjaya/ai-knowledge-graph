"""
Incremental knowledge graph update pipeline.

Orchestrates the ADD-only incremental update: loads an existing JSON KG,
processes new text to extract candidate triples, resolves entities against
the existing KG, reconciles triples, and produces an updated KG.
"""
import argparse
import json
import os
import sys
import time

# Add the parent directory to the Python path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from src.knowledge_graph.config import load_config
from src.knowledge_graph.text_utils import chunk_text
from src.knowledge_graph.main import process_with_llm
from src.knowledge_graph.entity_standardization import standardize_entities, limit_predicate_length
from src.knowledge_graph.entity_resolution import resolve_entities
from src.knowledge_graph.reconciliation import reconcile_triples, apply_changeset, print_changeset_summary
from src.knowledge_graph.visualization import visualize_knowledge_graph


# ---------------------------------------------------------------------------
# Step 1 — Load and validate the existing KG
# ---------------------------------------------------------------------------

def load_existing_kg(graph_path):
    """
    Load and validate an existing JSON knowledge graph.

    Validates:
    - File exists
    - Valid JSON
    - Top-level structure is a list
    - Triples contain required fields (subject, predicate, object)
    - Malformed records are reported clearly

    Args:
        graph_path: Path to the existing JSON KG file

    Returns:
        List of validated triple dicts

    Raises:
        SystemExit on fatal validation errors
    """
    if not os.path.exists(graph_path):
        print(f"Error: Graph file not found: {graph_path}")
        sys.exit(1)

    try:
        with open(graph_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in graph file {graph_path}: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Error: Could not read graph file {graph_path}: {e}")
        sys.exit(1)

    if not isinstance(data, list):
        print(f"Error: Expected a JSON array of triples, got {type(data).__name__}")
        sys.exit(1)

    # Validate individual triples
    valid_triples = []
    malformed_count = 0

    for i, item in enumerate(data):
        if not isinstance(item, dict):
            malformed_count += 1
            print(f"  Warning: Item {i} is not a dict, skipping")
            continue

        subj = item.get("subject")
        pred = item.get("predicate")
        obj = item.get("object")

        if (
            isinstance(subj, str) and subj.strip()
            and isinstance(pred, str) and pred.strip()
            and isinstance(obj, str) and obj.strip()
        ):
            valid_triples.append(item)
        else:
            malformed_count += 1
            print(f"  Warning: Malformed triple at index {i}: {item}")

    if malformed_count > 0:
        print(f"  Filtered out {malformed_count} malformed records from existing KG")

    print(f"Loaded existing KG: {len(valid_triples)} valid triples from {graph_path}")
    return valid_triples


# ---------------------------------------------------------------------------
# Steps 3-5 — Process new text: chunk, extract, standardize
# ---------------------------------------------------------------------------

def extract_candidate_fragment(config, new_text, debug=False):
    """
    Process new raw text through chunking, SPO extraction, and entity
    standardization to produce a candidate KG fragment.

    Reuses existing pipeline functions without modification.

    Args:
        config: Configuration dictionary
        new_text: The new raw text to process
        debug: If True, print detailed debug information

    Returns:
        List of standardized candidate triple dicts
    """
    # Step 3 — Chunk the new text
    chunk_size = config.get("chunking", {}).get("chunk_size", 500)
    overlap = config.get("chunking", {}).get("overlap", 50)
    text_chunks = chunk_text(new_text, chunk_size, overlap)

    print("\n" + "=" * 50)
    print("STEP 3: CHUNKING NEW TEXT")
    print("=" * 50)
    print(f"Processing new text in {len(text_chunks)} chunks "
          f"(size: {chunk_size} words, overlap: {overlap} words)")

    # Step 4 — RDF/SPO extraction via LLM
    print("\n" + "=" * 50)
    print("STEP 4: SPO EXTRACTION")
    print("=" * 50)

    all_triples = []
    for i, chunk in enumerate(text_chunks):
        print(f"Processing chunk {i + 1}/{len(text_chunks)} ({len(chunk.split())} words)")
        chunk_results = process_with_llm(config, chunk, debug)
        time.sleep(5)

        if chunk_results:
            for item in chunk_results:
                item["chunk"] = i + 1
            all_triples.extend(chunk_results)
        else:
            print(f"  Warning: Failed to extract triples from chunk {i + 1}")

    print(f"\nExtracted {len(all_triples)} raw triples from new text")

    if not all_triples:
        return []

    # Filter malformed triples (null subject/predicate/object)
    valid_triples = []
    filtered_count = 0
    for triple in all_triples:
        if not isinstance(triple, dict):
            filtered_count += 1
            continue
        subj = triple.get("subject")
        pred = triple.get("predicate")
        obj = triple.get("object")
        if (
            isinstance(subj, str) and subj.strip()
            and isinstance(pred, str) and pred.strip()
            and isinstance(obj, str) and obj.strip()
        ):
            valid_triples.append(triple)
        else:
            filtered_count += 1

    if filtered_count > 0:
        print(f"Filtered out {filtered_count} malformed triples")

    if not valid_triples:
        print("No valid triples extracted from new text")
        return []

    # Apply predicate length limit
    for triple in valid_triples:
        triple["predicate"] = limit_predicate_length(triple["predicate"])

    # Step 5 — Entity standardization (intra-batch only)
    if config.get("standardization", {}).get("enabled", False):
        print("\n" + "=" * 50)
        print("STEP 5: ENTITY STANDARDIZATION (INTRA-BATCH)")
        print("=" * 50)
        valid_triples = standardize_entities(valid_triples, config)

    print(f"\nCandidate KG fragment: {len(valid_triples)} triples")
    return valid_triples


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def main():
    """Main entry point for the incremental knowledge graph updater."""
    parser = argparse.ArgumentParser(
        description="Incremental Knowledge Graph Updater (ADD-only)"
    )
    parser.add_argument(
        "--graph", type=str, required=True,
        help="Path to the existing JSON knowledge graph"
    )
    parser.add_argument(
        "--input", type=str, required=True,
        help="Path to the new raw text file containing additional information"
    )
    parser.add_argument(
        "--output", type=str, required=True,
        help="Path to write the updated JSON knowledge graph"
    )
    parser.add_argument(
        "--html-output", type=str, default=None,
        help="Path to write the updated HTML visualization (optional)"
    )
    parser.add_argument(
        "--config", type=str, default="config.toml",
        help="Path to configuration file"
    )
    parser.add_argument(
        "--debug", action="store_true",
        help="Enable debug output (raw LLM responses and detailed resolution info)"
    )
    parser.add_argument(
        "--no-standardize", action="store_true",
        help="Disable entity standardization for the new text"
    )

    args = parser.parse_args()

    # --- Load configuration ---
    config = load_config(args.config)
    if not config:
        print(f"Failed to load configuration from {args.config}. Exiting.")
        sys.exit(1)

    # Override config with CLI flags
    if args.no_standardize:
        config.setdefault("standardization", {})["enabled"] = False

    print("=" * 50)
    print("INCREMENTAL KNOWLEDGE GRAPH UPDATE (ADD-ONLY)")
    print("=" * 50)

    # --- Step 1: Load existing KG ---
    print("\n" + "=" * 50)
    print("STEP 1: LOAD EXISTING KG")
    print("=" * 50)
    existing_triples = load_existing_kg(args.graph)

    # --- Step 2: Load new text ---
    print("\n" + "=" * 50)
    print("STEP 2: LOAD NEW TEXT")
    print("=" * 50)
    try:
        with open(args.input, "r", encoding="utf-8") as f:
            new_text = f.read()
        print(f"Loaded new text from: {args.input} ({len(new_text.split())} words)")
    except Exception as e:
        print(f"Error reading input file {args.input}: {e}")
        sys.exit(1)

    # --- Steps 3-5: Extract candidate fragment ---
    candidate_triples = extract_candidate_fragment(config, new_text, args.debug)

    if not candidate_triples:
        print("\nNo candidate triples produced. Nothing to update.")
        sys.exit(0)

    # --- Step 6: Entity resolution against existing KG ---
    print("\n" + "=" * 50)
    print("STEP 6: ENTITY RESOLUTION AGAINST EXISTING KG")
    print("=" * 50)
    resolved_triples, entity_mapping = resolve_entities(
        candidate_triples, existing_triples, config=config, debug=args.debug
    )

    if args.debug and resolved_triples:
        print("\nResolved candidate fragment:")
        for t in resolved_triples[:10]:
            print(f"  {t.get('subject', '')} → {t.get('predicate', '')} → {t.get('object', '')}")
        if len(resolved_triples) > 10:
            print(f"  ... and {len(resolved_triples) - 10} more")

    # --- Step 7-8: Triple reconciliation + changeset ---
    print("\n" + "=" * 50)
    print("STEP 7-8: TRIPLE RECONCILIATION")
    print("=" * 50)
    changeset = reconcile_triples(resolved_triples, existing_triples)
    print_changeset_summary(changeset)

    # --- Step 9: Apply changeset ---
    updated_triples = apply_changeset(existing_triples, changeset)

    # --- Step 10: Save updated KG ---
    print("\n" + "=" * 50)
    print("STEP 10: SAVE UPDATED KG")
    print("=" * 50)
    try:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(updated_triples, f, indent=2)
        print(f"Updated knowledge graph saved to: {args.output}")
        print(f"Total triples: {len(updated_triples)} "
              f"(was {len(existing_triples)}, added {len(changeset.get('add', []))})")
    except Exception as e:
        print(f"Error saving updated KG to {args.output}: {e}")
        sys.exit(1)

    # --- Step 11: Visualization (optional) ---
    if args.html_output:
        print("\n" + "=" * 50)
        print("STEP 11: VISUALIZATION")
        print("=" * 50)
        try:
            stats = visualize_knowledge_graph(updated_triples, args.html_output, config=config)
            print(f"HTML visualization saved to: {args.html_output}")
            print(f"  Nodes: {stats['nodes']}")
            print(f"  Edges: {stats['edges']}")
            print(f"  Communities: {stats['communities']}")
        except Exception as e:
            print(f"Warning: Could not generate HTML visualization: {e}")

    print("\nIncremental update complete.")
