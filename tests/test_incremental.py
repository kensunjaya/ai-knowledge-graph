"""
Tests for the incremental knowledge graph update pipeline.

Covers entity resolution, triple reconciliation, changeset application,
malformed input handling, and repeated incremental updates.
"""
import json
import os
import sys
import tempfile
import pytest

# Ensure project root is on the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.knowledge_graph.entity_resolution import resolve_entities, _is_word_boundary_match
from src.knowledge_graph.reconciliation import reconcile_triples, apply_changeset, print_changeset_summary
from src.knowledge_graph.incremental import load_existing_kg


# ===================================================================
# Fixtures
# ===================================================================

@pytest.fixture
def existing_triples():
    """A small existing KG for testing."""
    return [
        {"subject": "Violet Evergarden", "predicate": "served under", "object": "Gilbert Bougainvillea", "chunk": 1},
        {"subject": "Violet Evergarden", "predicate": "is", "object": "Auto Memory Doll", "chunk": 1},
        {"subject": "Gilbert Bougainvillea", "predicate": "is", "object": "military officer", "chunk": 2},
        {"subject": "Violet Evergarden", "predicate": "lost", "object": "both arms", "chunk": 2},
        {"subject": "Claudia Hodgins", "predicate": "founded", "object": "CH Postal Company", "chunk": 3},
    ]


# ===================================================================
# Test 1: New unique triple → classified as ADD, appears once
# ===================================================================

class TestAddNewTriple:
    def test_new_triple_classified_as_add(self, existing_triples):
        candidates = [
            {"subject": "Violet Evergarden", "predicate": "writes for", "object": "customers"},
        ]
        changeset = reconcile_triples(candidates, existing_triples)
        assert len(changeset["add"]) == 1
        assert len(changeset["reinforce"]) == 0
        assert changeset["add"][0]["predicate"] == "writes for"

    def test_new_triple_appears_once_in_updated_kg(self, existing_triples):
        candidates = [
            {"subject": "Violet Evergarden", "predicate": "writes for", "object": "customers"},
        ]
        changeset = reconcile_triples(candidates, existing_triples)
        updated = apply_changeset(existing_triples, changeset)

        # Count occurrences of the new triple
        count = sum(
            1 for t in updated
            if t["subject"] == "Violet Evergarden"
            and t["predicate"] == "writes for"
            and t["object"] == "customers"
        )
        assert count == 1

    def test_multiple_new_triples(self, existing_triples):
        candidates = [
            {"subject": "Luculia", "predicate": "is", "object": "trainee"},
            {"subject": "Spencer", "predicate": "is", "object": "soldier"},
        ]
        changeset = reconcile_triples(candidates, existing_triples)
        assert len(changeset["add"]) == 2


# ===================================================================
# Test 2: Exact duplicate triple → classified as REINFORCE, no dup
# ===================================================================

class TestReinforceExistingTriple:
    def test_exact_duplicate_classified_as_reinforce(self, existing_triples):
        candidates = [
            {"subject": "Violet Evergarden", "predicate": "served under", "object": "Gilbert Bougainvillea"},
        ]
        changeset = reconcile_triples(candidates, existing_triples)
        assert len(changeset["reinforce"]) == 1
        assert len(changeset["add"]) == 0

    def test_case_insensitive_reinforce(self, existing_triples):
        """Canonical comparison is case-insensitive."""
        candidates = [
            {"subject": "violet evergarden", "predicate": "Served Under", "object": "gilbert bougainvillea"},
        ]
        changeset = reconcile_triples(candidates, existing_triples)
        assert len(changeset["reinforce"]) == 1
        assert len(changeset["add"]) == 0

    def test_no_duplicate_in_updated_kg(self, existing_triples):
        candidates = [
            {"subject": "Violet Evergarden", "predicate": "served under", "object": "Gilbert Bougainvillea"},
        ]
        changeset = reconcile_triples(candidates, existing_triples)
        updated = apply_changeset(existing_triples, changeset)
        assert len(updated) == len(existing_triples)  # No new triples added


# ===================================================================
# Test 3: Candidate entity matching existing canonical entity
# ===================================================================

