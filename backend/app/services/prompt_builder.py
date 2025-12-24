from __future__ import annotations

from typing import List, Optional

from app.prompt_config import PROMPT_CONFIG
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
    def _build_level_note(layer_key: str, english_level: str | None) -> str:
        """
        Build the CEFR-level-specific note for a given prompt layer based on config.
        """
        if not english_level:
            return ""

        band = PromptBuilder._get_level_band(english_level)
        layer_cfg = PROMPT_CONFIG.get(layer_key, {})
        level_cfg = layer_cfg.get("level_notes") or {}

        template = level_cfg.get(band) or level_cfg.get("unknown")
        if not template:
            return ""

        return template.format(english_level=english_level)

    @staticmethod
    def build_layer1_prompt(
        word: str,
        context: str,
        english_level: str | None = None
    ) -> tuple[str, str]:
        layer_cfg = PROMPT_CONFIG["layer1"]
        system_prompt = layer_cfg["system_prompt"]

        level_note = PromptBuilder._build_level_note("layer1", english_level)

        user_prompt = layer_cfg["user_prompt_template"].format(
            word=word,
            context=context,
            level_note=level_note,
        )

        return system_prompt, user_prompt

    @staticmethod
    def build_layer2_prompt(word: str, context: str) -> tuple[str, str]:
        layer_cfg = PROMPT_CONFIG["layer2"]
        system_prompt = layer_cfg["system_prompt"]

        user_prompt = layer_cfg["user_prompt_template"].format(
            word=word,
            context=context,
        )

        return system_prompt, user_prompt

    @staticmethod
    def build_layer3_prompt(
        word: str,
        context: str,
        english_level: str | None = None,
    ) -> tuple[str, str]:
        layer_cfg = PROMPT_CONFIG["layer3"]
        system_prompt = layer_cfg["system_prompt"]

        level_note = PromptBuilder._build_level_note("layer3", english_level)

        user_prompt = layer_cfg["user_prompt_template"].format(
            word=word,
            context=context,
            level_note=level_note,
        )

        return system_prompt, user_prompt

    @staticmethod
    def build_layer4_prompt(
        word: str,
        context: str,
        learning_history: list[str] | None = None,
        english_level: str | None = None,
        interests: Optional[List[InterestTopicPayload]] = None,
        blocked_titles: Optional[List[str]] = None,
        favorite_words: Optional[List[str]] = None,
    ) -> tuple[str, str]:
        layer_cfg = PROMPT_CONFIG["layer4"]
        system_prompt = layer_cfg["system_prompt"]

        history_note = ""
        if learning_history:
            history_preview = ", ".join(learning_history[:10])
            history_note = layer_cfg["history_note_template"].format(
                history_preview=history_preview
            )

        level_note = PromptBuilder._build_level_note("layer4", english_level)

        favorites_note = ""
        if favorite_words:
            favorites_preview = ", ".join(favorite_words[:10])
            template = layer_cfg.get("favorites_note_template")
            if template:
                favorites_note = template.format(
                    favorites_preview=favorites_preview
                )

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
            interests_note = layer_cfg["interests_with_topics_template"].format(
                joined=joined,
                word=word,
            )
        else:
            interests_note = layer_cfg["interests_without_topics_template"]

        blocklist_note = ""
        if blocked_titles:
            blocked_preview = ", ".join(blocked_titles[:5])
            blocklist_note = layer_cfg["blocklist_note_template"].format(
                blocked_preview=blocked_preview
            )

        user_prompt = layer_cfg["user_prompt_template"].format(
            word=word,
            context=context,
            learning_history=learning_history or [],
            history_note=history_note,
            level_note=level_note,
            interests_note=interests_note,
            blocklist_note=blocklist_note,
            favorites_note=favorites_note,
        )

        return system_prompt, user_prompt

    @staticmethod
    def get_all_prompts(
        word: str,
        context: str,
        learning_history: list[str] | None = None,
        english_level: str | None = None,
        interests: Optional[List[InterestTopicPayload]] = None,
        blocked_titles: Optional[List[str]] = None,
        favorite_words: Optional[List[str]] = None,
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
                favorite_words,
            ),
        }
