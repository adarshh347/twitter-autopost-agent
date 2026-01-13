"""
Curator Database Operations.

Handles storage and retrieval for:
- Images and their metadata
- Image analyses
- Tweet family usage history
- Archetype usage history
- Generated tweets
"""

import sqlite3
import os
import json
import logging
from datetime import datetime
from typing import List, Optional, Dict, Any
import uuid

from .models import (
    ImageMetadata,
    ImageAnalysis,
    TasteScore,
    GeneratedTweet,
    TweetFamily,
    CompositionType
)

logger = logging.getLogger(__name__)

# Database file path - stored alongside tweets_history.db
DB_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
DB_PATH = os.path.join(DB_DIR, "backend", "curator.db")


def get_connection():
    """Get a database connection."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_curator_db():
    """Initialize the curator database schema."""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Images table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS curator_images (
            image_id TEXT PRIMARY KEY,
            url TEXT,
            local_path TEXT,
            dominant_colors TEXT,
            brightness REAL,
            contrast REAL,
            saturation REAL,
            noise_level REAL,
            composition TEXT,
            aspect_ratio REAL,
            width INTEGER,
            height INTEGER,
            file_size_bytes INTEGER,
            raw_caption TEXT,
            upload_date TEXT,
            processed INTEGER DEFAULT 0,
            account_id TEXT
        )
    """)
    
    # Image analyses table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS curator_analyses (
            analysis_id TEXT PRIMARY KEY,
            image_id TEXT,
            mood_description TEXT,
            aesthetic_style TEXT,
            symbolic_elements TEXT,
            philosophical_resonance TEXT,
            tweet_family_fit TEXT,
            suggested_archetypes TEXT,
            strengths TEXT,
            weaknesses TEXT,
            aura_score INTEGER,
            analyzed_at TEXT,
            model_used TEXT,
            raw_response TEXT,
            account_id TEXT,
            FOREIGN KEY (image_id) REFERENCES curator_images(image_id)
        )
    """)
    
    # Taste scores table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS curator_taste_scores (
            score_id TEXT PRIMARY KEY,
            image_id TEXT,
            is_approved INTEGER,
            final_score INTEGER,
            applied_rules TEXT,
            rejection_reasons TEXT,
            bonus_reasons TEXT,
            recommended_families TEXT,
            recommended_archetypes TEXT,
            evaluated_at TEXT,
            account_id TEXT,
            FOREIGN KEY (image_id) REFERENCES curator_images(image_id)
        )
    """)
    
    # Generated tweets table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS curator_generated_tweets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tweet_id TEXT,
            text TEXT,
            image_id TEXT,
            family_id TEXT,
            archetype_id TEXT,
            image_analysis_id TEXT,
            generated_at TEXT,
            model_used TEXT,
            prompt_used TEXT,
            is_posted INTEGER DEFAULT 0,
            posted_at TEXT,
            account_id TEXT
        )
    """)
    
    # Family usage history
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS curator_family_usage (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            family_id TEXT,
            used_at TEXT,
            tweet_id TEXT,
            account_id TEXT
        )
    """)
    
    # Archetype usage history
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS curator_archetype_usage (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            archetype_id TEXT,
            used_at TEXT,
            tweet_id TEXT,
            account_id TEXT
        )
    """)
    
    conn.commit()
    conn.close()
    logger.info(f"Curator database initialized at {DB_PATH}")


# ============================================================
# IMAGE OPERATIONS
# ============================================================

def store_image(metadata: ImageMetadata, account_id: str = "default") -> bool:
    """Store image metadata in the database."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT OR REPLACE INTO curator_images 
            (image_id, url, local_path, dominant_colors, brightness, contrast, 
             saturation, noise_level, composition, aspect_ratio, width, height,
             file_size_bytes, raw_caption, upload_date, processed, account_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            metadata.image_id,
            metadata.url,
            metadata.local_path,
            json.dumps(metadata.dominant_colors),
            metadata.brightness,
            metadata.contrast,
            metadata.saturation,
            metadata.noise_level,
            metadata.composition.value if metadata.composition else "centered",
            metadata.aspect_ratio,
            metadata.width,
            metadata.height,
            metadata.file_size_bytes,
            metadata.raw_caption,
            metadata.upload_date.isoformat() if metadata.upload_date else datetime.utcnow().isoformat(),
            1 if metadata.processed else 0,
            account_id
        ))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        logger.error(f"Error storing image: {e}")
        return False


