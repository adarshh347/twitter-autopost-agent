"""
Taste Engine v2 - Advanced Image Selection Rules.

Evaluates images based on aesthetic rules:
- Hard rejection rules (instant disqualification)
- Soft scoring rules (add/subtract points)
"""

import logging
from typing import List, Dict, Any, Optional

from .models import (
    ImageMetadata, 
    ImageAnalysis,
    TasteScore, 
    TasteRule, 
    TasteRuleType,
    CuratorConfig
)

logger = logging.getLogger(__name__)


# Default Taste Rules
DEFAULT_HARD_REJECTION_RULES = [
    TasteRule(
        rule_id="too_bright",
        name="Too Bright",
        rule_type=TasteRuleType.HARD_REJECT,
        condition_field="brightness",
        condition_operator="gt",
        condition_value=0.90,
        rejection_message="Image is overexposed/too bright"
    ),
    TasteRule(
        rule_id="oversaturated",
        name="Oversaturated",
        rule_type=TasteRuleType.HARD_REJECT,
        condition_field="saturation",
        condition_operator="gt",
        condition_value=0.85,
        rejection_message="Colors are oversaturated (tourist-photo quality)"
    ),
    TasteRule(
        rule_id="too_dark",
        name="Too Dark",
        rule_type=TasteRuleType.HARD_REJECT,
        condition_field="brightness",
        condition_operator="lt",
        condition_value=0.08,
        rejection_message="Image is too dark to read"
    ),
]

DEFAULT_SOFT_PENALTY_RULES = [
    TasteRule(
        rule_id="high_brightness_penalty",
        name="Slightly Bright",
        rule_type=TasteRuleType.SOFT_PENALTY,
        condition_field="brightness",
        condition_operator="gt",
        condition_value=0.80,
        score_modifier=-10
    ),
    TasteRule(
        rule_id="high_saturation_penalty",
        name="High Saturation",
        rule_type=TasteRuleType.SOFT_PENALTY,
        condition_field="saturation",
        condition_operator="gt",
        condition_value=0.70,
        score_modifier=-15
    ),
    TasteRule(
        rule_id="low_contrast_penalty",
        name="Low Contrast",
        rule_type=TasteRuleType.SOFT_PENALTY,
        condition_field="contrast",
        condition_operator="lt",
        condition_value=0.20,
        score_modifier=-10
    ),
    TasteRule(
        rule_id="noisy_image_penalty",
        name="Noisy Image",
        rule_type=TasteRuleType.SOFT_PENALTY,
        condition_field="noise_level",
        condition_operator="gt",
        condition_value=0.50,
        score_modifier=-15
    ),
]

DEFAULT_SOFT_BONUS_RULES = [
    TasteRule(
        rule_id="muted_tones_bonus",
        name="Muted Tones",
        rule_type=TasteRuleType.SOFT_BONUS,
        condition_field="saturation",
        condition_operator="lt",
        condition_value=0.40,
        score_modifier=15
    ),
    TasteRule(
        rule_id="balanced_brightness_bonus",
        name="Balanced Brightness",
        rule_type=TasteRuleType.SOFT_BONUS,
        condition_field="brightness",
        condition_operator="lt",
        condition_value=0.60,
        score_modifier=10
    ),
    TasteRule(
        rule_id="good_contrast_bonus",
        name="Good Contrast",
        rule_type=TasteRuleType.SOFT_BONUS,
        condition_field="contrast",
        condition_operator="gt",
        condition_value=0.40,
        score_modifier=10
    ),
    TasteRule(
        rule_id="clean_image_bonus",
        name="Clean/Sharp Image",
        rule_type=TasteRuleType.SOFT_BONUS,
        condition_field="noise_level",
        condition_operator="lt",
        condition_value=0.20,
        score_modifier=10
    ),
    TasteRule(
        rule_id="rule_of_thirds_bonus",
        name="Rule of Thirds Composition",
        rule_type=TasteRuleType.SOFT_BONUS,
        condition_field="composition",
        condition_operator="eq",
        condition_value="rule_of_thirds",
        score_modifier=12
    ),
    TasteRule(
        rule_id="closeup_bonus",
        name="Closeup Composition",
        rule_type=TasteRuleType.SOFT_BONUS,
        condition_field="composition",
        condition_operator="eq",
        condition_value="closeup",
        score_modifier=8
    ),
]


def _check_condition(value: Any, operator: str, target: Any) -> bool:
    """Check if a value matches a condition."""
    try:
        if operator == "gt":
            return value > target
        elif operator == "lt":
            return value < target
        elif operator == "eq":
            if hasattr(value, 'value'):
                return value.value == target
            return value == target
        elif operator == "contains":
            return target in str(value).lower()
        elif operator == "not_contains":
            return target not in str(value).lower()
        else:
            return False
    except Exception as e:
        logger.error(f"Error checking condition: {e}")
        return False


