"""
Triple reconciliation for incremental knowledge graph updates.

Compares resolved candidate triples against the existing KG to produce
a changeset with ADD, REINFORCE, and REVIEW_CONFLICT classifications.
"""


def _canonicalize_triple(triple):
    """
    Create a canonical comparison key from a triple.

    Uses lowercased, stripped values for stable comparison while
    preserving original display values in the triple itself.

    Args:
        triple: Dict with 'subject', 'predicate', 'object' keys

    Returns:
        Tuple of (subject, predicate, object) in canonical form
    """
    return (
        (triple.get("subject") or "").lower().strip(),
        (triple.get("predicate") or "").lower().strip(),
        (triple.get("object") or "").lower().strip(),
    )


def reconcile_triples(resolved_candidates, existing_triples):
    """
    Compare resolved candidate triples against the existing KG.

    Classifications:
    - ADD: No existing match — new fact to add
    - REINFORCE: Exact canonical SPO match already exists
    - REVIEW_CONFLICT: Same subject+object pair exists but with a different
      predicate. This is a candidate conflict heuristic, not proof of
      contradiction — flagged for human review.

    Args:
        resolved_candidates: List of resolved candidate triple dicts
        existing_triples: List of triple dicts from the existing KG

    Returns:
        Dict with keys 'add', 'reinforce', 'review_conflict', each
        containing a list of triple dicts (or conflict info dicts)
    """
    changeset = {
        "add": [],
        "reinforce": [],
        "review_conflict": [],
    }

    # Build index of existing triples for efficient lookup
    existing_spo_set = set()
    # Index by canonical (subject, object) pair for conflict detection
    existing_so_predicates = {}

    for triple in existing_triples:
        canon = _canonicalize_triple(triple)
        existing_spo_set.add(canon)

        so_key = (canon[0], canon[2])  # (subject, object)
        if so_key not in existing_so_predicates:
            existing_so_predicates[so_key] = set()
        existing_so_predicates[so_key].add(canon[1])

    # Track what we've already added in this batch to avoid intra-batch duplicates
    added_spo_set = set()

    for candidate in resolved_candidates:
        canon = _canonicalize_triple(candidate)
        canon_subj, canon_pred, canon_obj = canon

        # Skip empty/malformed
        if not canon_subj or not canon_pred or not canon_obj:
            continue

        # Check for exact existing match
        if canon in existing_spo_set:
            changeset["reinforce"].append(candidate)
            continue

        # Check for candidate conflict heuristic:
        # Same subject+object but different predicate
        so_key = (canon_subj, canon_obj)
        if so_key in existing_so_predicates:
            existing_preds = existing_so_predicates[so_key]
            if canon_pred not in existing_preds:
                changeset["review_conflict"].append({
                    "candidate": candidate,
                    "existing_predicates": sorted(existing_preds),
                    "note": "Same subject+object pair exists with different predicate(s). "
                            "This is a heuristic flag, not proof of contradiction.",
                })
                continue

        # Not in existing KG — classify as ADD (if not already added in this batch)
        if canon not in added_spo_set:
            changeset["add"].append(candidate)
            added_spo_set.add(canon)

    return changeset


def apply_changeset(existing_triples, changeset):
    """
    Apply a reconciliation changeset to produce the updated KG.

    - ADD: appends new canonical triples
    - REINFORCE: no duplicate created; existing triple left unchanged
    - REVIEW_CONFLICT: not applied; reported only

    Args:
        existing_triples: List of triple dicts from the existing KG
        changeset: Dict produced by reconcile_triples()

    Returns:
        List of triple dicts representing the updated KG
    """
    # Start with a copy of existing triples to avoid mutation
    updated = list(existing_triples)

    # Append ADD triples
    for triple in changeset.get("add", []):
        updated.append(triple)

    return updated


def print_changeset_summary(changeset):
    """
    Print a concise human-readable summary of the changeset.

    Args:
        changeset: Dict produced by reconcile_triples()
    """
    total = (
        len(changeset.get("add", []))
        + len(changeset.get("reinforce", []))
        + len(changeset.get("review_conflict", []))
    )

    print("\n" + "=" * 50)
    print("INCREMENTAL UPDATE SUMMARY")
    print("=" * 50)
    print(f"  Candidate triples processed: {total}")
    print(f"  Added:            {len(changeset.get('add', []))}")
    print(f"  Reinforced:       {len(changeset.get('reinforce', []))}")
    print(f"  Review conflicts: {len(changeset.get('review_conflict', []))}")

    # Print conflict details if any
    conflicts = changeset.get("review_conflict", [])
    if conflicts:
        print("\n  Conflicts flagged for review (heuristic, not proven contradictions):")
        for conflict in conflicts:
            candidate = conflict["candidate"]
            existing_preds = conflict["existing_predicates"]
            print(f"    - '{candidate.get('subject', '')}' -> '{candidate.get('predicate', '')}' -> "
                  f"'{candidate.get('object', '')}' "
                  f"(existing predicate(s): {', '.join(existing_preds)})")

    print("=" * 50)
