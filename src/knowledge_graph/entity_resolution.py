"""
Entity resolution for incremental knowledge graph updates.

Maps candidate entities from newly extracted triples to canonical entities
already present in an existing knowledge graph.
"""
import re
from collections import defaultdict


def resolve_entities(candidate_triples, existing_triples, config=None, debug=False):
    """
    Resolve candidate entities against canonical entities in the existing KG.

    Uses a deterministic-first approach:
    1. Exact match
    2. Case-insensitive match
    3. Substring/containment match (conservative)
    4. Optional LLM fallback for ambiguous cases

    Args:
        candidate_triples: List of newly extracted triple dicts
        existing_triples: List of triple dicts from the existing KG
        config: Configuration dictionary (optional, needed for LLM fallback)
        debug: If True, print detailed resolution information

    Returns:
        Tuple of (resolved_triples, entity_mapping) where:
        - resolved_triples: candidate triples with entities mapped to canonical forms
        - entity_mapping: dict mapping candidate entity -> canonical entity
    """
    if not candidate_triples:
        return [], {}

    # Build set of canonical entities from existing KG
    existing_entities = set()
    for triple in existing_triples:
        if isinstance(triple, dict):
            if "subject" in triple and triple["subject"]:
                existing_entities.add(triple["subject"])
            if "object" in triple and triple["object"]:
                existing_entities.add(triple["object"])

    # Build set of candidate entities
    candidate_entities = set()
    for triple in candidate_triples:
        if isinstance(triple, dict):
            if "subject" in triple and triple["subject"]:
                candidate_entities.add(triple["subject"])
            if "object" in triple and triple["object"]:
                candidate_entities.add(triple["object"])

    if debug:
        print(f"  Existing entities: {len(existing_entities)}")
        print(f"  Candidate entities: {len(candidate_entities)}")

    # Build entity mapping using deterministic methods first
    entity_mapping = {}

    # Pass 1: Exact match
    for candidate in candidate_entities:
        if candidate in existing_entities:
            entity_mapping[candidate] = candidate

    # Pass 2: Case-insensitive match
    existing_lower_map = {}
    for entity in existing_entities:
        key = entity.lower().strip()
        # Prefer the longest canonical form if multiple exist
        if key not in existing_lower_map or len(entity) > len(existing_lower_map[key]):
            existing_lower_map[key] = entity

    for candidate in candidate_entities:
        if candidate in entity_mapping:
            continue
        key = candidate.lower().strip()
        if key in existing_lower_map:
            entity_mapping[candidate] = existing_lower_map[key]

    # Pass 3: Substring/containment match (conservative)
    unresolved = [c for c in candidate_entities if c not in entity_mapping]
    if unresolved:
        containment_matches = _find_containment_matches(unresolved, existing_entities)
        entity_mapping.update(containment_matches)

    # Pass 4: Optional LLM fallback for remaining unresolved entities
    unresolved = [c for c in candidate_entities if c not in entity_mapping]
    if unresolved and config and config.get("standardization", {}).get("use_llm_for_entities", False):
        llm_matches = _resolve_with_llm(unresolved, existing_entities, config)
        entity_mapping.update(llm_matches)

    # Report resolution results
    resolved_count = len(entity_mapping)
    new_count = len(candidate_entities) - resolved_count
    if debug or resolved_count > 0:
        print(f"  Entity resolution: {resolved_count} mapped to existing, {new_count} new entities")
        for candidate, canonical in sorted(entity_mapping.items()):
            if candidate != canonical:
                print(f"    '{candidate}' → '{canonical}'")

    # Apply mapping to candidate triples
    resolved_triples = []
    for triple in candidate_triples:
        resolved_triple = dict(triple)  # shallow copy preserves all metadata
        subj = resolved_triple.get("subject", "")
        obj = resolved_triple.get("object", "")
        if subj in entity_mapping:
            resolved_triple["subject"] = entity_mapping[subj]
        if obj in entity_mapping:
            resolved_triple["object"] = entity_mapping[obj]
        resolved_triples.append(resolved_triple)

    return resolved_triples, entity_mapping


