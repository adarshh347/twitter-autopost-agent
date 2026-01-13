"""
LLM-based Image Interpretation Layer.

Uses LLM to analyze images and extract:
- Mood and emotional tone
- Aesthetic style descriptors
- Symbolic and philosophical elements
- Tweet family compatibility
- Strengths and weaknesses
- Aura score (taste rating)
"""

import json
import logging
from typing import Optional, Dict, Any
import base64

from .models import ImageMetadata, ImageAnalysis

logger = logging.getLogger(__name__)


IMAGE_ANALYSIS_PROMPT = """You are an expert visual analyst specializing in classical aesthetics and philosophical symbolism.

Analyze the image using the following extracted features:
- Brightness: {brightness}
- Contrast: {contrast}
- Saturation: {saturation}
- Composition: {composition}
- Dominant Colors: {dominant_colors}
- Aspect Ratio: {aspect_ratio}

Produce a JSON response with these exact keys:

{{
  "mood_description": "short emotional tone (e.g., 'calm, introspective')",
  "aesthetic_style": ["list", "of", "style", "descriptors"],
  "symbolic_elements": ["list", "of", "symbolic", "meanings"],
  "philosophical_resonance": ["list", "of", "philosophical", "themes"],
  "tweet_family_fit": ["Power/Psychology", "Memory/Place", "Time/Decay", "Culture/Aesthetic", "Personal/Fragment"],
  "strengths": ["list", "of", "visual", "strengths"],
  "weaknesses": ["list", "of", "potential", "issues"],
  "suggested_archetypes": ["aphorism", "existential_fragment", "cultural_analysis"],
  "aura_score": 75
}}

The tweet_family_fit should be from these 5 families:
1. Power/Psychology/Collapse - themes of power, psychological depth, societal collapse
2. Memory/Place/Interiority - themes of memory, places, inner life
3. Time/Decay/Endurance - themes of temporality, decay, persistence
4. Culture/Aesthetic/Form - themes of cultural analysis, beauty, form
5. Personal/Intelligence/Fragment - personal observations, fragmentary insights

The suggested_archetypes should be from:
- aphorism: Brief, powerful observations
- psychoanalytic_reflection: Inner conflict, hidden motives
- historical_parallel: Historical events and insights
- existential_fragment: Existential musings
- phenomenological_description: Describing experience
- cultural_analysis: Cultural commentary
- personal_insight: Personal observations
- minimal_observation: Brief, understated notes
- rhetorical_question: Provocative questions

The aura_score should be 0-100, where:
- 0-30: Unsuitable (too generic, cluttered, tourist-like)
- 31-60: Acceptable but not exceptional
- 61-80: Good aesthetic quality
- 81-100: Exceptional, museum-quality aesthetic

Return ONLY the JSON, no other text."""


async def analyze_image_with_llm(
    image_metadata: ImageMetadata,
    image_base64: str,
    groq_service,
    model: str = None
) -> Optional[ImageAnalysis]:
    """
    Analyze an image using LLM vision capabilities.
    
    Args:
        image_metadata: Extracted low-level features
        image_base64: Base64 encoded image
        groq_service: Instance of GroqService for LLM calls
        model: Optional model override
        
    Returns:
        ImageAnalysis with LLM-generated insights
    """
    try:
        # Format the prompt with image metadata
        prompt = IMAGE_ANALYSIS_PROMPT.format(
            brightness=f"{image_metadata.brightness:.2f}",
            contrast=f"{image_metadata.contrast:.2f}",
            saturation=f"{image_metadata.saturation:.2f}",
            composition=image_metadata.composition.value,
            dominant_colors=", ".join(image_metadata.dominant_colors),
            aspect_ratio=f"{image_metadata.aspect_ratio:.2f}"
        )
        
        # Use vision model for image analysis
        vision_model = model or "meta-llama/llama-4-scout-17b-16e-instruct"
        
        # Call the LLM with the image
        response = await groq_service.chat_with_image(
            messages=[{"role": "user", "content": prompt}],
            image_data=image_base64,
            model=vision_model,
            temperature=0.4,
            max_tokens=1000
        )
        
        if not response:
            logger.error("Empty response from LLM")
            return None
        
        # Parse JSON response
        try:
            # Try to extract JSON from response
            json_str = response
            if "```json" in response:
                json_str = response.split("```json")[1].split("```")[0]
            elif "```" in response:
                json_str = response.split("```")[1].split("```")[0]
            
            analysis_data = json.loads(json_str.strip())
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM response as JSON: {e}")
            logger.debug(f"Response was: {response}")
            # Create a basic analysis from the text response
            analysis_data = {
                "mood_description": "Unable to parse - see raw response",
                "aesthetic_style": [],
                "symbolic_elements": [],
                "philosophical_resonance": [],
                "tweet_family_fit": ["Culture/Aesthetic"],
                "strengths": [],
                "weaknesses": ["LLM response parsing failed"],
                "suggested_archetypes": ["minimal_observation"],
                "aura_score": 50
            }
        
        return ImageAnalysis(
            image_id=image_metadata.image_id,
            mood_description=analysis_data.get("mood_description", ""),
            aesthetic_style=analysis_data.get("aesthetic_style", []),
            symbolic_elements=analysis_data.get("symbolic_elements", []),
            philosophical_resonance=analysis_data.get("philosophical_resonance", []),
            tweet_family_fit=analysis_data.get("tweet_family_fit", []),
            suggested_archetypes=analysis_data.get("suggested_archetypes", []),
            strengths=analysis_data.get("strengths", []),
            weaknesses=analysis_data.get("weaknesses", []),
            aura_score=analysis_data.get("aura_score", 50),
            model_used=vision_model,
            raw_response=analysis_data
        )
        
    except Exception as e:
        logger.error(f"Error analyzing image with LLM: {e}")
        return None


