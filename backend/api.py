
import sys
import os
import json
import logging
from typing import Optional, List
from datetime import datetime, timedelta

from fastapi import FastAPI, HTTPException, Depends, status, BackgroundTasks
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from jose import JWTError, jwt
from passlib.context import CryptContext

# Basic Setup to access src modules
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(PROJECT_ROOT)
sys.path.append(os.path.join(PROJECT_ROOT, "src")) # Add src to path so 'import core' works

from src.core.browser_manager import BrowserManager
from src.core.config_loader import ConfigLoader, CONFIG_DIR
from src.features.scraper.service import TweetScraper
from src.features.publisher.orchestrator import TweetPublisher
from src.data_models import TweetContent, AccountConfig, ScrapedProfile, ScrapedTweet
from src.utils.logger import setup_logger

# --- App Setup ---
app = FastAPI(title="Twitter Automation API")
logger = logging.getLogger("api")
config_loader = ConfigLoader()
setup_logger(config_loader)

# Allow CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Auth Configuration ---
SECRET_KEY = "supersecretkey" # In production, use env var
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 300

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# --- Global State (Simple V1) ---
# We keep a single global browser manager for V1 simplicity (single user)
# In a real SaaS, this would be a pool of browsers keyed by user content
global_browser_manager: Optional[BrowserManager] = None
session_status: str = "disconnected"  # "disconnected", "connecting", "connected"

# --- Models ---

class Token(BaseModel):
    access_token: str
    token_type: str

class User(BaseModel):
    username: str

class TweetRequest(BaseModel):
    text: str
    media_path: Optional[str] = None

class ActionRequest(BaseModel):
    tweet_id: str
    
class RetweetRequest(BaseModel):
    tweet_url: str
    quote_text: Optional[str] = None

class LoginResponse(BaseModel):
    message: str
    status: str

# --- Auth Logic (PAUSED) ---

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    # Keep this helper as is, though unused for validation now
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user():
    # AUTH DISABLED TEMPORARILY
    logger.info("Auth Check Skipped (Bypassed)")
    return User(username="admin_no_auth")

# async def get_current_user(token: str = Depends(oauth2_scheme)):
#     credentials_exception = HTTPException(
#         status_code=status.HTTP_401_UNAUTHORIZED,
#         detail="Could not validate credentials",
#         headers={"WWW-Authenticate": "Bearer"},
#     )
#     try:
#         payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
#         username: str = payload.get("sub")
#         if username is None:
#             raise credentials_exception
#     except JWTError:
#         raise credentials_exception
#     return User(username=username)

# --- Browser Dependency ---

def get_browser_manager():
    global global_browser_manager
    if not global_browser_manager:
        # Load default account config
        accounts = config_loader.get_accounts_config()
        if not accounts:
             # Just init without account if none exists, to allow login flow
             global_browser_manager = BrowserManager(config_loader=config_loader)
        else:
             global_browser_manager = BrowserManager(account_config=accounts[0], config_loader=config_loader)
    return global_browser_manager

def get_scraper(browser_manager: BrowserManager = Depends(get_browser_manager)):
    return TweetScraper(browser_manager)

def get_publisher(browser_manager: BrowserManager = Depends(get_browser_manager)):
    # Mock LLM service for V1 if not needed, or init properly
    from src.core.llm_service import LLMService
    llm_service = LLMService(config_loader)
    
    # Needs account config
    account_config = browser_manager.account_config
    if isinstance(account_config, dict):
        account_config = AccountConfig(**account_config)
        
    return TweetPublisher(browser_manager, llm_service, account_config)


# --- Endpoints ---

@app.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    # V1: Hardcoded user for simplicity
    if form_data.username != "admin" or form_data.password != "password":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": form_data.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/session/status")
async def get_session_status():
    """Check if the browser session is active and connected"""
    global global_browser_manager, session_status
    
    if global_browser_manager and global_browser_manager.is_driver_active():
        session_status = "connected"
        return {"status": "connected", "message": "Browser session is active"}
    else:
        session_status = "disconnected"
        return {"status": "disconnected", "message": "No active browser session"}


