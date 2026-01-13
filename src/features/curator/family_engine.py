"""
Tweet Family Engine.

Manages the 5 canonical tweet families for identity coherence:
1. Power/Psychology/Collapse
2. Memory/Place/Interiority
3. Time/Decay/Endurance
4. Culture/Aesthetic/Form
5. Personal/Intelligence/Fragment
"""

import logging
from typing import List, Optional, Dict
from datetime import datetime, timedelta

from .models import TweetFamily, TweetFamilyType, ImageAnalysis

logger = logging.getLogger(__name__)


# Default tweet family definitions
DEFAULT_FAMILIES: Dict[str, TweetFamily] = {
    "power_psychology_collapse": TweetFamily(
        family_id="power_psychology_collapse",
        name="Power/Psychology/Collapse",
        display_name="Power & Psychology",
        core_themes=[
            "power dynamics", "psychological depth", "societal collapse",
            "authority", "control", "manipulation", "decline", "hubris",
            "leadership", "dominance", "fall from grace"
        ],
        tone_profile=["authoritative", "dark", "analytical", "unflinching"],
        compatible_image_styles=[
            "architectural grandeur", "ruins", "corporate", "shadows",
            "monuments", "empty thrones", "stark contrasts"
        ],
        forbidden_image_styles=[
            "bright pastoral", "cute animals", "tourist selfies",
            "food photography", "memes"
        ],
        archetypes_allowed=[
            "aphorism", "psychoanalytic_reflection", "historical_parallel",
            "cultural_analysis"
        ],
        related_families=["memory_place_interiority", "time_decay_endurance"]
    ),
    
    "memory_place_interiority": TweetFamily(
        family_id="memory_place_interiority",
        name="Memory/Place/Interiority",
        display_name="Memory & Place",
        core_themes=[
            "memory", "nostalgia", "place", "interiority", "home",
            "belonging", "displacement", "the past", "inner life",
            "solitude", "reflection", "identity"
        ],
        tone_profile=["introspective", "melancholic", "gentle", "personal"],
        compatible_image_styles=[
            "empty rooms", "old photographs", "landscapes", "windows",
            "interiors", "twilight", "fog", "doorways", "paths"
        ],
        forbidden_image_styles=[
            "action shots", "crowds", "flashy", "neon", "busy scenes"
        ],
        archetypes_allowed=[
            "existential_fragment", "phenomenological_description",
            "personal_insight", "minimal_observation"
        ],
        related_families=["power_psychology_collapse", "time_decay_endurance"]
    ),
    
    "time_decay_endurance": TweetFamily(
        family_id="time_decay_endurance",
        name="Time/Decay/Endurance",
        display_name="Time & Endurance",
        core_themes=[
            "time", "decay", "endurance", "persistence", "mortality",
            "aging", "erosion", "permanence", "cycles", "entropy",
            "weathering", "patience"
        ],
        tone_profile=["contemplative", "stoic", "patient", "observant"],
        compatible_image_styles=[
            "weathered textures", "ancient structures", "nature reclaiming",
            "patina", "worn objects", "old hands", "seasons"
        ],
        forbidden_image_styles=[
            "new and shiny", "plastic", "artificial", "pristine"
        ],
        archetypes_allowed=[
            "aphorism", "existential_fragment", "phenomenological_description",
            "minimal_observation"
        ],
        related_families=["memory_place_interiority", "culture_aesthetic_form"]
    ),
    
    "culture_aesthetic_form": TweetFamily(
        family_id="culture_aesthetic_form",
        name="Culture/Aesthetic/Form",
        display_name="Culture & Aesthetics",
        core_themes=[
            "culture", "aesthetics", "form", "beauty", "art",
            "craft", "design", "composition", "taste", "refinement",
            "tradition", "innovation"
        ],
        tone_profile=["refined", "discerning", "appreciative", "analytical"],
        compatible_image_styles=[
            "classical art", "sculpture", "architecture", "design objects",
            "typography", "museums", "galleries", "craftsmanship"
        ],
        forbidden_image_styles=[
            "ugly", "kitsch", "cluttered", "low effort"
        ],
        archetypes_allowed=[
            "cultural_analysis", "aphorism", "phenomenological_description",
            "rhetorical_question"
        ],
        related_families=["time_decay_endurance", "personal_intelligence_fragment"]
    ),
    
    "personal_intelligence_fragment": TweetFamily(
        family_id="personal_intelligence_fragment",
        name="Personal/Intelligence/Fragment",
        display_name="Personal Fragments",
        core_themes=[
            "personal observation", "intelligence", "fragments", "wit",
            "insight", "everyday", "ordinary", "noticing", "awareness",
            "connection", "humanity"
        ],
        tone_profile=["conversational", "witty", "warm", "observant"],
        compatible_image_styles=[
            "everyday moments", "street scenes", "portraits", "details",
            "light and shadow", "human gestures", "found objects"
        ],
        forbidden_image_styles=[
            "pretentious", "overly staged", "stock photo", "generic"
        ],
        archetypes_allowed=[
            "personal_insight", "minimal_observation", "rhetorical_question",
            "aphorism"
        ],
        related_families=["culture_aesthetic_form", "memory_place_interiority"]
    )
}


