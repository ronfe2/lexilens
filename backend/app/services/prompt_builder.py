from __future__ import annotations

from typing import List, Optional

from app.models.interests import InterestTopicPayload


class PromptBuilder:
    @staticmethod
    def _get_level_band(english_level: str | None) -> str:
        """
        Convert a free-form english_level hint (e.g. 'A1', 'below A1 (Starter)',
        'C1–C2 Academic') into a coarse difficulty band.

        This helps us give the model stronger, level-specific guidance while
        staying robust to different frontend hints.
        """
        if not english_level:
            return "unknown"

        level = english_level.lower()

        # Treat A1/A2 + Starter/KET as beginner, B1/B2 as intermediate,
        # and C1/C2/Academic as advanced.
        if any(tag in level for tag in ["starter", "ket", "a1", "a2"]):
            return "beginner"
        if any(tag in level for tag in ["b1", "b2"]):
            return "intermediate"
        if any(tag in level for tag in ["c1", "c2", "academic"]):
            return "advanced"

        return "unknown"

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
            band = PromptBuilder._get_level_band(english_level)
            level_note = f"""

Learner profile:
- Approximate CEFR level: {english_level}
"""

            if band == "beginner":
                level_note += """
For this learner, write in very simple English:
- Use high-frequency A1–A2 vocabulary and short sentences.
- Write 1–2 sentences in total, ideally no more than 35 words.
- Avoid abstract nouns, idioms, and long subordinate clauses.
- Avoid meta-words like "formal", "official", "legal", "academic", "government",
  "confidential", "revealed", "secret", "scandal".
- Do NOT mention any real people, countries, or news events (for example: no
  famous cases, crimes, or political stories).
- If the headword is advanced, explain it using everyday actions and concrete
  situations (for example: school, family, simple work or study scenes)."""
            elif band == "intermediate":
                level_note += """
For this learner, use clear, natural English at about B1–B2 level:
- You can include some less common words, but keep sentences concise.
- Prefer everyday or basic work situations rather than technical or legal jargon."""
            elif band == "advanced":
                level_note += """
For this learner, you may use more precise or academic vocabulary:
- You can mention subtle meaning differences when helpful.
- Keep the explanation focused and readable, not overly long."""
            else:
                level_note += """
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
    def build_layer3_prompt(
        word: str,
        context: str,
        english_level: str | None = None,
    ) -> tuple[str, str]:
        system_prompt = (
            "You are an experienced ESL teacher identifying common errors."
        )

        level_note = ""
        if english_level:
            band = PromptBuilder._get_level_band(english_level)
            level_note = f"""

Learner profile:
- Approximate CEFR level: {english_level}
"""

            if band == "beginner":
                level_note += """
When creating WRONG and CORRECT example sentences:
- Use simple A1–A2 vocabulary and grammar.
- Prefer active voice and short, clear sentences.
- Avoid rare words or heavy academic topics.
- Keep scenes very simple (school, family, daily life, basic messages).
- Do NOT use examples about government, law, court cases, politics, or scandals.
- Do NOT mention real people, brands, or specific news events.

For the Chinese explanations ("why"):
- Use short, friendly sentences in everyday Chinese.
- Avoid technical grammar jargon whenever possible."""
            elif band == "intermediate":
                level_note += """
When creating examples:
- Use natural B1–B2 English with clear structure.
- You may include common grammar terms in Chinese (例如“时态”“被动语态”), but keep explanations short."""
            elif band == "advanced":
                level_note += """
When creating examples:
- You may use more advanced vocabulary or subtle meaning differences.
- It is acceptable to briefly mention more detailed grammar ideas in Chinese, as long as they stay clear."""
            else:
                level_note += """
Adjust the difficulty so it feels encouraging and not overwhelming for this learner."""

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
Context sentence: {context}{level_note}

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
        english_level: str | None = None,
        interests: Optional[List[InterestTopicPayload]] = None,
        blocked_titles: Optional[List[str]] = None,
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
            band = PromptBuilder._get_level_band(english_level)
            level_note = f"""