@app.post("/session/start")
async def start_session():
    """
    Start a persistent browser session with saved cookies.
    The browser stays open until explicitly disconnected.
    """
    global global_browser_manager, session_status
    
    # Check if already connected
    if global_browser_manager and global_browser_manager.is_driver_active():
        session_status = "connected"
        return {"status": "connected", "message": "Browser session already active"}
    
    session_status = "connecting"
    
    try:
        # Close any stale session
        if global_browser_manager:
            try:
                global_browser_manager.close_driver()
            except:
                pass
            global_browser_manager = None
        
        # Load account config with cookies
        accounts = config_loader.get_accounts_config()
        if not accounts:
            session_status = "disconnected"
            raise HTTPException(status_code=400, detail="No account configured. Please set up config/accounts.json first.")
        
        account_config = accounts[0]
        
        # Initialize browser with the account (will load cookies)
        global_browser_manager = BrowserManager(account_config=account_config, config_loader=config_loader)
        driver = global_browser_manager.get_driver()
        
        # Navigate to home to verify login
        driver.get("https://x.com/home")
        
        import time
        time.sleep(3)  # Wait for page load
        
        # Check if we're logged in by looking for home timeline elements
        current_url = driver.current_url
        if "login" in current_url.lower():
            session_status = "disconnected"
            global_browser_manager.close_driver()
            global_browser_manager = None
            raise HTTPException(status_code=401, detail="Login failed. Please update your cookies in config/accounts.json")
        
        session_status = "connected"
        logger.info("Browser session started successfully")
        
        return {
            "status": "connected", 
            "message": "Browser session started successfully! You can now post, retweet, and perform other actions.",
            "account_id": account_config.get("account_id", "default")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        session_status = "disconnected"
        logger.error(f"Failed to start session: {e}")
        if global_browser_manager:
            try:
                global_browser_manager.close_driver()
            except:
                pass
            global_browser_manager = None
        raise HTTPException(status_code=500, detail=f"Failed to start browser session: {str(e)}")


@app.post("/session/disconnect")
async def disconnect_session():
    """Close the browser session"""
    global global_browser_manager, session_status
    
    if global_browser_manager:
        try:
            global_browser_manager.close_driver()
        except Exception as e:
            logger.warning(f"Error closing driver: {e}")
        global_browser_manager = None
    
    session_status = "disconnected"
    return {"status": "disconnected", "message": "Browser session closed successfully"}


@app.post("/auth/connect-browser")
async def connect_browser_for_login():
    """Opens a browser window for manual login (legacy endpoint)"""
    global global_browser_manager, session_status
    
    # Force close existing to start fresh
    if global_browser_manager:
        global_browser_manager.close_driver()
        global_browser_manager = None
    
    session_status = "connecting"
    
    global_browser_manager = BrowserManager(config_loader=config_loader)
    driver = global_browser_manager.get_driver()
    driver.get("https://x.com/i/flow/login")
    
    return {"message": "Browser opened. Please log in manually on the screen.", "status": "waiting_for_user"}

@app.post("/auth/save-session")
async def save_session():
    """Saves cookies from the currently open browser"""
    global global_browser_manager, session_status
    if not global_browser_manager or not global_browser_manager.driver:
        raise HTTPException(status_code=400, detail="No browser session open")
    
    driver = global_browser_manager.driver
    cookies = driver.get_cookies()
    
    # Save to file
    cookie_path = os.path.join(CONFIG_DIR, "cookies.json")
    with open(cookie_path, "w") as f:
        json.dump(cookies, f)
        
    # Update accounts.json to point to this new cookie file
    accounts = config_loader.get_accounts_config()
    if not accounts:
        # Create a new default account entry
        new_account = {
            "account_id": "default",
            "is_active": True,
            "cookie_file_path": "config/cookies.json",
            "proxy": None,
            "post_to_community": False,
            "community_id": None,
            "community_name": None
        }
        accounts_write = [new_account]
    else:
        # Update first account
        accounts_write = accounts
        accounts_write[0]["cookie_file_path"] = "config/cookies.json"
        
    config_loader.save_accounts_config(accounts_write)
    
    # Keep the browser open - don't close it anymore!
    session_status = "connected"
    
    return {"message": "Session saved successfully! Browser remains open for actions.", "status": "saved"}

@app.get("/profile/{handle}")
async def get_profile(handle: str, user: User = Depends(get_current_user), scraper: TweetScraper = Depends(get_scraper)):
    """Get profile info + recent tweets"""
    profile = scraper.scrape_profile(handle)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found or scraping failed")
        
    tweets = scraper.scrape_tweets_from_profile(profile.profile_url, max_tweets=5)
    
    return {
        "profile": profile.dict(),
        "recent_tweets": [t.dict() for t in tweets]
    }

@app.post("/tweets")
async def post_tweet(request: TweetRequest, user: User = Depends(get_current_user), publisher: TweetPublisher = Depends(get_publisher)):
    content = TweetContent(
        text=request.text,
        local_media_paths=[request.media_path] if request.media_path else []
    )
    success = await publisher.post_new_tweet(content)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to post tweet")
    return {"message": "Tweet posted successfully"}

@app.delete("/tweets/{tweet_id}")
async def delete_tweet_endpoint(tweet_id: str, user: User = Depends(get_current_user), publisher: TweetPublisher = Depends(get_publisher)):
    success = await publisher.delete_tweet(tweet_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete tweet")
    return {"message": "Tweet deleted successfully"}

@app.post("/interactions/retweet")
async def retweet_endpoint(request: RetweetRequest, user: User = Depends(get_current_user), publisher: TweetPublisher = Depends(get_publisher)):
    # 1. Scrape the tweet first (we need the object)
    # We need a scraper instance here. 
    # Simplified: We create a dummy ScrapedTweet object with just the ID/URL if possible, 
    # BUT `retweet_or_quote` takes a `ScrapedTweet`. 
    # Let's verify if we can just scrape it quickly.
    
    scraper = TweetScraper(publisher.browser_manager) # Reuse browser
    
    # Assuming the user provided a full URL, we scrape that specific tweet
    # NOTE: The current scraper scrapes *lists* of tweets. 
    # We might need to navigate to the tweet and parse it.
    # For V1, let's navigate and try to scrape the first tweet on page.
    
    tweets = scraper.scrape_tweets_from_url(request.tweet_url, "single_tweet", max_tweets=1)
    if not tweets:
        raise HTTPException(status_code=404, detail="Could not fetch tweet to retweet")
        
    original = tweets[0]
    
    if request.quote_text:
        # Quote It
        # llm_settings_for_quote is optional, passed as None
        success = await publisher.retweet_tweet(original, quote_text_prompt_or_direct=request.quote_text)
    else:
        # Simple Retweet
        success = await publisher.retweet_tweet(original)
        
    if not success:
        raise HTTPException(status_code=500, detail="Action failed")
        
    return {"message": "Retweet/Quote successful"}


# =====================================================
# TWEET HISTORY & HEATMAP ENDPOINTS
# =====================================================

from database import (
    get_heatmap_data, 
    get_activity_stats, 
    get_tweets_for_account,
    store_tweets_batch,
    update_sync_metadata,
    get_newest_tweet_date,
    get_last_sync_info
)
from datetime import datetime, timedelta


class SyncRequest(BaseModel):
    max_days_back: int = 5  # Only fetch tweets from last N days if gap exists
    force_full_sync: bool = False  # If true, fetch all available tweets


@app.get("/tweets/history")
async def get_tweet_history(limit: int = 50, offset: int = 0):
    """Get stored tweet history from local database."""
    accounts = config_loader.get_accounts_config()
    if not accounts:
        raise HTTPException(status_code=400, detail="No account configured")
    
    account_id = accounts[0].get("account_id", "default")
    tweets = get_tweets_for_account(account_id, limit=limit, offset=offset)
    
    return {
        "account_id": account_id,
        "tweets": tweets,
        "count": len(tweets)
    }


@app.get("/tweets/heatmap")
async def get_tweets_heatmap(days: int = 365):
    """
    Get heatmap data for tweet activity visualization.
    Returns { "YYYY-MM-DD": count } for each day with activity.
    """
    accounts = config_loader.get_accounts_config()
    if not accounts:
        raise HTTPException(status_code=400, detail="No account configured")
    
    account_id = accounts[0].get("account_id", "default")
    heatmap = get_heatmap_data(account_id, days=days)
    
    return {
        "account_id": account_id,
        "heatmap": heatmap,
        "days_requested": days
    }


@app.get("/tweets/stats")
async def get_tweets_stats():
    """Get activity statistics for the account."""
    accounts = config_loader.get_accounts_config()
    if not accounts:
        raise HTTPException(status_code=400, detail="No account configured")
    
    account_id = accounts[0].get("account_id", "default")
    stats = get_activity_stats(account_id)
    sync_info = get_last_sync_info(account_id)
    
    return {
        "account_id": account_id,
        "stats": stats,
        "last_sync": sync_info
    }


@app.post("/tweets/sync")
async def sync_tweets(request: SyncRequest = SyncRequest()):
    """
    Sync tweets from user's profile.
    Implements incremental sync - only fetches new tweets since last sync.
    """
    global global_browser_manager, session_status
    
    if not global_browser_manager or not global_browser_manager.is_driver_active():
        raise HTTPException(
            status_code=400, 
            detail="Browser session not active. Please start session first."
        )
    
    accounts = config_loader.get_accounts_config()
    if not accounts:
        raise HTTPException(status_code=400, detail="No account configured")
    
    account_config = accounts[0]
    account_id = account_config.get("account_id", "default")
    
    # Determine the user's profile URL
    # Try to get handle from config or scrape from current session
    driver = global_browser_manager.get_driver()
    
    try:
        # Navigate to home to get current user info
        driver.get("https://x.com/home")
        import time
        time.sleep(2)
        
        # Try to find the profile link to get the handle
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.support import expected_conditions as EC
        
        # Click on profile or find handle from the page
        profile_link = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.XPATH, "//a[@data-testid='AppTabBar_Profile_Link']"))
        )
        profile_url = profile_link.get_attribute("href")
        
        if not profile_url:
            raise HTTPException(status_code=500, detail="Could not determine user profile URL")
        
        logger.info(f"Syncing tweets from profile: {profile_url}")
        
        # Determine how far back to fetch
        newest_stored = get_newest_tweet_date(account_id)
        
        if request.force_full_sync or not newest_stored:
            # Full sync - fetch as many as reasonable
            max_tweets = 100
            cutoff_date = None
            logger.info("Performing full sync")
        else:
            # Incremental sync - only fetch tweets newer than what we have
            # Plus a buffer for the requested days
            cutoff_date = newest_stored - timedelta(days=1)  # 1 day overlap for safety
            max_tweets = 50  # Reasonable limit for incremental
            logger.info(f"Incremental sync from {cutoff_date}")
        
        # Create scraper and fetch tweets
        scraper = TweetScraper(global_browser_manager, account_id=account_id)
        tweets = scraper.scrape_tweets_from_profile(profile_url, max_tweets=max_tweets)
        
        if not tweets:
            return {
                "status": "complete",
                "message": "No tweets found to sync",
                "new_tweets": 0
            }
        
        # Filter tweets if we have a cutoff date (incremental)
        tweets_to_store = []
        for tweet in tweets:
            # Convert Pydantic model to dict with proper JSON serialization
            if hasattr(tweet, 'model_dump'):
                # Pydantic v2
                tweet_dict = tweet.model_dump(mode='json')
            elif hasattr(tweet, 'dict'):
                # Pydantic v1 - manually handle datetime
                tweet_dict = tweet.dict()
                # Convert datetime objects to strings
                for key, value in tweet_dict.items():
                    if isinstance(value, datetime):
                        tweet_dict[key] = value.isoformat()
            else:
                tweet_dict = tweet
            
            # Skip if older than cutoff (for incremental sync)
            if cutoff_date and tweet_dict.get('created_at'):
                try:
                    tweet_date = tweet_dict['created_at']
                    if isinstance(tweet_date, str):
                        tweet_date = datetime.fromisoformat(tweet_date.replace('Z', '+00:00'))
                    elif isinstance(tweet_date, datetime):
                        pass  # already datetime
                    if isinstance(tweet_date, datetime) and tweet_date < cutoff_date:
                        continue
                except Exception as parse_err:
                    logger.warning(f"Could not parse tweet date: {parse_err}")
                    pass  # If we can't parse date, include it anyway
            
            tweets_to_store.append(tweet_dict)

        
        # Store in database
        new_count = store_tweets_batch(tweets_to_store, account_id)
        
        # Update sync metadata
        newest_id = tweets_to_store[0].get('tweet_id') if tweets_to_store else None
        update_sync_metadata(account_id, newest_id)
        
        stats = get_activity_stats(account_id)
        
        return {
            "status": "complete",
            "message": f"Synced {new_count} new tweets",
            "new_tweets": new_count,
            "total_scraped": len(tweets),
            "total_stored": stats['total_tweets'],
            "current_streak": stats['current_streak']
        }
        
    except Exception as e:
        logger.error(f"Sync failed: {e}")
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")


