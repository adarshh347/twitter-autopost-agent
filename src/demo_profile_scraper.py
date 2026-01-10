"""
Demo script to test the profile scraping feature.

This script demonstrates how to search and extract details from a Twitter/X profile.
Example: https://x.com/Tony_dsgn

Usage:
    python src/demo_profile_scraper.py

Make sure you have:
1. Set up your cookies in config/accounts.json
2. Installed all requirements (pip install -r requirements.txt)
"""

import os
import sys
import json

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.core.browser_manager import BrowserManager
from src.core.config_loader import ConfigLoader
from src.features.scraper import TweetScraper
from src.utils.logger import setup_logger
import logging

# Initialize config and logger
config = ConfigLoader()
setup_logger(config)
logger = logging.getLogger(__name__)


def scrape_profile_details(profile_url: str):
    """
    Scrape and display profile details from a Twitter/X profile URL.
    
    Args:
        profile_url: The URL of the profile to scrape (e.g., "https://x.com/Tony_dsgn")
    """
    print("\n" + "=" * 60)
    print("🔍 TWITTER/X PROFILE SCRAPER")
    print("=" * 60)
    print(f"\n📎 Target Profile: {profile_url}\n")
    
    # Initialize browser manager
    browser_manager = None
    try:
        print("🌐 Initializing browser...")
        
        # Load account config if available (cookies will be loaded automatically)
        accounts = config.get_accounts_config()
        account = None
        if accounts:
            account = accounts[0]  # Use first account
            account_id = account.get("account_id", "default")
            print(f"🍪 Using account: {account_id}")
        
        # Initialize browser with account config (cookies will be loaded in __init__)
        browser_manager = BrowserManager(account_config=account, config_loader=config)
        
        # Initialize scraper
        scraper = TweetScraper(browser_manager)
        
        print("⏳ Scraping profile details... (this may take a few seconds)")
        
        # Scrape the profile
        profile = scraper.scrape_profile(profile_url)
        
        if profile:
            print("\n" + "=" * 60)
            print("✅ PROFILE DETAILS EXTRACTED SUCCESSFULLY!")
            print("=" * 60)
            
            print(f"\n👤 Name: {profile.user_name}")
            print(f"🔗 Handle: {profile.user_handle}")
            print(f"📝 Bio: {profile.bio or 'N/A'}")
            print(f"📍 Location: {profile.location or 'N/A'}")
            print(f"🌐 Website: {profile.website or 'N/A'}")
            print(f"📅 Joined: {profile.joined_date or 'N/A'}")
            print(f"🎂 Birthday: {profile.birth_date or 'N/A'}")
            print(f"\n📊 STATS:")
            print(f"   👥 Followers: {profile.followers_count:,}")
            print(f"   👣 Following: {profile.following_count:,}")
            print(f"   ✅ Verified: {'Yes' if profile.is_verified else 'No'}")
            print(f"   🔒 Protected: {'Yes' if profile.is_protected else 'No'}")
            print(f"\n🖼️ IMAGES:")
            print(f"   Avatar: {profile.profile_image_url or 'N/A'}")
            print(f"   Banner: {profile.banner_image_url or 'N/A'}")
            
            # Save to JSON file
            output_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
            os.makedirs(output_dir, exist_ok=True)
            
            # Create clean filename from handle
            handle_clean = profile.user_handle.replace("@", "").lower()
            output_file = os.path.join(output_dir, f"profile_{handle_clean}.json")
            
            with open(output_file, "w", encoding="utf-8") as f:
                json.dump(profile.model_dump(), f, indent=2, default=str)
            
            print(f"\n💾 Profile data saved to: {output_file}")
            
            return profile
        else:
            print("\n❌ Failed to extract profile details.")
            print("   Possible reasons:")
            print("   - Profile may be private/protected")
            print("   - Profile may not exist")
            print("   - Login session may have expired")
            return None
            
    except Exception as e:
        logger.error(f"Error during profile scraping: {e}", exc_info=True)
        print(f"\n❌ Error: {e}")
        return None
    finally:
        if browser_manager:
            print("\n🔒 Closing browser...")
            browser_manager.close_driver()


def main():
    # Target profile to scrape
    target_profile = "https://x.com/Tony_dsgn"
    
    print("\n" + "🚀" * 20)
    print("\n  PROFILE SCRAPER DEMO")
    print("  Extract details from any Twitter/X profile")
    print("\n" + "🚀" * 20)
    
    # Run the scraper
    profile = scrape_profile_details(target_profile)
    
    if profile:
        print("\n" + "=" * 60)
        print("🎉 DEMO COMPLETED SUCCESSFULLY!")
        print("=" * 60)
        print("\nYou can now use this feature in your own code:")
        print("```python")
        print("from src.features.scraper import TweetScraper")
        print("")
        print("scraper = TweetScraper(browser_manager)")
        print("profile = scraper.scrape_profile('https://x.com/username')")
        print("print(profile.followers_count)")
        print("```")
    else:
        print("\n⚠️ Demo encountered issues. Check the logs for more details.")
    
    print("\n")


if __name__ == "__main__":
    main()
