from __future__ import annotations

"""
Central registry for all LLM prompts used in the backend.

Each entry groups:
- the system prompt (if any)
- the user/content prompt template
- optional sub-templates (level-specific notes, history notes, etc.)

更新提示词时，只需要改这个文件里的字符串即可。
每个块上方的注释说明：
- 使用位置（Python 函数路径）
- 可用变量（.format(...) 中的占位符）
"""

from typing import Any, Dict


PROMPT_CONFIG: Dict[str, Dict[str, Any]] = {
    # Layer 1: Cobuild-style short definition shown in the LexiLens side panel.
    # 使用位置:
    # - app.services.prompt_builder.PromptBuilder.build_layer1_prompt
    # - app.services.llm_orchestrator.LLMOrchestrator.generate_layer1_stream
    # 模板变量:
    # - {word}: 当前查询单词
    # - {context}: 页面上选中的英文原句
    # - {level_note}: 根据 english_level 生成的额外说明（只在传入 english_level 时非空）
    #   - {english_level}: 前端传入的 CEFR 或文字等级提示（例如 "A2", "below A1 (Starter)"）
    "layer1": {
        "system_prompt": (
            "You are a lexicographer in the style of "
            "John Sinclair's Cobuild dictionary."
        ),
        "user_prompt_template": """Task: Explain the meaning of "{word}" in the given context using Cobuild-style learner-dictionary language.

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

Return only the explanation sentence(s).""",
        "level_notes": {
            "beginner": """

Learner profile:
- Approximate CEFR level: {english_level}

For this learner, write in very simple English:
- Use high-frequency A1–A2 vocabulary and short sentences.
- Write 1–2 sentences in total, ideally no more than 35 words.
- Avoid abstract nouns, idioms, and long subordinate clauses.
- Avoid meta-words like "formal", "official", "legal", "academic", "government",
  "confidential", "revealed", "secret", "scandal".
- Do NOT mention any real people, countries, or news events (for example: no
  famous cases, crimes, or political stories).
- If the headword is advanced, explain it using everyday actions and concrete
  situations (for example: school, family, simple work or study scenes).""",
            "intermediate": """

Learner profile:
- Approximate CEFR level: {english_level}

For this learner, use clear, natural English at about B1–B2 level:
- You can include some less common words, but keep sentences concise.
- Prefer everyday or basic work situations rather than technical or legal jargon.""",
            "advanced": """

Learner profile:
- Approximate CEFR level: {english_level}

For this learner, you may use more precise or academic vocabulary:
- You can mention subtle meaning differences when helpful.
- Keep the explanation focused and readable, not overly long.""",
            "unknown": """

Learner profile:
- Approximate CEFR level: {english_level}

Use language that feels natural, clear, and accessible for this level.""",
        },
    },

    # Layer 2: Live contexts – 3 examples (social, news, academic) containing the word.
    # 使用位置:
    # - app.services.prompt_builder.PromptBuilder.build_layer2_prompt
    # - app.services.llm_orchestrator.LLMOrchestrator.generate_layer2
    # 模板变量:
    # - {word}: 当前查询单词
    # - {context}: 页面上选中的英文原句
    "layer2": {
        "system_prompt": (
            "You are a language coach creating realistic, current examples."
        ),
        "user_prompt_template": """Task: Generate 3 distinct, authentic example sentences for "{word}", each from a different source:

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
]""",
    },

    # Layer 3: Common mistakes – WRONG/WHY/CORRECT pairs with Chinese explanations.
    # 使用位置:
    # - app.services.prompt_builder.PromptBuilder.build_layer3_prompt
    # - app.services.llm_orchestrator.LLMOrchestrator.generate_layer3
    # 模板变量:
    # - {word}: 当前查询单词
    # - {context}: 页面上选中的英文原句
    # - {level_note}: 根据 english_level 生成的额外说明（只在传入 english_level 时非空）
    #   - {english_level}: 前端传入的 CEFR 或文字等级提示
    "layer3": {
        "system_prompt": (
            "You are an experienced ESL teacher identifying common errors."
        ),
        "user_prompt_template": """Task: Identify the 2 most important mistakes non-native speakers make with "{word}".

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
]""",
        "level_notes": {
            "beginner": """

Learner profile:
- Approximate CEFR level: {english_level}

When creating WRONG and CORRECT example sentences:
- Use simple A1–A2 vocabulary and grammar.
- Prefer active voice and short, clear sentences.
- Avoid rare words or heavy academic topics.
- Keep scenes very simple (school, family, daily life, basic messages).
- Do NOT use examples about government, law, court cases, politics, or scandals.
- Do NOT mention real people, brands, or specific news events.

For the Chinese explanations ("why"):
- Use short, friendly sentences in everyday Chinese.
- Avoid technical grammar jargon whenever possible.""",
            "intermediate": """

Learner profile:
- Approximate CEFR level: {english_level}

When creating examples:
- Use natural B1–B2 English with clear structure.
- You may include common grammar terms in Chinese (例如“时态”“被动语态”), but keep explanations short.""",
            "advanced": """

Learner profile:
- Approximate CEFR level: {english_level}

When creating examples:
- You may use more advanced vocabulary or subtle meaning differences.
- It is acceptable to briefly mention more detailed grammar ideas in Chinese, as long as they stay clear.""",
            "unknown": """

Learner profile:
- Approximate CEFR level: {english_level}

Adjust the difficulty so it feels encouraging and not overwhelming for this learner.""",
        },
    },

    # Layer 4: Related words + personalized coaching in Chinese.
    # 使用位置:
    # - app.services.prompt_builder.PromptBuilder.build_layer4_prompt
    # - app.services.llm_orchestrator.LLMOrchestrator.generate_layer4
    # 模板变量:
    # - {word}: 当前查询单词
    # - {context}: 页面上选中的英文原句
    # - {learning_history}: 历史学过的单词列表（Python list，会以 repr 形式插入）
    # - {history_note}: 根据 learning_history[:10] 生成的说明（可能为空字符串）
    #   - {history_preview}: 取前 10 个学习过的单词，逗号分隔后的字符串
    # - {level_note}: 根据 english_level 生成的额外说明（只在传入 english_level 时非空）
    #   - {english_level}: 前端传入的 CEFR 或文字等级提示
    # - {interests_note}: 根据兴趣列表生成的个性化场景说明
    #   - {joined}: 已格式化好的兴趣主题列表字符串
    # - {blocklist_note}: 根据 blocked_titles 生成的屏蔽说明（可能为空字符串）
    #   - {blocked_preview}: 取前 5 个屏蔽标题、逗号分隔后的字符串
    "layer4": {
        "system_prompt": "You are a vocabulary coach building connections.",
        "user_prompt_template": """Task: Recommend 2 related words/phrases that help learners understand "{word}" better.

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
- When learning history is available, briefly connect this word to some of their previously studied words.
{interests_note}{blocklist_note}

Word: {word}
Context: {context}
Learning history (may be empty): {learning_history}
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
  "personalized": "这里填写给学习者的个性化建议，用简体中文，1-3 句，直接和学习者对话，可以引用他们之前学过的单词。"
}}""",
        "history_note_template": """
The learner has previously studied these words: {history_preview}.
Use this learning history to make the personalized coaching feel connected to what they already know when it is helpful.
""",
        "interests_with_topics_template": """
Learner interest topics (for personalization):
{joined}

When writing the "personalized" field, prefer using 1–2 of these topics for short analogies or scenes when they fit the word "{word}" and its context.""",
        "interests_without_topics_template": """
The learner has not provided specific long-term interest topics.
When writing the "personalized" field, imagine warm, everyday scenes from study, life, or work that fit the context, instead of niche topics like specific sports teams or particular cities.""",
        "blocklist_note_template": """
Important constraint:
- Never mention these blocked topics or phrases in your answer, even inside the "personalized" field: {blocked_preview}
""",
        "level_notes": {
            "beginner": """

The learner's approximate CEFR level is {english_level}. Do NOT mention CEFR or levels explicitly in your final answer.

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
  and focus on concrete scenes.""",
            "intermediate": """

The learner's approximate CEFR level is {english_level}. Do NOT mention CEFR or levels explicitly in your final answer.

For this learner:
- Use clear B1–B2 English.
- You may contrast the word with slightly more advanced vocabulary, but keep explanations concise.
- Focus on typical exam, work, or study situations that feel realistic.""",
            "advanced": """

The learner's approximate CEFR level is {english_level}. Do NOT mention CEFR or levels explicitly in your final answer.

For this learner:
- You may include more precise academic or professional vocabulary.
- Highlight subtle meaning and register differences when helpful, while staying readable.""",
            "unknown": """

The learner's approximate CEFR level is {english_level}. Do NOT mention CEFR or levels explicitly in your final answer.

Adjust the difficulty of your coaching so it feels encouraging and not overwhelming.""",
        },
    },

    # Learner interests summarization: maintain/update long-term interest topics.
    # 使用位置:
    # - app.services.llm_orchestrator.LLMOrchestrator.summarize_interests_from_usage
    # 模板变量:
    # - {word}: 当前查询单词
    # - {context}: 页面上选中的英文原句
    # - {page_type}: 当前页面类型（例如 article, video 等；可能为 "unknown"）
    # - {url}: 当前页面 URL（可能为 "unknown"）
    # - {usage_summary}: 由 usage_summary_template 渲染出的最近一次使用摘要
    # - {existing_for_prompt}: 当前已存兴趣主题列表（Python list，会以 repr 形式插入）
    # - {blocked_titles}: 已被用户删除、不应再出现的 topic 标题列表
    "summarize_interests": {
        "system_prompt": (
            "You are an assistant that organizes a single learner's reading "
            "interests into a few stable topics."
        ),
        "usage_summary_template": """Latest LexiLens usage:
- word: {word}
- context: {context}
- page_type: {page_type}
- url: {url}
""",
        "user_prompt_template": """{usage_summary}

Existing topics (may be empty). Each has an id, title, summary and example URLs:
{existing_for_prompt}

Blocked titles (topics removed by the user; NEVER bring them back): {blocked_titles}

Task:
1. Decide whether this latest usage should:
   - be merged into one existing topic, or
   - create a new topic, or
   - be ignored if it does not represent a meaningful interest.
2. Always return the FULL list of topics the extension should store after this update.
3. Each topic object must contain:
   - id: short stable identifier (slug-like, no spaces, e.g. "football_premier_league").
   - title: short Chinese or bilingual title describing the interest.
   - summary: 1 short sentence in Chinese describing what the learner does or follows.
   - urls: array of URLs (strings) belonging to this topic. Include the latest URL when appropriate.
4. If you update an existing topic, keep its id exactly the same.
5. Never create or return topics whose title is in the blocked titles list.

Return ONLY a JSON array of topic objects, without any surrounding explanation.""",
    },

    # Lexical map image generation: XKCD-style colored manga explaining two words.
    # 使用位置:
    # - app.api.routes.lexical_map.generate_lexical_image
    # 模板变量:
    # - {base_word}: 词汇图中的基准单词
    # - {related_word}: 与之对比的相关单词
    "lexical_image": {
        "prompt_template": (
            'Draw an XKCD style colored manga depicting and explaining the difference '
            'between the word "{base_word}" and "{related_word}" to learners using English, '
            'with "LexiLens" written at the bottom right corner without any logos or icons'
        ),
    },
}