async def analyze_image_text_only(
    image_metadata: ImageMetadata,
    caption: str,
    groq_service,
    model: str = None
) -> Optional[ImageAnalysis]:
    """
    Analyze an image using only text description (no vision).
    Useful as fallback when vision is not available.
    
    Args:
        image_metadata: Extracted low-level features
        caption: Text description of the image
        groq_service: Instance of GroqService for LLM calls
        model: Optional model override
        
    Returns:
        ImageAnalysis with LLM-generated insights
    """
    try:
        prompt = f"""You are an expert visual analyst specializing in classical aesthetics and philosophical symbolism.

Based on this image description and extracted features, provide an aesthetic analysis:

Description: {caption}

Technical Features:
- Brightness: {image_metadata.brightness:.2f}
- Contrast: {image_metadata.contrast:.2f}
- Saturation: {image_metadata.saturation:.2f}
- Composition: {image_metadata.composition.value}
- Dominant Colors: {", ".join(image_metadata.dominant_colors)}

{IMAGE_ANALYSIS_PROMPT.split("Produce a JSON response")[1]}"""
        
        text_model = model or "llama-3.3-70b-versatile"
        
        response = await groq_service.chat_completion(
            messages=[{"role": "user", "content": prompt}],
            model=text_model,
            temperature=0.4,
            max_tokens=1000
        )
        
        if not response:
            return None
        
        # Parse JSON response
        try:
            json_str = response
            if "```json" in response:
                json_str = response.split("```json")[1].split("```")[0]
            elif "```" in response:
                json_str = response.split("```")[1].split("```")[0]
            
            analysis_data = json.loads(json_str.strip())
        except json.JSONDecodeError:
            analysis_data = {
                "mood_description": "Unable to parse",
                "aesthetic_style": [],
                "symbolic_elements": [],
                "philosophical_resonance": [],
                "tweet_family_fit": ["Culture/Aesthetic"],
                "strengths": [],
                "weaknesses": [],
                "suggested_archetypes": ["minimal_observation"],
                "aura_score": 50
            }
        
        return ImageAnalysis(
            image_id=image_metadata.image_id,
            mood_description=analysis_data.get("mood_description", ""),
            aesthetic_style=analysis_data.get("aesthetic_style", []),
            symbolic_elements=analysis_data.get("symbolic_elements", []),
            philosophical_resonance=analysis_data.get("philosophical_resonance", []),
            tweet_family_fit=analysis_data.get("tweet_family_fit", []),
            suggested_archetypes=analysis_data.get("suggested_archetypes", []),
            strengths=analysis_data.get("strengths", []),
            weaknesses=analysis_data.get("weaknesses", []),
            aura_score=analysis_data.get("aura_score", 50),
            model_used=text_model,
            raw_response=analysis_data
        )
        
    except Exception as e:
        logger.error(f"Error analyzing image with text-only LLM: {e}")
        return None
