"""
Demo script to test the tweet posting feature with an image.

This script demonstrates how to post a tweet with media to Twitter/X.

Usage:
    python src/demo_post_tweet.py

Make sure you have:
1. Set up your cookies in config/accounts.json
2. Installed all requirements (pip install -r requirements.txt)
"""

import os
import sys
import asyncio

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.core.browser_manager import BrowserManager
from src.core.config_loader import ConfigLoader
from src.core.llm_service import LLMService
from src.features.publisher.orchestrator import TweetPublisher
from src.data_models import TweetContent, AccountConfig
from src.utils.logger import setup_logger
import logging

# Initialize config and logger
config = ConfigLoader()
setup_logger(config)
logger = logging.getLogger(__name__)


async def post_tweet_with_image(tweet_text: str, image_path: str):
    """
    Post a tweet with an image to Twitter/X.
    
    Args:
        tweet_text: The text content of the tweet
        image_path: Path to the image file to attach
    """
    print("\n" + "=" * 60)
    print("TWITTER/X TWEET POSTER")
    print("=" * 60)
    print(f"\nTweet Text: {tweet_text}")
    print(f"Image: {image_path}")
    print("=" * 60 + "\n")
    
    browser_manager = None
    try:
        print("Initializing browser...")
        
        # Load account config
        accounts = config.get_accounts_config()
        if not accounts:
            print("ERROR: No accounts configured in config/accounts.json")
            return False
        
        account_dict = accounts[0]
        account_id = account_dict.get("account_id", "default")
        print(f"Using account: {account_id}")
        
        # Convert dict to AccountConfig object
        account_config = AccountConfig(**account_dict)
        
        # Initialize browser with account config
        browser_manager = BrowserManager(account_config=account_dict, config_loader=config)
        
        # Initialize LLM service (needed for TweetPublisher even if not using AI generation)
        llm_service = LLMService(config)
        
        # Initialize the publisher
        publisher = TweetPublisher(
            browser_manager=browser_manager,
            llm_service=llm_service,
            account_config=account_config
        )
        
        # Prepare tweet content with media
        # Ensure the image path is absolute
        if not os.path.isabs(image_path):
            image_path = os.path.abspath(image_path)
        
        if not os.path.exists(image_path):
            print(f"ERROR: Image file not found at: {image_path}")
            return False
        
        print(f"Image file verified: {image_path}")
        
        # Create tweet content with the image
        content = TweetContent(
            text=tweet_text,
            local_media_paths=[image_path]
        )
        
        print("\nPosting tweet... (this may take a few seconds)")
        
        # Post the tweet
        success = await publisher.post_new_tweet(content)
        
        if success:
            print("\n" + "=" * 60)
            print("SUCCESS! Tweet posted successfully!")
            print("=" * 60)
            return True
        else:
            print("\n" + "=" * 60)
            print("FAILED: Could not post the tweet.")
            print("Check the logs for more details.")
            print("=" * 60)
            return False
            
    except Exception as e:
        logger.error(f"Error during tweet posting: {e}", exc_info=True)
        print(f"\nERROR: {e}")
        return False
    finally:
        if browser_manager:
            print("\nClosing browser...")
            browser_manager.close_driver()


def main():
    # Tweet content
    tweet_text = "Hi guys my work on twitter automation saas has been started"
    
    # Image path (relative to project root)
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    image_path = os.path.join(project_root, "media_files", "twitter_automation_saas.jpg")
    
    print("\n" + "=" * 60)
    print("  TWEET POSTING DEMO")
    print("  Post a tweet with image to Twitter/X")
    print("=" * 60)
    
    # Run the async function
    result = asyncio.run(post_tweet_with_image(tweet_text, image_path))
    
    if result:
        print("\nDemo completed successfully!")
    else:
        print("\nDemo encountered issues. Check the logs for more details.")
    
    print("\n")


if __name__ == "__main__":
    main()
