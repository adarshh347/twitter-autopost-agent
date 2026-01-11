"""
Local SQLite database for storing tweet history.
Enables incremental syncing and heatmap generation.
"""

import sqlite3
import os
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
import json

# Database file path
DB_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(DB_DIR, "tweets_history.db")


def get_connection():
    """Get a database connection with row factory for dict-like access."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initialize the database schema."""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Tweets table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS tweets (
            tweet_id TEXT PRIMARY KEY,
            account_id TEXT NOT NULL,
            user_handle TEXT,
            user_name TEXT,
            text_content TEXT,
            tweet_type TEXT DEFAULT 'tweet',  -- 'tweet', 'quote', 'retweet', 'reply'
            created_at TIMESTAMP,
            scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            like_count INTEGER DEFAULT 0,
            retweet_count INTEGER DEFAULT 0,
            reply_count INTEGER DEFAULT 0,
            view_count INTEGER DEFAULT 0,
            tweet_url TEXT,
            media_urls TEXT,  -- JSON array
            raw_data TEXT     -- Full JSON dump for future use
        )
    """)
    
    # Create indexes for fast queries
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_account_id ON tweets(account_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_created_at ON tweets(created_at)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_account_date ON tweets(account_id, created_at)")
    
    # Sync metadata table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sync_metadata (
            account_id TEXT PRIMARY KEY,
            last_sync_at TIMESTAMP,
            oldest_tweet_date TIMESTAMP,
            newest_tweet_id TEXT,
            total_tweets_synced INTEGER DEFAULT 0
        )
    """)
    
    # =========================================
    # CHATBOT TABLES
    # =========================================
    
    # Profile Analysis Conversations
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS profile_chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id TEXT NOT NULL,
            role TEXT NOT NULL,  -- 'user', 'assistant', 'system'
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            model_used TEXT,
            has_image INTEGER DEFAULT 0
        )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_profile_chat_account ON profile_chat_messages(account_id)")
    
    # Profile Insights (structured data extracted from conversations)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS profile_insights (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id TEXT NOT NULL,
            insight_type TEXT NOT NULL,  -- 'goal', 'niche', 'tone', 'target_audience', 'content_pillars', etc.
            insight_value TEXT NOT NULL,
            confidence REAL DEFAULT 1.0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_insights_account ON profile_insights(account_id)")
    cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_insights_unique ON profile_insights(account_id, insight_type)")
    
    # General Chat Messages
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS general_chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id TEXT NOT NULL,
            session_id TEXT NOT NULL,  -- Group messages by session
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            model_used TEXT,
            used_profile_context INTEGER DEFAULT 0
        )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_general_chat_session ON general_chat_messages(session_id)")
    
    # Chat Settings
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chat_settings (
            account_id TEXT PRIMARY KEY,
            default_text_model TEXT DEFAULT 'openai/gpt-oss-120b',
            default_vision_model TEXT DEFAULT 'meta-llama/llama-4-scout-17b-16e-instruct',
            use_profile_context INTEGER DEFAULT 1,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    conn.commit()
    conn.close()



def get_last_sync_info(account_id: str) -> Optional[Dict]:
    """Get the last sync metadata for an account."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM sync_metadata WHERE account_id = ?", (account_id,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return dict(row)
    return None


def get_newest_tweet_date(account_id: str) -> Optional[datetime]:
    """Get the date of the newest stored tweet for an account."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT MAX(created_at) as newest_date 
        FROM tweets 
        WHERE account_id = ?
    """, (account_id,))
    row = cursor.fetchone()
    conn.close()
    
    if row and row['newest_date']:
        # Parse the datetime string
        try:
            return datetime.fromisoformat(row['newest_date'].replace('Z', '+00:00'))
        except:
            return datetime.strptime(row['newest_date'], "%Y-%m-%d %H:%M:%S")
    return None


def serialize_datetime(obj: Any) -> Any:
    """
    Recursively convert datetime objects to ISO format strings for JSON serialization.
    """
    if isinstance(obj, datetime):
        return obj.isoformat()
    elif isinstance(obj, dict):
        return {k: serialize_datetime(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [serialize_datetime(item) for item in obj]
    return obj


def detect_tweet_type(tweet_data: Dict[str, Any]) -> str:
    """
    Detect the type of tweet: 'tweet', 'retweet', 'quote', or 'reply'.
    """
    text = tweet_data.get('text_content', '') or ''
    tweet_url = str(tweet_data.get('tweet_url', '') or '')
    
    # Check for retweet (RT prefix or retweeted content indicator)
    if text.startswith('RT @'):
        return 'retweet'
    
    # Check for quote tweet (has quoted content embedded or specific URL patterns)
    # Quote tweets typically have the original tweet embedded
    raw_data = tweet_data.get('raw_element_data', {}) or {}
    if raw_data.get('is_quote_tweet') or raw_data.get('quoted_tweet'):
        return 'quote'
    
    # Check if text contains a twitter status URL (often indicates quote)
    if 'twitter.com/' in text and '/status/' in text:
        return 'quote'
    if 'x.com/' in text and '/status/' in text:
        return 'quote'
    
    # Check for reply (URL contains /status/xxx and has reply indicators)
    # Replies usually start with @handle or have reply thread context
    if text.startswith('@'):
        return 'reply'
    
    # Check thread context (part of a reply chain)
    thread_context = tweet_data.get('thread_context_tweets')
    if thread_context and len(thread_context) > 0:
        return 'reply'
    
    # Default to regular tweet
    return 'tweet'


def store_tweet(tweet_data: Dict[str, Any], account_id: str) -> bool:
    """
    Store a single tweet in the database.
    Returns True if inserted (new), False if already exists.
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    tweet_id = tweet_data.get('tweet_id')
    if not tweet_id:
        conn.close()
        return False
    
    # Check if already exists
    cursor.execute("SELECT tweet_id FROM tweets WHERE tweet_id = ?", (tweet_id,))
    if cursor.fetchone():
        conn.close()
        return False  # Already exists
    
    # Detect tweet type
    tweet_type = detect_tweet_type(tweet_data)
    
    # Handle datetime serialization for created_at
    created_at = tweet_data.get('created_at')
    if isinstance(created_at, datetime):
        created_at = created_at.isoformat()
    
    # Serialize the entire tweet_data for storage (handles nested datetimes)
    serialized_data = serialize_datetime(tweet_data)
    
    # Handle media URLs - could be HttpUrl objects
    media_urls = tweet_data.get('embedded_media_urls', [])
    if media_urls:
        media_urls = [str(url) for url in media_urls]
    
    # Convert tweet_url to string if it's a Pydantic HttpUrl
    tweet_url = tweet_data.get('tweet_url')
    if tweet_url:
        tweet_url = str(tweet_url)
    
    text = tweet_data.get('text_content', '')
    
    # Insert new tweet
    cursor.execute("""
        INSERT INTO tweets (
            tweet_id, account_id, user_handle, user_name, text_content,
            tweet_type, created_at, like_count, retweet_count, reply_count,
            view_count, tweet_url, media_urls, raw_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        str(tweet_id),
        account_id,
        tweet_data.get('user_handle'),
        tweet_data.get('user_name'),
        text,
        tweet_type,
        created_at,
        tweet_data.get('like_count', 0) or 0,
        tweet_data.get('retweet_count', 0) or 0,
        tweet_data.get('reply_count', 0) or 0,
        tweet_data.get('view_count', 0) or 0,
        tweet_url,
        json.dumps(media_urls),
        json.dumps(serialized_data, default=str)
    ))
    
    conn.commit()
    conn.close()
    return True


def store_tweets_batch(tweets: List[Dict], account_id: str) -> int:
    """Store multiple tweets. Returns count of newly inserted tweets."""
    new_count = 0
    for tweet in tweets:
        if store_tweet(tweet, account_id):
            new_count += 1
    return new_count


def update_sync_metadata(account_id: str, newest_tweet_id: Optional[str] = None):
    """Update the sync metadata for an account."""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Get current tweet count
    cursor.execute("SELECT COUNT(*) as cnt FROM tweets WHERE account_id = ?", (account_id,))
    total = cursor.fetchone()['cnt']
    
    # Get oldest tweet date
    cursor.execute("SELECT MIN(created_at) as oldest FROM tweets WHERE account_id = ?", (account_id,))
    oldest = cursor.fetchone()['oldest']
    
    cursor.execute("""
        INSERT OR REPLACE INTO sync_metadata 
        (account_id, last_sync_at, oldest_tweet_date, newest_tweet_id, total_tweets_synced)
        VALUES (?, ?, ?, ?, ?)
    """, (
        account_id,
        datetime.utcnow().isoformat(),
        oldest,
        newest_tweet_id,
        total
    ))
    
    conn.commit()
    conn.close()


def get_tweets_for_account(account_id: str, limit: int = 100, offset: int = 0) -> List[Dict]:
    """Get stored tweets for an account, ordered by date descending."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM tweets 
        WHERE account_id = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    """, (account_id, limit, offset))
    
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]


def get_heatmap_data(account_id: str, days: int = 365) -> Dict[str, int]:
    """
    Get tweet count per day for heatmap visualization.
    Returns dict: { "YYYY-MM-DD": count, ... }
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    # Calculate start date
    start_date = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")
    
    cursor.execute("""
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM tweets
        WHERE account_id = ? AND DATE(created_at) >= ?
        GROUP BY DATE(created_at)
        ORDER BY date
    """, (account_id, start_date))
    
    rows = cursor.fetchall()
    conn.close()
    
    return {row['date']: row['count'] for row in rows}


def get_activity_stats(account_id: str) -> Dict[str, Any]:
    """Get overall activity statistics for an account."""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Total tweets
    cursor.execute("SELECT COUNT(*) as total FROM tweets WHERE account_id = ?", (account_id,))
    total = cursor.fetchone()['total']
    
    # Tweet type breakdown
    cursor.execute("""
        SELECT tweet_type, COUNT(*) as count 
        FROM tweets WHERE account_id = ?
        GROUP BY tweet_type
    """, (account_id,))
    type_breakdown = {row['tweet_type']: row['count'] for row in cursor.fetchall()}
    
    # Tweets in last 7 days
    week_ago = (datetime.utcnow() - timedelta(days=7)).strftime("%Y-%m-%d")
    cursor.execute("""
        SELECT COUNT(*) as recent 
        FROM tweets 
        WHERE account_id = ? AND DATE(created_at) >= ?
    """, (account_id, week_ago))
    recent = cursor.fetchone()['recent']
    
    # Streak calculation (consecutive days with tweets)
    cursor.execute("""
        SELECT DISTINCT DATE(created_at) as date 
        FROM tweets 
        WHERE account_id = ?
        ORDER BY date DESC
    """, (account_id,))
    dates = [row['date'] for row in cursor.fetchall()]
    
    streak = 0
    if dates:
        today = datetime.utcnow().date()
        for i, date_str in enumerate(dates):
            date = datetime.strptime(date_str, "%Y-%m-%d").date()
            expected = today - timedelta(days=i)
            if date == expected:
                streak += 1
            else:
                break
    
    conn.close()
    
    return {
        "total_tweets": total,
        "type_breakdown": type_breakdown,
        "tweets_last_7_days": recent,
        "current_streak": streak
    }


# =========================================
# CHAT DATABASE FUNCTIONS
# =========================================

def save_profile_chat_message(account_id: str, role: str, content: str, model_used: str = None, has_image: bool = False) -> int:
    """Save a profile chat message and return its ID."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO profile_chat_messages (account_id, role, content, model_used, has_image)
        VALUES (?, ?, ?, ?, ?)
    """, (account_id, role, content, model_used, 1 if has_image else 0))
    msg_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return msg_id


def get_profile_chat_history(account_id: str, limit: int = 50) -> List[Dict]:
    """Get profile chat history for an account."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, role, content, created_at, model_used, has_image
        FROM profile_chat_messages
        WHERE account_id = ?
        ORDER BY created_at ASC
        LIMIT ?
    """, (account_id, limit))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def clear_profile_chat(account_id: str):
    """Clear profile chat history for an account."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM profile_chat_messages WHERE account_id = ?", (account_id,))
    conn.commit()
    conn.close()


def save_profile_insight(account_id: str, insight_type: str, insight_value: str, confidence: float = 1.0):
    """Save or update a profile insight."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO profile_insights 
        (account_id, insight_type, insight_value, confidence, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    """, (account_id, insight_type, insight_value, confidence))
    conn.commit()
    conn.close()


def get_profile_insights(account_id: str) -> Dict[str, Any]:
    """Get all profile insights for an account as a dictionary."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT insight_type, insight_value, confidence, updated_at
        FROM profile_insights
        WHERE account_id = ?
    """, (account_id,))
    rows = cursor.fetchall()
    conn.close()
    
    insights = {}
    for row in rows:
        insights[row['insight_type']] = {
            'value': row['insight_value'],
            'confidence': row['confidence'],
            'updated_at': row['updated_at']
        }
    return insights


def save_general_chat_message(account_id: str, session_id: str, role: str, content: str, 
                               model_used: str = None, used_profile_context: bool = False) -> int:
    """Save a general chat message."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO general_chat_messages 
        (account_id, session_id, role, content, model_used, used_profile_context)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (account_id, session_id, role, content, model_used, 1 if used_profile_context else 0))
    msg_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return msg_id


