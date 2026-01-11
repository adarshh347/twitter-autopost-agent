import logging
import time
import random
from typing import Optional

from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException, ElementClickInterceptedException

from core.browser_manager import BrowserManager
from features.scraper.selectors import (
    TWEET_CARET_XPATH,
    MENU_DELETE_ITEM_XPATH,
    DELETE_CONFIRM_BUTTON_XPATH
)
from utils.selenium_waits import wait_for_any_present

logger = logging.getLogger(__name__)

def delete_tweet_by_id(
    browser_manager: BrowserManager,
    tweet_id: str,
) -> bool:
    """
    Deletes a tweet by navigating to its URL and using the delete menu action.
    
    Args:
        browser_manager: BrowserManager instance with active session
        tweet_id: The ID of the tweet to delete
        
    Returns:
        bool: True if deletion was successful (or appeared to be), False otherwise.
    """
    driver = browser_manager.get_driver()
    tweet_url = f"https://x.com/i/status/{tweet_id}"
    
    logger.info(f"Attempting to delete tweet: {tweet_url}")
    
    try:
        driver.get(tweet_url)
        time.sleep(random.uniform(2.0, 3.5))
        
        # 1. Look for the Caret (Menu) button or check if tweet exists
        try:
            caret_btn = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.XPATH, TWEET_CARET_XPATH))
            )
        except TimeoutException:
            # Check if tweet is already missing (e.g. "This Post was deleted")
            if "deleted" in driver.page_source.lower() or "not exist" in driver.page_source.lower():
                logger.info("Tweet appears to be already deleted or not finding caret.")
                return True
            logger.error("Could not find the 'More' menu (caret) button. Tweet might not belong to user or selector changed.")
            return False
            
        caret_btn.click()
        time.sleep(random.uniform(0.8, 1.5))
        
        # 2. Click "Delete" in the menu
        try:
            delete_item = WebDriverWait(driver, 5).until(
                EC.element_to_be_clickable((By.XPATH, MENU_DELETE_ITEM_XPATH))
            )
            delete_item.click()
        except TimeoutException:
            logger.error("'Delete' option not found in menu. Are you logged in as the tweet author?")
            return False
            
        time.sleep(random.uniform(0.5, 1.0))
        
        # 3. Confirm Deletion
        try:
            confirm_btn = WebDriverWait(driver, 5).until(
                EC.element_to_be_clickable((By.XPATH, DELETE_CONFIRM_BUTTON_XPATH))
            )
            confirm_btn.click()
        except TimeoutException:
            logger.error("Confirmation popup did not appear.")
            return False
            
        logger.info(f"Successfully triggered deletion for tweet {tweet_id}")
        time.sleep(random.uniform(2.0, 3.0))
        return True
        
    except Exception as e:
        logger.error(f"Failed to delete tweet {tweet_id}: {e}", exc_info=True)
        return False