def _get_field_value(metadata: ImageMetadata, field: str) -> Any:
    """Get a field value from ImageMetadata."""
    if hasattr(metadata, field):
        return getattr(metadata, field)
    return None


def evaluate_image_taste(
    metadata: ImageMetadata,
    analysis: Optional[ImageAnalysis] = None,
    config: Optional[CuratorConfig] = None
) -> TasteScore:
    """
    Evaluate an image against taste rules.
    
    Args:
        metadata: Low-level image features
        analysis: Optional LLM analysis
        config: Optional curator configuration
        
    Returns:
        TasteScore with evaluation results
    """
    config = config or CuratorConfig()
    
    # Start with base score
    base_score = 50
    if analysis and analysis.aura_score:
        # Weight the LLM score heavily
        base_score = analysis.aura_score
    
    rejection_reasons = []
    bonus_reasons = []
    applied_rules = []
    
    # Check hard rejection rules
    all_rules = DEFAULT_HARD_REJECTION_RULES + DEFAULT_SOFT_PENALTY_RULES + DEFAULT_SOFT_BONUS_RULES
    
    for rule in all_rules:
        field_value = _get_field_value(metadata, rule.condition_field)
        if field_value is None:
            continue
        
        if _check_condition(field_value, rule.condition_operator, rule.condition_value):
            applied_rules.append({
                "rule_id": rule.rule_id,
                "name": rule.name,
                "type": rule.rule_type.value,
                "score_change": rule.score_modifier
            })
            
            if rule.rule_type == TasteRuleType.HARD_REJECT:
                rejection_reasons.append(rule.rejection_message or rule.name)
            elif rule.rule_type == TasteRuleType.SOFT_PENALTY:
                base_score += rule.score_modifier
            elif rule.rule_type == TasteRuleType.SOFT_BONUS:
                base_score += rule.score_modifier
                bonus_reasons.append(rule.name)
    
    # Clamp score
    final_score = max(0, min(100, base_score))
    
    # Determine if approved
    is_approved = len(rejection_reasons) == 0 and final_score >= config.min_aura_score
    
    # Get recommendations from analysis
    recommended_families = []
    recommended_archetypes = []
    if analysis:
        recommended_families = analysis.tweet_family_fit[:3] if analysis.tweet_family_fit else []
        recommended_archetypes = analysis.suggested_archetypes[:3] if analysis.suggested_archetypes else []
    
    return TasteScore(
        image_id=metadata.image_id,
        is_approved=is_approved,
        final_score=final_score,
        applied_rules=applied_rules,
        rejection_reasons=rejection_reasons,
        bonus_reasons=bonus_reasons,
        recommended_families=recommended_families,
        recommended_archetypes=recommended_archetypes
    )


def quick_taste_check(metadata: ImageMetadata, config: Optional[CuratorConfig] = None) -> Dict[str, Any]:
    """
    Quick check without full analysis - just hard rejection rules.
    
    Args:
        metadata: Image metadata
        config: Optional configuration
        
    Returns:
        Dict with 'approved' and 'reasons'
    """
    config = config or CuratorConfig()
    
    # Check overrides from config
    if metadata.brightness > config.brightness_max:
        return {
            "approved": False,
            "reasons": [f"Brightness {metadata.brightness:.2f} exceeds max {config.brightness_max}"]
        }
    
    if metadata.saturation > config.saturation_max:
        return {
            "approved": False,
            "reasons": [f"Saturation {metadata.saturation:.2f} exceeds max {config.saturation_max}"]
        }
    
    # Check hard rejection rules
    for rule in DEFAULT_HARD_REJECTION_RULES:
        field_value = _get_field_value(metadata, rule.condition_field)
        if field_value is not None:
            if _check_condition(field_value, rule.condition_operator, rule.condition_value):
                return {
                    "approved": False,
                    "reasons": [rule.rejection_message or rule.name]
                }
    
    return {"approved": True, "reasons": []}


def get_taste_summary(score: TasteScore) -> str:
    """Generate a human-readable summary of the taste evaluation."""
    lines = []
    
    if score.is_approved:
        lines.append(f"✅ Approved (Score: {score.final_score}/100)")
    else:
        lines.append(f"❌ Rejected (Score: {score.final_score}/100)")
    
    if score.rejection_reasons:
        lines.append("\nRejection Reasons:")
        for reason in score.rejection_reasons:
            lines.append(f"  - {reason}")
    
    if score.bonus_reasons:
        lines.append("\nPositive Qualities:")
        for reason in score.bonus_reasons:
            lines.append(f"  + {reason}")
    
    if score.recommended_families:
        lines.append(f"\nRecommended Families: {', '.join(score.recommended_families)}")
    
    if score.recommended_archetypes:
        lines.append(f"Suggested Archetypes: {', '.join(score.recommended_archetypes)}")
    
    return "\n".join(lines)
