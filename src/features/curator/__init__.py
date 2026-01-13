"""
Aesthetic Tweet Curator Module

This module provides AI-powered image curation, analysis, and tweet generation
with deep aesthetic understanding, tweet family coherence, and philosophical depth.
"""

from .models import (
    ImageMetadata,
    ImageAnalysis,
    TweetFamily,
    TweetArchetype,
    TasteScore,
    CuratorConfig,
    GeneratedTweet,
)
from .curator_service import CuratorService, get_curator_service
from .family_engine import get_all_families, get_family_by_id
from .archetypes import get_all_archetypes, get_archetype_by_id
from .taste_engine import evaluate_image_taste, get_taste_summary
from .image_processor import extract_image_features

__all__ = [
    # Models
    "ImageMetadata",
    "ImageAnalysis", 
    "TweetFamily",
    "TweetArchetype",
    "TasteScore",
    "CuratorConfig",
    "GeneratedTweet",
    # Service
    "CuratorService",
    "get_curator_service",
    # Helpers
    "get_all_families",
    "get_family_by_id",
    "get_all_archetypes",
    "get_archetype_by_id",
    "evaluate_image_taste",
    "get_taste_summary",
    "extract_image_features",
]
