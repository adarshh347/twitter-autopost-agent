"""
Tweet Archetype Templates.

Defines the structural patterns for different types of tweets:
1. Aphorism
2. Psychoanalytic Reflection
3. Historical Parallel
4. Existential Fragment
5. Phenomenological Description
6. Cultural Analysis
7. Personal Insight
8. Minimal Observation
9. Rhetorical Question
"""

import logging
from typing import List, Optional, Dict

from .models import TweetArchetype, TweetArchetypeType

logger = logging.getLogger(__name__)


# Default archetype definitions
DEFAULT_ARCHETYPES: Dict[str, TweetArchetype] = {
    "aphorism": TweetArchetype(
        archetype_id="aphorism",
        name="Aphorism",
        archetype_type=TweetArchetypeType.APHORISM,
        template_structure="""[Observation in 1-2 lines]
[Contrasting or deepening clause]""",
        example_tweets=[
            "The architect of his own prison admires the symmetry of the bars.",
            "Silence is not absence. It is the space where truth assembles itself.",
            "We collect what we cannot become."
        ],
        max_length=180,
        requires_image=False,
        tone_requirements=["concise", "memorable", "paradoxical"],
        compatible_families=["power_psychology_collapse", "time_decay_endurance", "culture_aesthetic_form"]
    ),
    
    "psychoanalytic_reflection": TweetArchetype(
        archetype_id="psychoanalytic_reflection",
        name="Psychoanalytic Reflection",
        archetype_type=TweetArchetypeType.PSYCHOANALYTIC,
        template_structure="""[Describe inner conflict or behavior]
[Reveal hidden motive or pattern]
[Tie to broader human experience]""",
        example_tweets=[
            "The compulsion to explain ourselves to those who never asked—this is the wound speaking to the knife.",
            "Every collection is a museum of abandoned selves.",
            "We rehearse our exits in the mirror of others' departures."
        ],
        max_length=280,
        requires_image=False,
        tone_requirements=["analytical", "introspective", "revealing"],
        compatible_families=["power_psychology_collapse", "memory_place_interiority"]
    ),
    
    "historical_parallel": TweetArchetype(
        archetype_id="historical_parallel",
        name="Historical Parallel",
        archetype_type=TweetArchetypeType.HISTORICAL_PARALLEL,
        template_structure="""[State historical event or figure]
[Extract psychological or philosophical insight]
[Generalize to human nature or present day]""",
        example_tweets=[
            "Marcus Aurelius wrote his meditations while commanding armies. The battle within always dwarfs the one without.",
            "The Library of Alexandria didn't burn in a day. It was abandoned by degrees."
        ],
        max_length=280,
        requires_image=False,
        tone_requirements=["erudite", "insightful", "timeless"],
        compatible_families=["power_psychology_collapse", "time_decay_endurance", "culture_aesthetic_form"]
    ),
    
    "existential_fragment": TweetArchetype(
        archetype_id="existential_fragment",
        name="Existential Fragment",
        archetype_type=TweetArchetypeType.EXISTENTIAL_FRAGMENT,
        template_structure="""[Brief observation about existence]
[Optional: deeper implication]""",
        example_tweets=[
            "The morning arrives whether or not you were ready for yesterday to end.",
            "Between intention and action: the self we never became.",
            "Some doors close so quietly you only notice years later."
        ],
        max_length=200,
        requires_image=True,
        tone_requirements=["contemplative", "sparse", "haunting"],
        compatible_families=["memory_place_interiority", "time_decay_endurance"]
    ),
    
    "phenomenological_description": TweetArchetype(
        archetype_id="phenomenological_description",
        name="Phenomenological Description",
        archetype_type=TweetArchetypeType.PHENOMENOLOGICAL,
        template_structure="""[Describe a specific sensory or experiential moment]
[Let the description carry its own weight]""",
        example_tweets=[
            "The particular quality of light through dusty glass—neither inside nor outside, but the space between them.",
            "Stone worn smooth by centuries of hands. Each touch anonymous, yet present.",
            "The sound of a key in an empty house."
        ],
        max_length=220,
        requires_image=True,
        tone_requirements=["sensory", "precise", "evocative"],
        compatible_families=["memory_place_interiority", "time_decay_endurance", "culture_aesthetic_form"]
    ),
    
    "cultural_analysis": TweetArchetype(
        archetype_id="cultural_analysis",
        name="Cultural Analysis",
        archetype_type=TweetArchetypeType.CULTURAL_ANALYSIS,
        template_structure="""[Identify cultural phenomenon or trend]
[Analyze what it reveals]
[Optional: implication or question]""",
        example_tweets=[
            "The rise of 'authentic' as a marketing term signals its complete commercialization.",
            "We've replaced craftsmanship with content. The difference is in what remains.",
            "Every aesthetic movement is also a rejection. Minimalism says no to excess; brutalism says no to comfort."
        ],
        max_length=280,
        requires_image=False,
        tone_requirements=["analytical", "critical", "perceptive"],
        compatible_families=["culture_aesthetic_form", "power_psychology_collapse"]
    ),
    
    "personal_insight": TweetArchetype(
        archetype_id="personal_insight",
        name="Personal Insight",
        archetype_type=TweetArchetypeType.PERSONAL_INSIGHT,
        template_structure="""[Share observation or realization]
[Ground it in specific detail]""",
        example_tweets=[
            "I've stopped collecting books I'll read 'someday.' The shelf has become honest.",
            "The best conversations I have are with people who disagree quietly.",
            "Learning a new city is just learning new ways to be lost."
        ],
        max_length=240,
        requires_image=False,
        tone_requirements=["conversational", "genuine", "specific"],
        compatible_families=["personal_intelligence_fragment", "memory_place_interiority"]
    ),
    
    "minimal_observation": TweetArchetype(
        archetype_id="minimal_observation",
        name="Minimal Observation",
        archetype_type=TweetArchetypeType.MINIMAL_OBSERVATION,
        template_structure="""[Single precise observation]""",
        example_tweets=[
            "Empty chairs in winter sun.",
            "The weight of a key to a house you've left.",
            "Old letters in someone else's handwriting."
        ],
        max_length=100,
        requires_image=True,
        tone_requirements=["spare", "suggestive", "imagistic"],
        compatible_families=["memory_place_interiority", "time_decay_endurance", "personal_intelligence_fragment"]
    ),
    
    "rhetorical_question": TweetArchetype(
        archetype_id="rhetorical_question",
        name="Rhetorical Question",
        archetype_type=TweetArchetypeType.RHETORICAL_QUESTION,
        template_structure="""[Pose a question that reveals more than it asks]""",
        example_tweets=[
            "What would you keep if you could only keep what you actually use?",
            "When did 'having an opinion' become a personality?",
            "Is nostalgia love or grief?"
        ],
        max_length=150,
        requires_image=False,
        tone_requirements=["provocative", "open", "thoughtful"],
        compatible_families=["culture_aesthetic_form", "personal_intelligence_fragment"]
    )
}


