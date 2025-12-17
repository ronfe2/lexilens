from __future__ import annotations


class PromptBuilder:
    @staticmethod
    def build_layer1_prompt(word: str, context: str) -> tuple[str, str]:
        system_prompt = (
            "You are a lexicographer in the style of "
            "John Sinclair's Cobuild dictionary."
        )

        user_prompt = f"""Task: Define the word "{word}" using a complete, \
self-contained sentence that:
1. Explains its core function and grammatical behavior
2. Describes typical contexts where it's used
3. NEVER uses the word "{word}" itself in the definition
4. Acts as a perfect example sentence

Word: {word}
Context sentence: {context}

Provide ONLY the definition sentence, nothing else."""

        return system_prompt, user_prompt

    @staticmethod
    def build_layer2_prompt(word: str, context: str) -> tuple[str, str]:
        system_prompt = (
            "You are a language coach creating realistic, current examples."
        )

        user_prompt = f"""Task: Generate 3 distinct, authentic example \
sentences for "{word}", each from a different source:

1. **Twitter/Social Media**: Casual, conversational tone (max 280 chars)
2. **News (BBC/NYT style)**: Formal, objective, journalistic
3. **Academic/Professional**: Precise, technical, sophisticated

Requirements:
- Each example must feel natural and current (2024-2025)
- Include enough context to understand the situation
- Use the word "{word}" naturally, not forced
- Mark which source each is from

Word: {word}
Original context: {context}

Return as JSON array with this exact structure:
[
  {{"source": "twitter", "text": "...", "icon": "twitter"}},
  {{"source": "news", "text": "...", "icon": "newspaper"}},
  {{"source": "academic", "text": "...", "icon": "graduation-cap"}}
]"""

        return system_prompt, user_prompt

    @staticmethod
    def build_layer3_prompt(word: str, context: str) -> tuple[str, str]:
        system_prompt = (
            "You are an experienced ESL teacher identifying common errors."
        )

        user_prompt = f"""Task: Identify the 2 most common mistakes \
non-native speakers make with "{word}".

For each mistake, provide:
1. wrong: [incorrect example sentence]
2. why: [brief explanation]
3. correct: [corrected version]

Word: {word}
Context: {context}

Return as JSON array with this exact structure:
[
  {{
    "wrong": "incorrect example sentence",
    "why": "brief explanation of the error",
    "correct": "corrected version of the sentence"
  }},
  {{
    "wrong": "another incorrect example",
    "why": "explanation",
    "correct": "corrected version"
  }}
]"""

        return system_prompt, user_prompt

    @staticmethod
    def build_layer4_prompt(
        word: str,
        context: str,
        learning_history: list[str] | None = None
    ) -> tuple[str, str]:
        system_prompt = "You are a vocabulary coach building connections."

        personalization = ""
        if (learning_history and "strategy" in learning_history and
                word.lower() == "tactic"):
            personalization = """
IMPORTANT: The user previously learned "strategy". Start your response \
with a personalized message that connects these two words.
Include a "personalized" field in your JSON with this message.
"""

        user_prompt = f"""Task: Recommend 2 related words/phrases that help \
learners understand "{word}" better.

For each related word, provide:
- word: [related word]
- relationship: [synonym/antonym/narrower/broader/collocate]
- difference: [how it differs from "{word}"]
- when_to_use: [usage guidance]

{personalization}

Word: {word}
Context: {context}

Return as JSON with this structure:
{{
  "related_words": [
    {{
      "word": "related word 1",
      "relationship": "synonym/antonym/etc",
      "difference": "key difference explanation",
      "when_to_use": "when to use each word"
    }},
    {{
      "word": "related word 2",
      "relationship": "synonym/antonym/etc",
      "difference": "key difference explanation",
      "when_to_use": "when to use each word"
    }}
  ]{"," if personalization else ""}
  {"'personalized': 'Your personalized message connecting to " +
   "previously learned words'" if personalization else ""}
}}"""

        return system_prompt, user_prompt

    @staticmethod
    def get_all_prompts(
        word: str,
        context: str,
        learning_history: list[str] | None = None
    ) -> dict:
        return {
            "layer1": PromptBuilder.build_layer1_prompt(word, context),
            "layer2": PromptBuilder.build_layer2_prompt(word, context),
            "layer3": PromptBuilder.build_layer3_prompt(word, context),
            "layer4": PromptBuilder.build_layer4_prompt(word, context, learning_history),
        }