class TestEntityResolution:
    def test_exact_match(self, existing_triples):
        candidates = [
            {"subject": "Violet Evergarden", "predicate": "writes", "object": "letters"},
        ]
        resolved, mapping = resolve_entities(candidates, existing_triples)
        # Exact match should map to itself
        assert resolved[0]["subject"] == "Violet Evergarden"

    def test_case_insensitive_match(self, existing_triples):
        candidates = [
            {"subject": "violet evergarden", "predicate": "writes", "object": "letters"},
        ]
        resolved, mapping = resolve_entities(candidates, existing_triples)
        assert resolved[0]["subject"] == "Violet Evergarden"

    def test_substring_containment_match(self, existing_triples):
        """'Gilbert' should resolve to 'Gilbert Bougainvillea'."""
        candidates = [
            {"subject": "Gilbert", "predicate": "survived", "object": "War"},
        ]
        resolved, mapping = resolve_entities(candidates, existing_triples)
        assert resolved[0]["subject"] == "Gilbert Bougainvillea"

    def test_object_entity_also_resolved(self, existing_triples):
        candidates = [
            {"subject": "Luculia", "predicate": "admires", "object": "Violet"},
        ]
        resolved, mapping = resolve_entities(candidates, existing_triples)
        assert resolved[0]["object"] == "Violet Evergarden"

    def test_both_subject_and_object_resolved(self, existing_triples):
        candidates = [
            {"subject": "Violet", "predicate": "trained under", "object": "Gilbert"},
        ]
        resolved, mapping = resolve_entities(candidates, existing_triples)
        assert resolved[0]["subject"] == "Violet Evergarden"
        assert resolved[0]["object"] == "Gilbert Bougainvillea"


# ===================================================================
# Test 4: Completely new entity → remains a new entity
# ===================================================================

class TestNewEntity:
    def test_new_entity_preserved(self, existing_triples):
        candidates = [
            {"subject": "Luculia Marlborough", "predicate": "is", "object": "trainee"},
        ]
        resolved, mapping = resolve_entities(candidates, existing_triples)
        # Luculia Marlborough doesn't exist in the KG, should be preserved
        assert resolved[0]["subject"] == "Luculia Marlborough"

    def test_new_entity_added_to_kg(self, existing_triples):
        candidates = [
            {"subject": "Luculia Marlborough", "predicate": "is friend of", "object": "Violet Evergarden"},
        ]
        resolved, _ = resolve_entities(candidates, existing_triples)
        changeset = reconcile_triples(resolved, existing_triples)
        updated = apply_changeset(existing_triples, changeset)

        # New entity should appear in the updated KG
        all_subjects = {t["subject"] for t in updated}
        assert "Luculia Marlborough" in all_subjects


# ===================================================================
# Test 5: Malformed candidate triple (null values) → no crash
# ===================================================================

class TestMalformedTriples:
    def test_null_subject_skipped(self, existing_triples):
        candidates = [
            {"subject": None, "predicate": "is", "object": "something"},
            {"subject": "Violet Evergarden", "predicate": "writes", "object": "letters"},
        ]
        changeset = reconcile_triples(candidates, existing_triples)
        # Only the valid triple should be processed
        assert len(changeset["add"]) + len(changeset["reinforce"]) + len(changeset["review_conflict"]) == 1

    def test_null_predicate_skipped(self, existing_triples):
        candidates = [
            {"subject": "Violet Evergarden", "predicate": None, "object": "something"},
        ]
        changeset = reconcile_triples(candidates, existing_triples)
        total = len(changeset["add"]) + len(changeset["reinforce"]) + len(changeset["review_conflict"])
        assert total == 0

    def test_null_object_skipped(self, existing_triples):
        candidates = [
            {"subject": "Violet Evergarden", "predicate": "is", "object": None},
        ]
        changeset = reconcile_triples(candidates, existing_triples)
        total = len(changeset["add"]) + len(changeset["reinforce"]) + len(changeset["review_conflict"])
        assert total == 0

    def test_empty_string_fields_skipped(self, existing_triples):
        candidates = [
            {"subject": "", "predicate": "is", "object": "something"},
            {"subject": "Violet Evergarden", "predicate": "", "object": "something"},
            {"subject": "Violet Evergarden", "predicate": "is", "object": ""},
        ]
        changeset = reconcile_triples(candidates, existing_triples)
        total = len(changeset["add"]) + len(changeset["reinforce"]) + len(changeset["review_conflict"])
        assert total == 0

    def test_missing_keys_in_entity_resolution(self, existing_triples):
        """Entity resolution should handle triples missing keys gracefully."""
        candidates = [
            {"predicate": "is", "object": "something"},  # missing subject
            {"subject": "Violet Evergarden", "predicate": "writes", "object": "letters"},
        ]
        resolved, _ = resolve_entities(candidates, existing_triples)
        assert len(resolved) == 2  # Both returned, malformed handled downstream