def get_general_chat_history(session_id: str, limit: int = 50) -> List[Dict]:
    """Get general chat history for a session."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, role, content, created_at, model_used, used_profile_context
        FROM general_chat_messages
        WHERE session_id = ?
        ORDER BY created_at ASC
        LIMIT ?
    """, (session_id, limit))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_chat_settings(account_id: str) -> Dict[str, Any]:
    """Get chat settings for an account."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM chat_settings WHERE account_id = ?", (account_id,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return dict(row)
    # Return defaults
    return {
        'account_id': account_id,
        'default_text_model': 'openai/gpt-oss-120b',
        'default_vision_model': 'meta-llama/llama-4-scout-17b-16e-instruct',
        'use_profile_context': 1
    }


def update_chat_settings(account_id: str, text_model: str = None, vision_model: str = None, 
                         use_profile_context: bool = None):
    """Update chat settings for an account."""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Get current settings
    current = get_chat_settings(account_id)
    
    cursor.execute("""
        INSERT OR REPLACE INTO chat_settings 
        (account_id, default_text_model, default_vision_model, use_profile_context, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    """, (
        account_id,
        text_model if text_model else current['default_text_model'],
        vision_model if vision_model else current['default_vision_model'],
        (1 if use_profile_context else 0) if use_profile_context is not None else current['use_profile_context']
    ))
    conn.commit()
    conn.close()


def get_profile_context_summary(account_id: str) -> str:
    """Generate a context summary from profile insights for use in general chat."""
    insights = get_profile_insights(account_id)
    
    if not insights:
        return ""
    
    summary_parts = ["Based on profile analysis, here's what we know about this Twitter account:"]
    
    insight_labels = {
        'goal': 'Goals',
        'niche': 'Niche/Industry',
        'tone': 'Preferred Tone',
        'target_audience': 'Target Audience',
        'content_pillars': 'Content Pillars',
        'posting_frequency': 'Posting Frequency',
        'strengths': 'Strengths',
        'improvement_areas': 'Areas for Improvement',
        'brand_voice': 'Brand Voice',
        'key_topics': 'Key Topics'
    }
    
    for key, data in insights.items():
        label = insight_labels.get(key, key.replace('_', ' ').title())
        summary_parts.append(f"- {label}: {data['value']}")
    
    return "\n".join(summary_parts)


# Initialize database on module load
init_db()

