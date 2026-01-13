"""
Curator Service - Main Orchestration.

Brings together all curator components to provide a unified API for:
- Analyzing and storing images
- Evaluating taste
- Selecting families and archetypes
- Generating tweets
"""

import os
import uuid
import base64
import logging
from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime

from .models import (
    ImageMetadata,
    ImageAnalysis,
    TasteScore,
    TweetFamily,
    TweetArchetype,
    GeneratedTweet,
    CuratorConfig
)
from .image_processor import extract_image_features, extract_features_from_bytes
from .image_interpreter import analyze_image_with_llm, analyze_image_text_only
from .family_engine import (
    get_all_families,
    get_family_by_id,
    get_family_for_analysis,
    select_family_for_posting
)
from .archetypes import (
    get_all_archetypes,
    get_archetype_by_id,
    get_archetypes_for_family,
    select_archetype_for_image,
    get_generation_prompt_for_archetype
)
from .taste_engine import evaluate_image_taste, quick_taste_check, get_taste_summary
from . import database as db

logger = logging.getLogger(__name__)


class CuratorService:
    """
    Main service for aesthetic tweet curation.
    
    Provides a high-level API for:
    - Processing and analyzing images
    - Evaluating aesthetic quality
    - Generating curated tweets
    """
    
    def __init__(self, groq_service=None, account_id: str = "default", config: CuratorConfig = None):
        """
        Initialize the curator service.
        
        Args:
            groq_service: Instance of GroqService for LLM calls
            account_id: Account identifier for storage
            config: Optional curator configuration
        """
        self.groq_service = groq_service
        self.account_id = account_id
        self.config = config or CuratorConfig()
        
        # Ensure database is initialized
        db.init_curator_db()
    
    async def process_image(
        self,
        image_path: Optional[str] = None,
        image_bytes: Optional[bytes] = None,
        image_url: Optional[str] = None,
        skip_llm_analysis: bool = False
    ) -> Dict[str, Any]:
        """
        Process an image: extract features, analyze with LLM, evaluate taste.
        
        Args:
            image_path: Path to local image file
            image_bytes: Raw image bytes (for uploads)
            image_url: URL of remote image
            skip_llm_analysis: If True, skip the LLM analysis step
            
        Returns:
            Dict with metadata, analysis, taste_score, and recommendations
        """
        image_id = str(uuid.uuid4())
        
        # Step 1: Extract low-level features
        if image_path and os.path.exists(image_path):
            metadata = extract_image_features(image_path, image_id)
        elif image_bytes:
            metadata = extract_features_from_bytes(image_bytes, image_id)
        else:
            return {"error": "No valid image source provided"}
        
        if not metadata:
            return {"error": "Failed to extract image features"}
        
        # Store metadata
        db.store_image(metadata, self.account_id)
        
        # Step 2: Quick taste check (fast rejection)
        quick_check = quick_taste_check(metadata, self.config)
        if not quick_check["approved"]:
            taste_score = TasteScore(
                image_id=image_id,
                is_approved=False,
                final_score=20,
                rejection_reasons=quick_check["reasons"]
            )
            db.store_taste_score(taste_score, self.account_id)
            
            return {
                "image_id": image_id,
                "metadata": metadata.model_dump(),
                "analysis": None,
                "taste_score": taste_score.model_dump(),
                "approved": False,
                "rejection_reasons": quick_check["reasons"]
            }
        
        # Step 3: LLM analysis (if not skipped and groq_service available)
        analysis = None
        if not skip_llm_analysis and self.groq_service:
            try:
                # Read image as base64
                if image_path:
                    with open(image_path, "rb") as f:
                        image_base64 = base64.b64encode(f.read()).decode()
                elif image_bytes:
                    image_base64 = base64.b64encode(image_bytes).decode()
                else:
                    image_base64 = None
                
                if image_base64:
                    analysis = await analyze_image_with_llm(
                        metadata,
                        image_base64,
                        self.groq_service,
                        model=self.config.analysis_model
                    )
                    
                    if analysis:
                        db.store_analysis(analysis, self.account_id)
                        
            except Exception as e:
                logger.error(f"LLM analysis failed: {e}")
        
        # Step 4: Full taste evaluation
        taste_score = evaluate_image_taste(metadata, analysis, self.config)
        db.store_taste_score(taste_score, self.account_id)
        
        # Step 5: Get recommendations
        recommendations = self._get_recommendations(metadata, analysis, taste_score)
        
        return {
            "image_id": image_id,
            "metadata": metadata.model_dump(),
            "analysis": analysis.model_dump() if analysis else None,
            "taste_score": taste_score.model_dump(),
            "approved": taste_score.is_approved,
            "recommendations": recommendations,
            "taste_summary": get_taste_summary(taste_score)
        }
    
    def _get_recommendations(
        self,
        metadata: ImageMetadata,
        analysis: Optional[ImageAnalysis],
        taste_score: TasteScore
    ) -> Dict[str, Any]:
        """Generate recommendations for tweet generation."""
        recommendations = {
            "families": [],
            "archetypes": [],
            "suggested_tones": []
        }
        
        if not taste_score.is_approved:
            return recommendations
        
        # Get recent usage
        recent_families = db.get_recent_families(self.account_id, 5)
        recent_archetypes = db.get_recent_archetypes(self.account_id, 5)
        
        # Select family
        if analysis:
            family = select_family_for_posting(analysis, recent_families)
            if family:
                recommendations["families"] = [family.model_dump()]
                
                # Select archetype
                archetype = select_archetype_for_image(
                    analysis,
                    family.family_id,
                    has_image=True,
                    recent_archetypes=recent_archetypes
                )
                if archetype:
                    recommendations["archetypes"] = [archetype.model_dump()]
                    recommendations["suggested_tones"] = archetype.tone_requirements
        
        return recommendations
    
    async def generate_tweet_for_image(
        self,
        image_id: str,
        family_id: Optional[str] = None,
        archetype_id: Optional[str] = None,
        custom_prompt: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate a tweet for a previously analyzed image.
        
        Args:
            image_id: ID of the analyzed image
            family_id: Optional override for family selection
            archetype_id: Optional override for archetype selection
            custom_prompt: Optional custom prompt additions
            
        Returns:
            Dict with generated tweet and metadata
        """
        if not self.groq_service:
            return {"error": "No LLM service available. Please set GROQ_API_KEY in backend/.env"}
        
        # Get stored data
        metadata = db.get_image(image_id)
        analysis = db.get_analysis_for_image(image_id)
        
        if not metadata:
            return {"error": f"Image {image_id} not found"}
        
        # If no analysis, create a minimal one from metadata
        if not analysis:
            logger.info(f"No LLM analysis found for {image_id}, creating fallback from metadata")
            analysis = ImageAnalysis(
                image_id=image_id,
                mood_description=f"Image with {metadata.composition.value} composition, {'bright' if metadata.brightness > 0.5 else 'dark'} tones",
                aesthetic_style=["photographic"],
                symbolic_elements=[],
                philosophical_resonance=[],
                tweet_family_fit=["Culture/Aesthetic"],
                suggested_archetypes=["minimal_observation", "aphorism"],
                strengths=["visual interest"],
                weaknesses=[],
                aura_score=int(metadata.brightness * 30 + metadata.contrast * 40 + 30)
            )
        
        # Get recent usage
        recent_families = db.get_recent_families(self.account_id, 5)
        recent_archetypes = db.get_recent_archetypes(self.account_id, 5)
        
        # Select or use provided family
        if family_id:
            family = get_family_by_id(family_id)
        else:
            family = select_family_for_posting(analysis, recent_families)
        
        if not family:
            family = get_all_families()[0]
        
        # Select or use provided archetype
        if archetype_id:
            archetype = get_archetype_by_id(archetype_id)
        else:
            archetype = select_archetype_for_image(
                analysis,
                family.family_id,
                has_image=True,
                recent_archetypes=recent_archetypes
            )
        
        if not archetype:
            archetype = get_all_archetypes()[0]
        
        # Generate the tweet
        generation_prompt = get_generation_prompt_for_archetype(archetype, analysis, family)
        
        if custom_prompt:
            generation_prompt += f"\n\nAdditional guidance: {custom_prompt}"
        
        try:
            response = await self.groq_service.chat_completion(
                messages=[{"role": "user", "content": generation_prompt}],
                model=self.config.generation_model,
                temperature=self.config.generation_temperature,
                max_tokens=300
            )
            
            if not response:
                return {"error": "Empty response from LLM"}
            
            # Clean up the response
            tweet_text = response.strip()
            if tweet_text.startswith('"') and tweet_text.endswith('"'):
                tweet_text = tweet_text[1:-1]
            
            # Ensure it's within length
            if len(tweet_text) > 280:
                tweet_text = tweet_text[:277] + "..."
            
            # Create GeneratedTweet
            generated = GeneratedTweet(
                text=tweet_text,
                image_id=image_id,
                family_id=family.family_id,
                archetype_id=archetype.archetype_id,
                model_used=self.config.generation_model,
                prompt_used=generation_prompt
            )
            
            # Store
            db.store_generated_tweet(generated, self.account_id)
            
            return {
                "tweet": generated.model_dump(),
                "family": family.model_dump(),
                "archetype": archetype.model_dump(),
                "image_analysis": analysis.model_dump()
            }
            
        except Exception as e:
            logger.error(f"Tweet generation failed: {e}")
            return {"error": str(e)}
    
    def get_gallery(self, limit: int = 50) -> List[Dict]:
        """Get all images in the gallery with their analyses."""
        images = db.get_all_images(self.account_id, limit)
        
        gallery = []
        for img in images:
            analysis = db.get_analysis_for_image(img["image_id"])
            gallery.append({
                "image": img,
                "analysis": analysis.model_dump() if analysis else None
            })
        
        return gallery
    
    def get_families(self) -> List[Dict]:
        """Get all available tweet families."""
        return [f.model_dump() for f in get_all_families()]
    
    def get_archetypes(self, family_id: Optional[str] = None) -> List[Dict]:
        """Get archetypes, optionally filtered by family."""
        if family_id:
            archetypes = get_archetypes_for_family(family_id)
        else:
            archetypes = get_all_archetypes()
        return [a.model_dump() for a in archetypes]
    
    def get_generated_tweets(self, limit: int = 20) -> List[Dict]:
        """Get recently generated tweets."""
        return db.get_generated_tweets(self.account_id, limit)
    
    def record_post(self, family_id: str, archetype_id: str, tweet_id: str = None):
        """Record that a post was made for tracking diversity."""
        db.record_family_usage(family_id, tweet_id, self.account_id)
        db.record_archetype_usage(archetype_id, tweet_id, self.account_id)


# Singleton instance
_curator_service = None

def get_curator_service(groq_service=None, account_id: str = "default") -> CuratorService:
    """Get or create the curator service instance."""
    global _curator_service
    if _curator_service is None or _curator_service.account_id != account_id:
        _curator_service = CuratorService(groq_service, account_id)
    elif groq_service and _curator_service.groq_service is None:
        _curator_service.groq_service = groq_service
    return _curator_service