# ===================================================================
# Test 6: Existing KG preservation — unrelated triples unchanged
# ===================================================================

class TestExistingKGPreservation:
    def test_unrelated_triples_unchanged(self, existing_triples):
        candidates = [
            {"subject": "Luculia", "predicate": "is", "object": "trainee"},
        ]
        changeset = reconcile_triples(candidates, existing_triples)
        updated = apply_changeset(existing_triples, changeset)

        # All original triples should still be present
        for original in existing_triples:
            assert original in updated

    def test_original_triple_metadata_preserved(self, existing_triples):
        """Chunk numbers and other metadata on existing triples should be preserved."""
        candidates = [
            {"subject": "new entity", "predicate": "does", "object": "something"},
        ]
        changeset = reconcile_triples(candidates, existing_triples)
        updated = apply_changeset(existing_triples, changeset)

        # Check that original triples retain their chunk metadata
        for original in existing_triples:
            found = False
            for updated_triple in updated:
                if (updated_triple["subject"] == original["subject"]
                        and updated_triple["predicate"] == original["predicate"]
                        and updated_triple["object"] == original["object"]):
                    assert updated_triple.get("chunk") == original.get("chunk")
                    found = True
                    break
            assert found, f"Original triple not found in updated KG: {original}"

    def test_existing_kg_list_not_mutated(self, existing_triples):
        """apply_changeset should not mutate the input existing_triples list."""
        original_len = len(existing_triples)
        original_copy = list(existing_triples)

        candidates = [
            {"subject": "new entity", "predicate": "does", "object": "something"},
        ]
        changeset = reconcile_triples(candidates, existing_triples)
        _ = apply_changeset(existing_triples, changeset)

        assert len(existing_triples) == original_len
        assert existing_triples == original_copy


# ===================================================================
# Test 7: Repeated incremental updates — output valid as future input
# ===================================================================

class TestRepeatedUpdates:
    def test_output_is_valid_input(self, existing_triples):
        """Updated KG can be used as input for another incremental update."""
        # First update
        candidates_1 = [
            {"subject": "Luculia", "predicate": "is friend of", "object": "Violet Evergarden"},
        ]
        resolved_1, _ = resolve_entities(candidates_1, existing_triples)
        changeset_1 = reconcile_triples(resolved_1, existing_triples)
        updated_1 = apply_changeset(existing_triples, changeset_1)

        # Second update using output of first
        candidates_2 = [
            {"subject": "Spencer", "predicate": "is brother of", "object": "Luculia"},
        ]
        resolved_2, _ = resolve_entities(candidates_2, updated_1)
        changeset_2 = reconcile_triples(resolved_2, updated_1)
        updated_2 = apply_changeset(updated_1, changeset_2)

        # Both new triples should be present
        assert len(updated_2) == len(existing_triples) + 2

    def test_round_trip_through_json(self, existing_triples):
        """Updated KG survives JSON serialization round-trip."""
        candidates = [
            {"subject": "Luculia", "predicate": "trains at", "object": "postal school"},
        ]
        changeset = reconcile_triples(candidates, existing_triples)
        updated = apply_changeset(existing_triples, changeset)

        # Serialize and deserialize
        json_str = json.dumps(updated, indent=2)
        reloaded = json.loads(json_str)

        assert len(reloaded) == len(updated)
        for original, reloaded_triple in zip(updated, reloaded):
            assert original["subject"] == reloaded_triple["subject"]
            assert original["predicate"] == reloaded_triple["predicate"]
            assert original["object"] == reloaded_triple["object"]

    def test_three_successive_updates(self, existing_triples):
        """KG v1 + A → v2, v2 + B → v3, v3 + C → v4"""
        kg = existing_triples

        for i, candidates in enumerate([
            [{"subject": "entity A", "predicate": "rel", "object": "entity B"}],
            [{"subject": "entity C", "predicate": "rel", "object": "entity D"}],
            [{"subject": "entity E", "predicate": "rel", "object": "entity F"}],
        ]):
            changeset = reconcile_triples(candidates, kg)
            kg = apply_changeset(kg, changeset)

        assert len(kg) == len(existing_triples) + 3


# ===================================================================
# Test: Intra-batch deduplication
# ===================================================================

