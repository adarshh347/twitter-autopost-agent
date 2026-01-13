"""
Data models for the Aesthetic Tweet Curator system.
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Literal
from datetime import datetime
from enum import Enum


class CompositionType(str, Enum):
    CENTERED = "centered"
    WIDE = "wide"
    CLOSEUP = "closeup"
    RULE_OF_THIRDS = "rule_of_thirds"
    ASYMMETRIC = "asymmetric"
    MINIMAL = "minimal"


class ImageMetadata(BaseModel):
    """Low-level image features extracted via OpenCV."""
    image_id: str
    url: Optional[str] = None
    local_path: Optional[str] = None
    
    # Color analysis
    dominant_colors: List[str] = Field(default_factory=list, description="Hex color codes")
    
    # Lighting & tone
    brightness: float = Field(0.5, ge=0, le=1, description="Overall brightness 0-1")
    contrast: float = Field(0.5, ge=0, le=1, description="Contrast level 0-1")
    saturation: float = Field(0.5, ge=0, le=1, description="Color saturation 0-1")
    noise_level: float = Field(0.0, ge=0, le=1, description="Image noise 0-1")
    
    # Composition
    composition: CompositionType = CompositionType.CENTERED
    aspect_ratio: float = Field(1.0, description="Width/height ratio")
    
    # Basic detection
    objects_detected: List[str] = Field(default_factory=list)
    raw_caption: Optional[str] = None  # From BLIP or similar
    
    # Metadata
    upload_date: datetime = Field(default_factory=datetime.utcnow)
    processed: bool = False
    file_size_bytes: Optional[int] = None
    width: Optional[int] = None
    height: Optional[int] = None


class ImageAnalysis(BaseModel):
    """LLM-generated deep analysis of an image."""
    image_id: str
    
    # Mood & Aesthetic
    mood_description: str = Field(default="", description="Short emotional tone")
    aesthetic_style: List[str] = Field(default_factory=list, description="Style descriptors")
    
    # Symbolic & Philosophical
    symbolic_elements: List[str] = Field(default_factory=list)
    philosophical_resonance: List[str] = Field(default_factory=list, description="Themes")
    
    # Tweet compatibility
    tweet_family_fit: List[str] = Field(default_factory=list, description="Best matching families")
    suggested_archetypes: List[str] = Field(default_factory=list)
    
    # Quality assessment
    strengths: List[str] = Field(default_factory=list)
    weaknesses: List[str] = Field(default_factory=list)
    aura_score: int = Field(50, ge=0, le=100, description="Overall taste rating")
    
    # Generation metadata
    analyzed_at: datetime = Field(default_factory=datetime.utcnow)
    model_used: Optional[str] = None
    raw_response: Optional[Dict[str, Any]] = None


class TweetFamilyType(str, Enum):
    POWER_PSYCHOLOGY = "power_psychology_collapse"
    MEMORY_PLACE = "memory_place_interiority"
    TIME_DECAY = "time_decay_endurance"
    CULTURE_AESTHETIC = "culture_aesthetic_form"
    PERSONAL_INTELLIGENCE = "personal_intelligence_fragment"


class TweetFamily(BaseModel):
    """Defines a canonical tweet family for identity coherence."""
    family_id: str
    name: str
    display_name: str
    
    # Thematic core
    core_themes: List[str] = Field(default_factory=list)
    tone_profile: List[str] = Field(default_factory=list)
    
    # Image compatibility
    compatible_image_styles: List[str] = Field(default_factory=list)
    forbidden_image_styles: List[str] = Field(default_factory=list)
    
    # Archetype restrictions
    archetypes_allowed: List[str] = Field(default_factory=list)
    
    # Usage tracking
    last_post_date: Optional[datetime] = None
    post_count: int = 0
    
    # Graph connections
    related_families: List[str] = Field(default_factory=list)


class TweetArchetypeType(str, Enum):
    APHORISM = "aphorism"
    PSYCHOANALYTIC = "psychoanalytic_reflection"
    HISTORICAL_PARALLEL = "historical_parallel"
    EXISTENTIAL_FRAGMENT = "existential_fragment"
    PHENOMENOLOGICAL = "phenomenological_description"
    CULTURAL_ANALYSIS = "cultural_analysis"
    PERSONAL_INSIGHT = "personal_insight"
    MINIMAL_OBSERVATION = "minimal_observation"
    RHETORICAL_QUESTION = "rhetorical_question"


class TweetArchetype(BaseModel):
    """Template pattern for tweet generation."""
    archetype_id: str
    name: str
    archetype_type: TweetArchetypeType
    
    # Structure
    template_structure: str = Field(default="", description="Template with placeholders")
    example_tweets: List[str] = Field(default_factory=list)
    
    # Constraints
    max_length: int = 280
    requires_image: bool = False
    tone_requirements: List[str] = Field(default_factory=list)
    
    # Compatibility
    compatible_families: List[str] = Field(default_factory=list)


class TasteRuleType(str, Enum):
    HARD_REJECT = "hard_reject"
    SOFT_PENALTY = "soft_penalty"
    SOFT_BONUS = "soft_bonus"


class TasteRule(BaseModel):
    """A single taste evaluation rule."""
    rule_id: str
    name: str
    rule_type: TasteRuleType
    
    # Condition
    condition_field: str
    condition_operator: Literal["gt", "lt", "eq", "contains", "not_contains"]
    condition_value: Any
    
    # Effect
    score_modifier: int = Field(0, description="Points to add/subtract")
    rejection_message: Optional[str] = None


class TasteScore(BaseModel):
    """Result of taste engine evaluation."""
    image_id: str
    
    # Overall verdict
    is_approved: bool = True
    final_score: int = Field(50, ge=0, le=100)
    
    # Breakdown
    applied_rules: List[Dict[str, Any]] = Field(default_factory=list)
    rejection_reasons: List[str] = Field(default_factory=list)
    bonus_reasons: List[str] = Field(default_factory=list)
    
    # Recommendation
    recommended_families: List[str] = Field(default_factory=list)
    recommended_archetypes: List[str] = Field(default_factory=list)
    
    evaluated_at: datetime = Field(default_factory=datetime.utcnow)


class CuratorConfig(BaseModel):
    """Configuration for the curator system."""
    min_aura_score: int = Field(60, description="Minimum score to approve image")
    brightness_max: float = Field(0.85, description="Reject if brightness exceeds")
    saturation_max: float = Field(0.80, description="Reject if saturation exceeds")
    
    # Family management
    min_family_gap_hours: int = Field(24, description="Min hours before reusing a family")
    family_diversity_window: int = Field(5, description="Check last N posts for diversity")
    
    # Archetype variety
    archetype_cooldown_posts: int = Field(3, description="Posts before reusing archetype")
    
    # LLM settings
    analysis_model: str = "llama-3.3-70b-versatile"
    generation_model: str = "llama-3.3-70b-versatile"
    analysis_temperature: float = 0.4
    generation_temperature: float = 0.7


class GeneratedTweet(BaseModel):
    """A tweet generated by the curator."""
    tweet_id: Optional[str] = None
    
    # Content
    text: str
    image_id: Optional[str] = None
    
    # Classification
    family_id: str
    archetype_id: str
    
    # Analysis reference
    image_analysis_id: Optional[str] = None
    
    # Generation metadata
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    model_used: Optional[str] = None
    prompt_used: Optional[str] = None
    
    # Status
    is_posted: bool = False
    posted_at: Optional[datetime] = None


class FamilyGraphEdge(BaseModel):
    """Relationship between two tweet families."""
    source_family: str
    target_family: str
    relationship_type: str
    strength: float = Field(0.5, ge=0, le=1)