# =====================================================
# CHATBOT ENDPOINTS
# =====================================================

from groq_service import groq_service, AVAILABLE_MODELS
from database import (
    save_profile_chat_message,
    get_profile_chat_history,
    clear_profile_chat,
    save_profile_insight,
    get_profile_insights,
    save_general_chat_message,
    get_general_chat_history,
    get_chat_settings,
    update_chat_settings,
    get_profile_context_summary
)
import uuid


class ChatMessage(BaseModel):
    message: str
    image_data: Optional[str] = None  # Base64 encoded image
    model: Optional[str] = None


class GeneralChatMessage(BaseModel):
    message: str
    session_id: Optional[str] = None
    image_data: Optional[str] = None
    model: Optional[str] = None
    use_profile_context: Optional[bool] = None


class ChatSettingsUpdate(BaseModel):
    text_model: Optional[str] = None
    vision_model: Optional[str] = None
    use_profile_context: Optional[bool] = None


@app.get("/chat/models")
async def get_available_models():
    """Get list of available chat models."""
    return {
        "models": AVAILABLE_MODELS,
        "default_text": "openai/gpt-oss-120b",
        "default_vision": "meta-llama/llama-4-scout-17b-16e-instruct"
    }


@app.get("/chat/settings")
async def get_settings():
    """Get current chat settings."""
    accounts = config_loader.get_accounts_config()
    account_id = accounts[0].get("account_id", "default") if accounts else "default"
    
    settings = get_chat_settings(account_id)
    return settings