class TestIntraBatchDedup:
    def test_duplicate_candidates_not_added_twice(self, existing_triples):
        """If two identical candidate triples appear, only one ADD."""
        candidates = [
            {"subject": "Luculia", "predicate": "is", "object": "trainee"},
            {"subject": "Luculia", "predicate": "is", "object": "trainee"},
        ]
        changeset = reconcile_triples(candidates, existing_triples)
        assert len(changeset["add"]) == 1


# ===================================================================
# Test: Review conflict heuristic
# ===================================================================

class TestReviewConflict:
    def test_same_so_different_predicate_flagged(self, existing_triples):
        """Same subject+object but different predicate → REVIEW_CONFLICT."""
        candidates = [
            {"subject": "Violet Evergarden", "predicate": "loves", "object": "Gilbert Bougainvillea"},
        ]
        changeset = reconcile_triples(candidates, existing_triples)
        assert len(changeset["review_conflict"]) == 1
        # The conflict record should note it's heuristic
        conflict = changeset["review_conflict"][0]
        assert "heuristic" in conflict["note"].lower()

    def test_review_conflict_not_applied_to_kg(self, existing_triples):
        """REVIEW_CONFLICT triples should NOT be added to the updated KG."""
        candidates = [
            {"subject": "Violet Evergarden", "predicate": "loves", "object": "Gilbert Bougainvillea"},
        ]
        changeset = reconcile_triples(candidates, existing_triples)
        updated = apply_changeset(existing_triples, changeset)
        assert len(updated) == len(existing_triples)


# ===================================================================
# Test: Changeset summary printing
# ===================================================================

class TestChangesetSummary:
    def test_print_summary_does_not_crash(self, existing_triples, capsys):
        candidates = [
            {"subject": "Violet Evergarden", "predicate": "served under", "object": "Gilbert Bougainvillea"},
            {"subject": "Luculia", "predicate": "is", "object": "trainee"},
            {"subject": "Violet Evergarden", "predicate": "loves", "object": "Gilbert Bougainvillea"},
        ]
        changeset = reconcile_triples(candidates, existing_triples)
        print_changeset_summary(changeset)
        captured = capsys.readouterr()
        assert "Added:" in captured.out
        assert "Reinforced:" in captured.out


# ===================================================================
# Test: Word boundary matching utility
# ===================================================================

class TestWordBoundaryMatch:
    def test_full_word_match(self):
        assert _is_word_boundary_match("gilbert", "gilbert bougainvillea") is True

    def test_partial_word_no_match(self):
        assert _is_word_boundary_match("let", "violet evergarden") is False

    def test_word_in_middle(self):
        assert _is_word_boundary_match("memory", "auto memory doll") is True

    def test_no_match(self):
        assert _is_word_boundary_match("xyz", "violet evergarden") is False


# ===================================================================
# Test: load_existing_kg validation
# ===================================================================

class TestLoadExistingKG:
    def test_valid_json_loads_correctly(self, tmp_path):
        kg_file = tmp_path / "test_kg.json"
        data = [
            {"subject": "A", "predicate": "rel", "object": "B"},
            {"subject": "C", "predicate": "rel", "object": "D"},
        ]
        kg_file.write_text(json.dumps(data), encoding="utf-8")

        result = load_existing_kg(str(kg_file))
        assert len(result) == 2

    def test_malformed_triples_filtered(self, tmp_path):
        kg_file = tmp_path / "test_kg.json"
        data = [
            {"subject": "A", "predicate": "rel", "object": "B"},
            {"subject": None, "predicate": "rel", "object": "B"},
            {"predicate": "rel", "object": "B"},  # missing subject
            "not a dict",
        ]
        kg_file.write_text(json.dumps(data), encoding="utf-8")

        result = load_existing_kg(str(kg_file))
        assert len(result) == 1

    def test_nonexistent_file_exits(self, tmp_path):
        with pytest.raises(SystemExit):
            load_existing_kg(str(tmp_path / "nonexistent.json"))

    def test_invalid_json_exits(self, tmp_path):
        kg_file = tmp_path / "bad.json"
        kg_file.write_text("not valid json {{{", encoding="utf-8")
        with pytest.raises(SystemExit):
            load_existing_kg(str(kg_file))

    def test_non_array_json_exits(self, tmp_path):
        kg_file = tmp_path / "obj.json"
        kg_file.write_text('{"key": "value"}', encoding="utf-8")
        with pytest.raises(SystemExit):
            load_existing_kg(str(kg_file))