def get_all_archetypes() -> List[TweetArchetype]:
    """Get all default archetypes."""
    return list(DEFAULT_ARCHETYPES.values())


def get_archetype_by_id(archetype_id: str) -> Optional[TweetArchetype]:
    """Get a specific archetype by its ID."""
    return DEFAULT_ARCHETYPES.get(archetype_id)


def get_archetypes_for_family(family_id: str) -> List[TweetArchetype]:
    """Get all archetypes compatible with a specific family."""
    compatible = []
    for archetype in DEFAULT_ARCHETYPES.values():
        if family_id in archetype.compatible_families:
            compatible.append(archetype)
    return compatible


def select_archetype_for_image(
    analysis,
    family_id: str,
    has_image: bool = True,
    recent_archetypes: List[str] = None
) -> Optional[TweetArchetype]:
    """
    Select the best archetype based on image analysis and family.
    
    Args:
        analysis: ImageAnalysis with suggested archetypes
        family_id: The selected tweet family
        has_image: Whether the tweet will include an image
        recent_archetypes: List of recently used archetype IDs
        
    Returns:
        Selected TweetArchetype
    """
    recent_archetypes = recent_archetypes or []
    
    # Get archetypes compatible with the family
    family_archetypes = get_archetypes_for_family(family_id)
    
    if not family_archetypes:
        # Fallback to all archetypes
        family_archetypes = list(DEFAULT_ARCHETYPES.values())
    
    # Filter by image requirement
    if has_image:
        # All archetypes work with images
        pass
    else:
        # Filter out archetypes that require images
        family_archetypes = [a for a in family_archetypes if not a.requires_image]
    
    if not family_archetypes:
        return DEFAULT_ARCHETYPES.get("aphorism")
    
    # Check analysis suggestions
    if hasattr(analysis, 'suggested_archetypes') and analysis.suggested_archetypes:
        for suggested in analysis.suggested_archetypes:
            for archetype in family_archetypes:
                if suggested.lower() in archetype.archetype_id.lower():
                    if archetype.archetype_id not in recent_archetypes[:2]:
                        return archetype
    
    # Pick one not recently used
    for archetype in family_archetypes:
        if archetype.archetype_id not in recent_archetypes[:3]:
            return archetype
    
    return family_archetypes[0]


def get_generation_prompt_for_archetype(
    archetype: TweetArchetype,
    image_analysis=None,
    family=None
) -> str:
    """
    Generate a prompt for the LLM to create a tweet in this archetype style.
    
    Args:
        archetype: The archetype to use
        image_analysis: Optional ImageAnalysis for context
        family: Optional TweetFamily for thematic guidance
        
    Returns:
        Prompt string for tweet generation
    """
    prompt_parts = []
    
    prompt_parts.append(f"Write a tweet in the '{archetype.name}' style.")
    prompt_parts.append(f"\nStructure: {archetype.template_structure}")
    prompt_parts.append(f"\nTone: {', '.join(archetype.tone_requirements)}")
    prompt_parts.append(f"\nMax length: {archetype.max_length} characters")
    
    if archetype.example_tweets:
        prompt_parts.append("\nExamples:")
        for example in archetype.example_tweets[:2]:
            prompt_parts.append(f"- \"{example}\"")
    
    if image_analysis:
        prompt_parts.append(f"\nImage mood: {image_analysis.mood_description}")
        if image_analysis.symbolic_elements:
            prompt_parts.append(f"Symbolic elements: {', '.join(image_analysis.symbolic_elements[:3])}")
        if image_analysis.philosophical_resonance:
            prompt_parts.append(f"Themes: {', '.join(image_analysis.philosophical_resonance[:3])}")
    
    if family:
        prompt_parts.append(f"\nFamily themes: {', '.join(family.core_themes[:5])}")
    
    prompt_parts.append("\n\nWrite only the tweet text, nothing else.")
    
    return "\n".join(prompt_parts)