def get_image(image_id: str) -> Optional[ImageMetadata]:
    """Retrieve image metadata by ID."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM curator_images WHERE image_id = ?", (image_id,))
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            return None
        
        return ImageMetadata(
            image_id=row["image_id"],
            url=row["url"],
            local_path=row["local_path"],
            dominant_colors=json.loads(row["dominant_colors"]) if row["dominant_colors"] else [],
            brightness=row["brightness"],
            contrast=row["contrast"],
            saturation=row["saturation"],
            noise_level=row["noise_level"],
            composition=CompositionType(row["composition"]) if row["composition"] else CompositionType.CENTERED,
            aspect_ratio=row["aspect_ratio"],
            width=row["width"],
            height=row["height"],
            file_size_bytes=row["file_size_bytes"],
            raw_caption=row["raw_caption"],
            upload_date=datetime.fromisoformat(row["upload_date"]) if row["upload_date"] else None,
            processed=bool(row["processed"])
        )
    except Exception as e:
        logger.error(f"Error retrieving image: {e}")
        return None


def get_all_images(account_id: str = "default", limit: int = 50) -> List[Dict]:
    """Get all images for an account."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT * FROM curator_images 
            WHERE account_id = ?
            ORDER BY upload_date DESC
            LIMIT ?
        """, (account_id, limit))
        
        rows = cursor.fetchall()
        conn.close()
        
        return [dict(row) for row in rows]
    except Exception as e:
        logger.error(f"Error getting images: {e}")
        return []


# ============================================================
# ANALYSIS OPERATIONS
# ============================================================

def store_analysis(analysis: ImageAnalysis, account_id: str = "default") -> bool:
    """Store image analysis in the database."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        analysis_id = str(uuid.uuid4())
        
        cursor.execute("""
            INSERT INTO curator_analyses 
            (analysis_id, image_id, mood_description, aesthetic_style, symbolic_elements,
             philosophical_resonance, tweet_family_fit, suggested_archetypes, 
             strengths, weaknesses, aura_score, analyzed_at, model_used, raw_response, account_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            analysis_id,
            analysis.image_id,
            analysis.mood_description,
            json.dumps(analysis.aesthetic_style),
            json.dumps(analysis.symbolic_elements),
            json.dumps(analysis.philosophical_resonance),
            json.dumps(analysis.tweet_family_fit),
            json.dumps(analysis.suggested_archetypes),
            json.dumps(analysis.strengths),
            json.dumps(analysis.weaknesses),
            analysis.aura_score,
            analysis.analyzed_at.isoformat() if analysis.analyzed_at else datetime.utcnow().isoformat(),
            analysis.model_used,
            json.dumps(analysis.raw_response) if analysis.raw_response else None,
            account_id
        ))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        logger.error(f"Error storing analysis: {e}")
        return False


def get_analysis_for_image(image_id: str) -> Optional[ImageAnalysis]:
    """Get the most recent analysis for an image."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT * FROM curator_analyses 
            WHERE image_id = ?
            ORDER BY analyzed_at DESC
            LIMIT 1
        """, (image_id,))
        
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            return None
        
        return ImageAnalysis(
            image_id=row["image_id"],
            mood_description=row["mood_description"],
            aesthetic_style=json.loads(row["aesthetic_style"]) if row["aesthetic_style"] else [],
            symbolic_elements=json.loads(row["symbolic_elements"]) if row["symbolic_elements"] else [],
            philosophical_resonance=json.loads(row["philosophical_resonance"]) if row["philosophical_resonance"] else [],
            tweet_family_fit=json.loads(row["tweet_family_fit"]) if row["tweet_family_fit"] else [],
            suggested_archetypes=json.loads(row["suggested_archetypes"]) if row["suggested_archetypes"] else [],
            strengths=json.loads(row["strengths"]) if row["strengths"] else [],
            weaknesses=json.loads(row["weaknesses"]) if row["weaknesses"] else [],
            aura_score=row["aura_score"],
            analyzed_at=datetime.fromisoformat(row["analyzed_at"]) if row["analyzed_at"] else None,
            model_used=row["model_used"],
            raw_response=json.loads(row["raw_response"]) if row["raw_response"] else None
        )
    except Exception as e:
        logger.error(f"Error getting analysis: {e}")
        return None


# ============================================================
# TASTE SCORE OPERATIONS
# ============================================================

def store_taste_score(score: TasteScore, account_id: str = "default") -> bool:
    """Store taste evaluation in the database."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        score_id = str(uuid.uuid4())
        
        cursor.execute("""
            INSERT INTO curator_taste_scores 
            (score_id, image_id, is_approved, final_score, applied_rules,
             rejection_reasons, bonus_reasons, recommended_families,
             recommended_archetypes, evaluated_at, account_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            score_id,
            score.image_id,
            1 if score.is_approved else 0,
            score.final_score,
            json.dumps(score.applied_rules),
            json.dumps(score.rejection_reasons),
            json.dumps(score.bonus_reasons),
            json.dumps(score.recommended_families),
            json.dumps(score.recommended_archetypes),
            score.evaluated_at.isoformat() if score.evaluated_at else datetime.utcnow().isoformat(),
            account_id
        ))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        logger.error(f"Error storing taste score: {e}")
        return False


# ============================================================
# FAMILY/ARCHETYPE USAGE TRACKING
# ============================================================

def record_family_usage(family_id: str, tweet_id: str = None, account_id: str = "default"):
    """Record that a family was used in a post."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO curator_family_usage (family_id, used_at, tweet_id, account_id)
            VALUES (?, ?, ?, ?)
        """, (family_id, datetime.utcnow().isoformat(), tweet_id, account_id))
        
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"Error recording family usage: {e}")


def get_recent_families(account_id: str = "default", limit: int = 10) -> List[str]:
    """Get list of recently used family IDs."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT family_id FROM curator_family_usage 
            WHERE account_id = ?
            ORDER BY used_at DESC
            LIMIT ?
        """, (account_id, limit))
        
        rows = cursor.fetchall()
        conn.close()
        
        return [row["family_id"] for row in rows]
    except Exception as e:
        logger.error(f"Error getting recent families: {e}")
        return []


def record_archetype_usage(archetype_id: str, tweet_id: str = None, account_id: str = "default"):
    """Record that an archetype was used in a post."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO curator_archetype_usage (archetype_id, used_at, tweet_id, account_id)
            VALUES (?, ?, ?, ?)
        """, (archetype_id, datetime.utcnow().isoformat(), tweet_id, account_id))
        
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"Error recording archetype usage: {e}")


def get_recent_archetypes(account_id: str = "default", limit: int = 10) -> List[str]:
    """Get list of recently used archetype IDs."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT archetype_id FROM curator_archetype_usage 
            WHERE account_id = ?
            ORDER BY used_at DESC
            LIMIT ?
        """, (account_id, limit))
        
        rows = cursor.fetchall()
        conn.close()
        
        return [row["archetype_id"] for row in rows]
    except Exception as e:
        logger.error(f"Error getting recent archetypes: {e}")
        return []


# ============================================================
# GENERATED TWEETS
# ============================================================

def store_generated_tweet(tweet: GeneratedTweet, account_id: str = "default") -> bool:
    """Store a generated tweet."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO curator_generated_tweets 
            (tweet_id, text, image_id, family_id, archetype_id, image_analysis_id,
             generated_at, model_used, prompt_used, is_posted, posted_at, account_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            tweet.tweet_id,
            tweet.text,
            tweet.image_id,
            tweet.family_id,
            tweet.archetype_id,
            tweet.image_analysis_id,
            tweet.generated_at.isoformat() if tweet.generated_at else datetime.utcnow().isoformat(),
            tweet.model_used,
            tweet.prompt_used,
            1 if tweet.is_posted else 0,
            tweet.posted_at.isoformat() if tweet.posted_at else None,
            account_id
        ))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        logger.error(f"Error storing generated tweet: {e}")
        return False


def get_generated_tweets(account_id: str = "default", limit: int = 20) -> List[Dict]:
    """Get recently generated tweets."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT * FROM curator_generated_tweets 
            WHERE account_id = ?
            ORDER BY generated_at DESC
            LIMIT ?
        """, (account_id, limit))
        
        rows = cursor.fetchall()
        conn.close()
        
        return [dict(row) for row in rows]
    except Exception as e:
        logger.error(f"Error getting generated tweets: {e}")
        return []


# Initialize database on module load
init_curator_db()