@app.post("/chat/settings")
async def update_settings(request: ChatSettingsUpdate):
    """Update chat settings."""
    accounts = config_loader.get_accounts_config()
    account_id = accounts[0].get("account_id", "default") if accounts else "default"
    
    update_chat_settings(
        account_id,
        text_model=request.text_model,
        vision_model=request.vision_model,
        use_profile_context=request.use_profile_context
    )
    
    return {"status": "success", "message": "Settings updated"}


# =====================================================
# PROFILE ANALYZER CHATBOT
# =====================================================

@app.get("/chat/profile/history")
async def get_profile_history():
    """Get profile chat history."""
    accounts = config_loader.get_accounts_config()
    account_id = accounts[0].get("account_id", "default") if accounts else "default"
    
    history = get_profile_chat_history(account_id)
    insights = get_profile_insights(account_id)
    
    return {
        "messages": history,
        "insights": insights
    }


@app.post("/chat/profile")
async def profile_chat(request: ChatMessage):
    """Send a message to the profile analyzer chatbot."""
    accounts = config_loader.get_accounts_config()
    account_id = accounts[0].get("account_id", "default") if accounts else "default"
    
    settings = get_chat_settings(account_id)
    
    # Determine model to use
    if request.image_data:
        model = request.model or settings['default_vision_model']
    else:
        model = request.model or settings['default_text_model']
    
    # Get conversation history
    history = get_profile_chat_history(account_id)
    history_for_llm = [{"role": msg["role"], "content": msg["content"]} for msg in history]
    
    # Save user message
    save_profile_chat_message(
        account_id, 
        "user", 
        request.message, 
        model_used=model,
        has_image=bool(request.image_data)
    )
    
    try:
        # Get response from Groq
        response = await groq_service.profile_chat(
            user_message=request.message,
            history=history_for_llm,
            model=model,
            image_data=request.image_data
        )
        
        # Save assistant response
        save_profile_chat_message(account_id, "assistant", response, model_used=model)
        
        return {
            "response": response,
            "model_used": model
        }
        
    except Exception as e:
        logger.error(f"Profile chat error: {e}")
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")


