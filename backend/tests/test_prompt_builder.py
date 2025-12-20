from app.services.prompt_builder import PromptBuilder


def test_layer1_prompt_includes_level_and_word_limit():
    """Layer 1 prompt should mention CEFR level when provided and enforce word limit."""
    system, prompt = PromptBuilder.build_layer1_prompt(
        word="precarious",
        context="The economic situation remains precarious despite recent improvements.",
        english_level="B1",
    )

    assert "cobuild" in system.lower() or "lexicographer" in system.lower()
    assert "B1" in prompt
    assert "60 words" in prompt.lower() or "maximum 60" in prompt.lower()


def test_layer1_prompt_is_backward_compatible_without_level():
    """Layer 1 prompt should still work when english_level is omitted."""
    _, prompt = PromptBuilder.build_layer1_prompt(
        word="precarious",
        context="The economic situation remains precarious despite recent improvements.",
    )

    assert "precarious" in prompt


def test_layer4_prompt_includes_chinese_personalization_instructions():
    """Layer 4 prompt should always describe a Chinese personalized field."""
    system, prompt = PromptBuilder.build_layer4_prompt(
        word="tactic",
        context="We need to rethink our campaign tactic before the next debate.",
        learning_history=["strategy", "implement"],
    )

    # System prompt stays generic but non-empty
    assert "vocabulary coach" in system.lower()

    # The user prompt should explicitly mention the personalized field
    assert '"personalized"' in prompt
    # And it should instruct the model to answer in Simplified Chinese
    assert "简体中文" in prompt or "用简体中文" in prompt


def test_layer4_prompt_allows_personalization_without_history():
    """Even without learning history, the JSON spec should still include 'personalized'."""
    _, prompt = PromptBuilder.build_layer4_prompt(
        word="tactic",
        context="We need to rethink our campaign tactic before the next debate.",
        learning_history=[],
    )

    assert '"personalized"' in prompt


def test_layer4_prompt_mentions_level_when_provided():
    """Layer 4 prompt should reference CEFR level when given."""
    _, prompt = PromptBuilder.build_layer4_prompt(
        word="tactic",
        context="We need to rethink our campaign tactic before the next debate.",
        learning_history=["strategy", "implement"],
        english_level="B2",
    )

    assert "B2" in prompt
    assert "CEFR" in prompt or "level" in prompt.lower()
