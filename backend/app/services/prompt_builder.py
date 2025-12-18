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

        history_note = ""
        if learning_history:
            history_preview = ", ".join(learning_history[:10])
            history_note = f"""
The learner has previously studied these words: {history_preview}.
Use this learning history to make the personalized coaching feel connected \
to what they already know when it is helpful.
"""

        user_prompt = f"""Task: Recommend 2 related words/phrases that help \
learners understand "{word}" better.

For each related word, provide:
- word: [related word]
- relationship: [synonym/antonym/narrower/broader/collocate]
- difference: [how it differs from "{word}"]
- when_to_use: [usage guidance]

Personalized coaching (Chinese):
- Always include a "personalized" field in the JSON response.
- The "personalized" value must be written in **Simplified Chinese**.
- It should be 1–3 short sentences that speak directly to the learner.
- When learning history is available, briefly connect this word to some of \
their previously studied words.

Word: {word}
Context: {context}
Learning history (may be empty): {learning_history or []}
{history_note}

Return as JSON with this structure:
{{
  "related_words": [
    {{
      "word": "related word 1",
      "relationship": "synonym/antonym/etc",
      "difference": "key difference explanation (can be in English)",
      "when_to_use": "when to use each word (can be in English)"
    }},
    {{
      "word": "related word 2",
      "relationship": "synonym/antonym/etc",
      "difference": "key difference explanation (can be in English)",
      "when_to_use": "when to use each word (can be in English)"
    }}
  ],
  "personalized": "这里填写给学习者的个性化建议，用简体中文，1-3 句，直接和学习者对话，\
可以引用他们之前学过的单词。"
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