@app.post("/chat/profile/clear")
async def clear_profile_history():
    """Clear profile chat history."""
    accounts = config_loader.get_accounts_config()
    account_id = accounts[0].get("account_id", "default") if accounts else "default"
    
    clear_profile_chat(account_id)
    return {"status": "success", "message": "Profile chat history cleared"}


@app.post("/chat/profile/extract-insights")
async def extract_insights():
    """Extract and save insights from profile conversation."""
    accounts = config_loader.get_accounts_config()
    account_id = accounts[0].get("account_id", "default") if accounts else "default"
    
    settings = get_chat_settings(account_id)
    history = get_profile_chat_history(account_id)
    
    if not history:
        raise HTTPException(status_code=400, detail="No conversation history to extract from")
    
    history_for_llm = [{"role": msg["role"], "content": msg["content"]} for msg in history]
    
    try:
        insights = await groq_service.extract_profile_insights(
            history_for_llm,
            model=settings['default_text_model']
        )
        
        # Save each insight
        for insight_type, insight_value in insights.items():
            if insight_value:
                save_profile_insight(account_id, insight_type, str(insight_value))
        
        return {
            "status": "success",
            "insights_extracted": len(insights),
            "insights": insights
        }
        
    except Exception as e:
        logger.error(f"Insight extraction error: {e}")
        raise HTTPException(status_code=500, detail=f"Extraction error: {str(e)}")