The learner's approximate CEFR level is {english_level}. Do NOT mention CEFR \
or levels explicitly in your final answer."""

            if band == "beginner":
                level_note += """

For this learner:
- Choose related words that are high-frequency and not much more difficult than the headword.
- Prefer everyday words instead of rare academic, legal, or technical terms.
- Make "difference" and "when_to_use" explanations short and simple, using basic grammar and vocabulary.
- Write the "difference" and "when_to_use" fields mainly in **Simplified Chinese**,
  only keeping the headwords themselves and very short phrases in English.
- Use neutral, everyday scenes (school, home, simple work). Do NOT use examples
  about government, law, crime, or sensitive real-world events.
- Do NOT mention any real people's names or specific scandals/cases.
- If the headword itself is very advanced, compare it to simpler everyday words
  and focus on concrete scenes."""
            elif band == "intermediate":
                level_note += """

For this learner:
- Use clear B1–B2 English.
- You may contrast the word with slightly more advanced vocabulary, but keep explanations concise.
- Focus on typical exam, work, or study situations that feel realistic."""
            elif band == "advanced":
                level_note += """

For this learner:
- You may include more precise academic or professional vocabulary.
- Highlight subtle meaning and register differences when helpful, while staying readable."""
            else:
                level_note += """

Adjust the difficulty of your coaching so it feels encouraging and not overwhelming."""

        interests_note = ""
        if interests:
            # Summarize up to 5 topics for the model.
            lines: list[str] = []
            for idx, topic in enumerate(interests[:5], start=1):
                title = topic.title.strip()
                summary = topic.summary.strip()
                line = f"{idx}) {title}"
                if summary:
                    line += f"：{summary}"
                lines.append(line)

            joined = "\n".join(f"- {line}" for line in lines)
            interests_note = f"""
Learner interest topics (for personalization):
{joined}

When writing the "personalized" field, prefer using 1–2 of these topics for \
short analogies or scenes when they fit the word "{word}" and its context."""
        else:
            interests_note = """
The learner has not provided specific long-term interest topics.
When writing the "personalized" field, imagine warm, everyday scenes from \
study, life, or work that fit the context, instead of niche topics like \
specific sports teams or particular cities."""

        blocklist_note = ""
        if blocked_titles:
            blocked_preview = ", ".join(blocked_titles[:5])
            blocklist_note = f"""
Important constraint:
- Never mention these blocked topics or phrases in your answer, even inside \
the "personalized" field: {blocked_preview}
"""

        user_prompt = f"""Task: Recommend 2 related words/phrases that help \
		learners understand "{word}" better.

For each related word, provide:
- word: [related word or short phrase ONLY; maximum 1–3 words, never a full sentence]
- relationship: [synonym/antonym/narrower/broader/collocate]
- difference: [how it differs from "{word}"]
- when_to_use: [usage guidance]

Important formatting rules for the "word" field:
- It must be concise enough to fit inside a small node label in a lexical map.
- Do NOT copy the entire context sentence or write a full definition here.
- Do NOT include Chinese text in the "word" field.

		Personalized coaching (Chinese):
		- Always include a "personalized" field in the JSON response.
		- The "personalized" value must be written in **Simplified Chinese**.
		- It should be 1–3 short sentences that speak directly to the learner.
		- Use concrete scenes from everyday life to help them feel the word.
		- When learning history is available, briefly connect this word to some of \
		their previously studied words.
{interests_note}{blocklist_note}

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
        english_level: str | None = None,
        interests: Optional[List[InterestTopicPayload]] = None,
        blocked_titles: Optional[List[str]] = None,
    ) -> dict:
        return {
            "layer1": PromptBuilder.build_layer1_prompt(word, context, english_level),
            "layer2": PromptBuilder.build_layer2_prompt(word, context),
            "layer3": PromptBuilder.build_layer3_prompt(word, context, english_level),
            "layer4": PromptBuilder.build_layer4_prompt(
                word,
                context,
                learning_history,
                english_level,
                interests,
                blocked_titles,
            ),
        }
