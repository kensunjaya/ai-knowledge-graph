"""Prompts for the incremental knowledge graph update pipeline."""

CROSS_KG_ENTITY_RESOLUTION_SYSTEM_PROMPT = """
You are an expert in entity resolution for knowledge graphs.
Your task is to determine which candidate entity names from newly extracted triples
match existing canonical entities already present in an established knowledge graph.
Be conservative: only match entities when you are confident they refer to the same real-world entity.
"""


def get_cross_kg_entity_resolution_user_prompt(candidate_entities, existing_entities):
    return f"""
I have an existing knowledge graph with these canonical entities:
{existing_entities}

I have newly extracted triples containing these candidate entities:
{candidate_entities}

Please identify which candidate entities refer to the same real-world entity as
an existing canonical entity. Only include matches you are confident about.

Return your answer as a JSON object where:
- Keys are the existing canonical entity names (exactly as shown above)
- Values are arrays of candidate entity names that should map to that canonical entity

Only include entities that have a match. Do not include candidates that are genuinely new entities.

Format your response as valid JSON like this:
{{
  "existing canonical entity 1": ["candidate variant 1", "candidate variant 2"],
  "existing canonical entity 2": ["candidate variant 3"]
}}
"""