def get_all_families() -> List[TweetFamily]:
    """Get all default tweet families."""
    return list(DEFAULT_FAMILIES.values())


def get_family_by_id(family_id: str) -> Optional[TweetFamily]:
    """Get a specific family by its ID."""
    return DEFAULT_FAMILIES.get(family_id)


def get_family_for_analysis(analysis: ImageAnalysis) -> Optional[TweetFamily]:
    """
    Select the best matching family based on image analysis.
    
    Args:
        analysis: LLM-generated image analysis
        
    Returns:
        Best matching TweetFamily
    """
    if not analysis.tweet_family_fit:
        return None
    
    # Map analysis family names to our family IDs
    family_mapping = {
        "Power/Psychology": "power_psychology_collapse",
        "Power/Psychology/Collapse": "power_psychology_collapse",
        "Memory/Place": "memory_place_interiority",
        "Memory/Place/Interiority": "memory_place_interiority",
        "Time/Decay": "time_decay_endurance",
        "Time/Decay/Endurance": "time_decay_endurance",
        "Culture/Aesthetic": "culture_aesthetic_form",
        "Culture/Aesthetic/Form": "culture_aesthetic_form",
        "Personal/Fragment": "personal_intelligence_fragment",
        "Personal/Intelligence": "personal_intelligence_fragment",
        "Personal/Intelligence/Fragment": "personal_intelligence_fragment"
    }
    
    for fit in analysis.tweet_family_fit:
        # Try exact match first
        if fit in family_mapping:
            return DEFAULT_FAMILIES.get(family_mapping[fit])
        
        # Try partial match
        for key, family_id in family_mapping.items():
            if fit.lower() in key.lower() or key.lower() in fit.lower():
                return DEFAULT_FAMILIES.get(family_id)
    
    # Default to culture/aesthetic if no match
    return DEFAULT_FAMILIES.get("culture_aesthetic_form")


def select_family_for_posting(
    analysis: ImageAnalysis,
    recent_families: List[str],
    min_gap_hours: int = 24
) -> Optional[TweetFamily]:
    """
    Select a family for posting, considering recent usage to maintain variety.
    
    Args:
        analysis: Image analysis with family suggestions
        recent_families: List of recently used family IDs (most recent first)
        min_gap_hours: Minimum hours before reusing a family
        
    Returns:
        Selected TweetFamily for this post
    """
    # Get primary family from analysis
    primary_family = get_family_for_analysis(analysis)
    
    if not primary_family:
        # Pick least recently used family
        for family_id, family in DEFAULT_FAMILIES.items():
            if family_id not in recent_families:
                return family
        return list(DEFAULT_FAMILIES.values())[0]
    
    # Check if primary family was used recently
    if primary_family.family_id not in recent_families[:3]:
        return primary_family
    
    # Try to find a related family that fits
    for related_id in primary_family.related_families:
        if related_id not in recent_families[:2]:
            related_family = DEFAULT_FAMILIES.get(related_id)
            if related_family:
                # Check if the image somewhat fits the related family
                return related_family
    
    # If all preferred options are recent, still use the best match
    return primary_family


def check_image_family_compatibility(
    metadata_or_analysis,
    family: TweetFamily
) -> Dict[str, any]:
    """
    Check how well an image fits a specific family.
    
    Returns dict with:
        - compatible: bool
        - score: 0-100
        - reasons: list of reasons
    """
    result = {
        "compatible": True,
        "score": 50,
        "reasons": []
    }
    
    # If we have ImageAnalysis, use its suggestions
    if hasattr(metadata_or_analysis, 'tweet_family_fit'):
        analysis = metadata_or_analysis
        
        # Check if family is in the fit list
        family_names = [family.name, family.display_name, family.family_id]
        for fit in analysis.tweet_family_fit:
            for name in family_names:
                if name.lower() in fit.lower() or fit.lower() in name.lower():
                    result["score"] += 30
                    result["reasons"].append(f"Image analysis suggests {fit}")
                    break
        
        # Check aura score
        if analysis.aura_score >= 70:
            result["score"] += 10
            result["reasons"].append("High aesthetic quality")
        elif analysis.aura_score < 50:
            result["score"] -= 20
            result["reasons"].append("Low aesthetic quality")
    
    # Cap score at 100
    result["score"] = min(result["score"], 100)
    result["compatible"] = result["score"] >= 40
    
    return result
