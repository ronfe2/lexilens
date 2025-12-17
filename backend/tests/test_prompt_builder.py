from app.services.prompt_builder import PromptBuilder


def test_layer4_prompt_includes_personalization_when_strategy_in_history():
  """Personalized scaffolding should be enabled for the demo 'strategy' → 'tactic' flow."""
  system, prompt = PromptBuilder.build_layer4_prompt(
      word="tactic",
      context="We need to rethink our campaign tactic before the next debate.",
      learning_history=["strategy", "implement"],
  )

  # System prompt stays generic but non-empty
  assert "vocabulary coach" in system.lower()

  # The user prompt should explicitly mention the personalization instructions
  assert 'previously learned "strategy"' in prompt
  assert '"personalized"' in prompt


def test_layer4_prompt_without_history_is_generic():
  """When there is no learning history, personalization must be disabled."""
  _, prompt = PromptBuilder.build_layer4_prompt(
      word="tactic",
      context="We need to rethink our campaign tactic before the next debate.",
      learning_history=[],
  )

  assert "previously learned" not in prompt
  assert '"personalized"' not in prompt