def _find_containment_matches(unresolved, existing_entities):
    """
    Find matches where a candidate entity is a meaningful substring of
    (or contains) an existing canonical entity.

    Conservative: only matches when:
    - The shorter name has at least 2 characters
    - The shorter name is not a common stopword
    - The shorter name appears as a distinct word boundary in the longer name

    Args:
        unresolved: List of unresolved candidate entity names
        existing_entities: Set of canonical entity names

    Returns:
        Dict mapping candidate -> canonical entity
    """
    stopwords = {
        "the", "a", "an", "of", "and", "or", "in", "on", "at", "to",
        "for", "with", "by", "as", "is", "was", "are", "were", "be",
        "it", "he", "she", "they", "his", "her", "its", "war", "city",
        "man", "old", "new", "day", "time"
    }

    matches = {}

    for candidate in unresolved:
        candidate_lower = candidate.lower().strip()

        # Skip very short or stopword candidates
        if len(candidate_lower) < 3 or candidate_lower in stopwords:
            continue

        best_match = None
        best_match_len = 0

        for existing in existing_entities:
            existing_lower = existing.lower().strip()

            if candidate_lower == existing_lower:
                continue  # Already handled by case-insensitive pass

            # Check if candidate is a word-boundary substring of existing
            # e.g., "Gilbert" in "Gilbert Bougainvillea"
            if _is_word_boundary_match(candidate_lower, existing_lower):
                if len(existing) > best_match_len:
                    best_match = existing
                    best_match_len = len(existing)

        if best_match:
            matches[candidate] = best_match

    return matches


def _is_word_boundary_match(shorter, longer):
    """
    Check if the shorter string appears at a word boundary in the longer string.

    Examples:
        "gilbert" in "gilbert bougainvillea" → True
        "violet" in "violet evergarden" → True
        "let" in "violet evergarden" → False (not a word boundary)

    Args:
        shorter: The shorter string (lowercase)
        longer: The longer string (lowercase)

    Returns:
        True if shorter appears as a complete word or word prefix in longer
    """
    if shorter not in longer:
        return False

    # Check word-boundary match using regex
    pattern = r'\b' + re.escape(shorter) + r'\b'
    return bool(re.search(pattern, longer))


def _resolve_with_llm(unresolved, existing_entities, config):
    """
    Use LLM to resolve genuinely ambiguous entity matches.

    Args:
        unresolved: List of unresolved candidate entity names
        existing_entities: Set of canonical entity names
        config: Configuration dictionary with LLM settings

    Returns:
        Dict mapping candidate -> canonical entity
    """
    from src.knowledge_graph.llm import call_llm, extract_json_from_text
    from src.knowledge_graph.prompts import prompt_factory

    matches = {}

    # Limit the number of entities to avoid overwhelming the LLM
    candidates_to_resolve = unresolved[:50]
    existing_list = sorted(existing_entities)[:100]

    if not candidates_to_resolve or not existing_list:
        return matches

    candidate_text = "\n".join(sorted(candidates_to_resolve))
    existing_text = "\n".join(existing_list)

    system_prompt = prompt_factory.get_prompt("cross_kg_entity_resolution_system")
    user_prompt = prompt_factory.get_prompt(
        "cross_kg_entity_resolution_user", candidate_text, existing_text
    )

    try:
        model = config["llm"]["model"]
        api_key = config["llm"]["api_key"]
        max_tokens = config["llm"]["max_tokens"]
        temperature = config["llm"]["temperature"]
        base_url = config["llm"]["base_url"]

        response = call_llm(model, user_prompt, api_key, system_prompt, max_tokens, temperature, base_url)
        result = extract_json_from_text(response)

        if result and isinstance(result, dict):
            for canonical, variants in result.items():
                # Verify the canonical entity actually exists in the KG
                if canonical in existing_entities and isinstance(variants, list):
                    for variant in variants:
                        if variant in candidates_to_resolve:
                            matches[variant] = canonical

            print(f"  LLM entity resolution: matched {len(matches)} additional entities")
        else:
            print("  LLM entity resolution: could not extract valid mapping")

    except Exception as e:
        print(f"  LLM entity resolution failed: {e}")

    return matches
