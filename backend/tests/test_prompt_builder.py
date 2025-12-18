from app.services.prompt_builder import PromptBuilder


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