@app.get("/chat/profile/insights")
async def get_insights():
    """Get saved profile insights."""
    accounts = config_loader.get_accounts_config()
    account_id = accounts[0].get("account_id", "default") if accounts else "default"
    
    insights = get_profile_insights(account_id)
    context = get_profile_context_summary(account_id)
    
    return {
        "insights": insights,
        "context_summary": context
    }


# =====================================================
# GENERAL CHATBOT
# =====================================================

@app.get("/chat/general/history/{session_id}")
async def get_general_history(session_id: str):
    """Get general chat history for a session."""
    history = get_general_chat_history(session_id)
    return {"messages": history, "session_id": session_id}


@app.post("/chat/general")
async def general_chat(request: GeneralChatMessage):
    """Send a message to the general chatbot."""
    accounts = config_loader.get_accounts_config()
    account_id = accounts[0].get("account_id", "default") if accounts else "default"
    
    settings = get_chat_settings(account_id)
    
    # Generate session ID if not provided
    session_id = request.session_id or str(uuid.uuid4())
    
    # Determine if we should use profile context
    use_context = request.use_profile_context
    if use_context is None:
        use_context = bool(settings.get('use_profile_context', 1))
    
    # Determine model to use
    if request.image_data:
        model = request.model or settings['default_vision_model']
    else:
        model = request.model or settings['default_text_model']
    
    # Get conversation history for this session
    history = get_general_chat_history(session_id)
    history_for_llm = [{"role": msg["role"], "content": msg["content"]} for msg in history]
    
    # Get profile context if enabled
    profile_context = None
    if use_context:
        profile_context = get_profile_context_summary(account_id)
    
    # Save user message
    save_general_chat_message(
        account_id,
        session_id,
        "user",
        request.message,
        model_used=model,
        used_profile_context=use_context
    )
    
    try:
        # Get response from Groq
        response = await groq_service.general_chat(
            user_message=request.message,
            history=history_for_llm,
            profile_context=profile_context,
            model=model,
            image_data=request.image_data
        )
        
        # Save assistant response
        save_general_chat_message(
            account_id,
            session_id,
            "assistant",
            response,
            model_used=model,
            used_profile_context=use_context
        )
        
        return {
            "response": response,
            "session_id": session_id,
            "model_used": model,
            "used_profile_context": use_context
        }
        
    except Exception as e:
        logger.error(f"General chat error: {e}")
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")


@app.post("/chat/general/new-session")
async def new_general_session():
    """Start a new general chat session."""
    return {"session_id": str(uuid.uuid4())}

