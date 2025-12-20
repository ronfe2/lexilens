from __future__ import annotations


class PromptBuilder:
    @staticmethod
    def build_layer1_prompt(
        word: str,
        context: str,
        english_level: str | None = None
    ) -> tuple[str, str]:
        system_prompt = (
            "You are a lexicographer in the style of "
            "John Sinclair's Cobuild dictionary."
        )

        level_note = ""
        if english_level:
            level_note = f"""

Learner profile:
- Approximate CEFR level: {english_level}
Use language that feels natural, clear, and accessible for this level."""

        user_prompt = f"""Task: Explain the meaning of "{word}" in the \
given context using Cobuild-style learner-dictionary language.

Write ONE short explanation, in 1–2 sentences (maximum 60 words total), that:
1. Describes what happens in real life when people use this word
2. Focuses on situations and intentions, not grammar jargon
3. Includes the headword "{word}" once near the beginning of the first sentence
4. Feels like it comes from a learner's dictionary entry

Formatting rules (very important):
- Output ONLY the explanation sentence(s).
- Do NOT include separate example sentences, translations, bullet points, quotes, markdown, or notes in parentheses.
- Do NOT mention learners, CEFR levels, definitions, prompts, or context sentences.
- Do NOT explain why your sentence is good; just write the explanation itself.

Word: {word}
Context sentence: {context}{level_note}

Return only the explanation sentence(s)."""

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

        user_prompt = f"""Task: Identify the 2 most important mistakes \
non-native speakers make with "{word}".

Requirements:
- Each mistake MUST use the target word "{word}" in both the wrong and correct sentences.
- The 2 mistakes MUST focus on different typical problems (for example:
  one about grammar/form, the other about collocation/meaning/context).
- Do NOT give two variants of the same error type (for example: both only
  about singular vs plural).

For each mistake, provide:
1. wrong: [incorrect example sentence in English, using "{word}"]
2. why: [brief explanation in Simplified Chinese]
3. correct: [corrected sentence in English, using "{word}"]

Word: {word}
Context sentence: {context}

Return as JSON array with this exact structure:
[
  {{
    "wrong": "incorrect example sentence in English",
    "why": "简短的中文解释，说明错误出在哪里",
    "correct": "corrected version of the sentence in English"
  }},
  {{
    "wrong": "another incorrect example in English",
    "why": "另一种典型错误的简短中文解释",
    "correct": "corrected version in English"
  }}
]"""

        return system_prompt, user_prompt

    @staticmethod
    def build_layer4_prompt(
        word: str,
        context: str,
        learning_history: list[str] | None = None,
        english_level: str | None = None
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

        level_note = ""
        if english_level:
            level_note = f"""
The learner's approximate CEFR level is {english_level}. Adjust the difficulty \
of your coaching so it feels encouraging and not overwhelming, but do NOT \
mention CEFR or levels explicitly in your final answer."""

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
	- Use concrete scenes from everyday life to help them feel the word.
	- Pretend the learner特别喜欢以下主题：足球比赛、在北京买房、大模型相关的工作。
	- 在解读时，从这些主题里选 1–2 个做类比或场景说明，让这个词更好懂。
	- When learning history is available, briefly connect this word to some of \
	their previously studied words.

Word: {word}
Context: {context}
Learning history (may be empty): {learning_history or []}
{history_note}{level_note}

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
        learning_history: list[str] | None = None,
        english_level: str | None = None
    ) -> dict:
        return {
            "layer1": PromptBuilder.build_layer1_prompt(word, context, english_level),
            "layer2": PromptBuilder.build_layer2_prompt(word, context),
            "layer3": PromptBuilder.build_layer3_prompt(word, context),
            "layer4": PromptBuilder.build_layer4_prompt(
                word,
                context,
                learning_history,
                english_level,
            ),
        }
