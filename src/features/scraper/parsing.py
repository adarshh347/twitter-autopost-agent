import logging
import re
from typing import Optional, List
from datetime import datetime

from selenium.webdriver.common.by import By
from selenium.common.exceptions import NoSuchElementException, StaleElementReferenceException
from selenium.webdriver.remote.webelement import WebElement

try:
    from ...data_models import ScrapedTweet, ScrapedProfile
except Exception:  # pragma: no cover - fallback when running directly
    from src.data_models import ScrapedTweet, ScrapedProfile  # type: ignore

from .selectors import (
    THREAD_INDICATORS,
    X_USER_NAME_XPATH,
    X_USER_HANDLE_XPATH,
    X_TWEET_TEXT_XPATH,
    X_STATUS_LINK_XPATH,
    X_TIME_TAG,
    X_ENGAGEMENT_BUTTON_XPATH,
    X_ANALYTICS_VIEW_XPATH,
    X_HASHTAG_LINKS_XPATH,
    X_MENTION_LINKS_XPATH,
    X_PROFILE_IMG_XPATH,
    X_MEDIA_XPATH,
    X_VERIFIED_ICON_SVG,
    # Profile page selectors
    PROFILE_USER_NAME_XPATH,
    PROFILE_USER_HANDLE_XPATH,
    PROFILE_BIO_XPATH,
    PROFILE_LOCATION_XPATH,
    PROFILE_URL_XPATH,
    PROFILE_JOINED_DATE_XPATH,
    PROFILE_BIRTHDATE_XPATH,
    PROFILE_FOLLOWING_LINK_XPATH,
    PROFILE_FOLLOWERS_LINK_XPATH,
    PROFILE_AVATAR_XPATH,
    PROFILE_BANNER_XPATH,
    PROFILE_VERIFIED_BADGE_XPATH,
    PROFILE_PROTECTED_XPATH,
)


def _parse_int_from_text(text: str) -> int:
    if not text:
        return 0
    text = text.strip()
    try:
        if "K" in text:
            return int(float(text.replace("K", "")) * 1000)
        if "M" in text:
            return int(float(text.replace("M", "")) * 1_000_000)
        return int(text)
    except Exception:
        return 0


def _get_count(card_element: WebElement, testid: str) -> int:
    try:
        element = card_element.find_element(
            By.XPATH, f".{X_ENGAGEMENT_BUTTON_XPATH.format(testid=testid)}"
        )
        return _parse_int_from_text(element.text)
    except (NoSuchElementException, StaleElementReferenceException):
        return 0


def parse_tweet_card(card_element: WebElement, logger: logging.Logger) -> Optional[ScrapedTweet]:
    try:
        user_name = None
        try:
            user_name_element = card_element.find_element(By.XPATH, f".{X_USER_NAME_XPATH}")
            user_name = user_name_element.text if user_name_element else None
        except (NoSuchElementException, StaleElementReferenceException):
            pass

        user_handle = None
        try:
            user_handle_element = card_element.find_element(By.XPATH, f".{X_USER_HANDLE_XPATH}")
            user_handle = user_handle_element.text if user_handle_element else None
        except (NoSuchElementException, StaleElementReferenceException):
            pass

        tweet_text_parts: List[str] = []
        try:
            text_elements = card_element.find_elements(By.XPATH, f".{X_TWEET_TEXT_XPATH}")
            for el in text_elements:
                try:
                    tweet_text_parts.append(el.text)
                except StaleElementReferenceException:
                    logger.debug("Stale element reference when extracting tweet text part.")
                    continue
        except StaleElementReferenceException:
            # Entire card went stale; skip quietly
            return None
        text_content = "".join(tweet_text_parts).strip()
        if not text_content:
            return None

        tweet_id = None
        tweet_url = None
        try:
            link_element = card_element.find_element(By.XPATH, f".{X_STATUS_LINK_XPATH}")
            href = link_element.get_attribute("href")
            if href and "/status/" in href:
                tweet_url = href
                tweet_id = href.split("/status/")[-1].split("?")[0]
        except (NoSuchElementException, StaleElementReferenceException):
            logger.debug("Could not find tweet link/ID element for a card (missing or stale).")
            return None

        created_at_dt = None
        try:
            time_element = card_element.find_element(By.XPATH, X_TIME_TAG)
            datetime_str = time_element.get_attribute("datetime")
            if datetime_str:
                created_at_dt = datetime.fromisoformat(datetime_str.replace("Z", "+00:00"))
        except (NoSuchElementException, StaleElementReferenceException):
            logger.debug(f"Timestamp not found for tweet ID {tweet_id}")

        reply_count = _get_count(card_element, "reply")
        retweet_count = _get_count(card_element, "retweet")
        like_count = _get_count(card_element, "like")

        view_count = 0
        try:
            view_element = card_element.find_element(By.XPATH, f".{X_ANALYTICS_VIEW_XPATH}")
            view_count = _parse_int_from_text(view_element.text)
        except (NoSuchElementException, StaleElementReferenceException):
            pass

        tags = [tag.text for tag in card_element.find_elements(By.XPATH, f".{X_HASHTAG_LINKS_XPATH}")]
        mentions = [
            mention.text for mention in card_element.find_elements(By.XPATH, f".{X_MENTION_LINKS_XPATH}")
        ]

        profile_image_url = None
        try:
            img_element = card_element.find_element(By.XPATH, f".{X_PROFILE_IMG_XPATH}")
            profile_image_url = img_element.get_attribute("src")
        except (NoSuchElementException, StaleElementReferenceException):
            pass

        embedded_media_urls: List[str] = []
        media_elements = card_element.find_elements(By.XPATH, f".{X_MEDIA_XPATH}")
        for media_el in media_elements:
            src = media_el.get_attribute("src") or media_el.get_attribute("poster")
            if src:
                embedded_media_urls.append(src)

        is_verified = False
        try:
            card_element.find_element(By.XPATH, f".{X_VERIFIED_ICON_SVG}")
            is_verified = True
        except (NoSuchElementException, StaleElementReferenceException):
            pass

        is_thread_candidate = False
        for indicator in THREAD_INDICATORS:
            if re.search(indicator, text_content, re.IGNORECASE):
                is_thread_candidate = True
                break
        # Heuristic around self-replies omitted (uncertain without reliable selector)

        return ScrapedTweet(
            tweet_id=tweet_id,
            user_name=user_name,
            user_handle=user_handle,
            user_is_verified=is_verified,
            created_at=created_at_dt,
            text_content=text_content,
            reply_count=reply_count,
            retweet_count=retweet_count,
            like_count=like_count,
            view_count=view_count,
            tags=tags,
            mentions=mentions,
            tweet_url=tweet_url,
            profile_image_url=profile_image_url,
            embedded_media_urls=list(set(embedded_media_urls)),
            is_thread_candidate=is_thread_candidate,
        )

    except StaleElementReferenceException:
        # Dynamic DOM updates can stale cards mid-parse; skip without noise
        logger.debug("Tweet card went stale during parsing; skipping.")
        return None
    except Exception as e:  # Catch-all to avoid breaking the loop
        logger.error(f"Error parsing tweet card: {e}", exc_info=True)
        return None


def parse_profile_page(driver, profile_url: str, logger: logging.Logger) -> Optional[ScrapedProfile]:
    """
    Parse a Twitter/X profile page to extract user details.
    
    Args:
        driver: Selenium WebDriver instance positioned on the profile page
        profile_url: The URL of the profile being scraped
        logger: Logger instance for logging
        
    Returns:
        ScrapedProfile object with extracted data, or None if parsing fails
    """
    try:
        # Extract user name
        user_name = None
        try:
            name_elements = driver.find_elements(By.XPATH, PROFILE_USER_NAME_XPATH)
            if name_elements:
                user_name = name_elements[0].text.strip()
        except (NoSuchElementException, StaleElementReferenceException):
            pass
        
        # Extract user handle
        user_handle = None
        try:
            handle_elements = driver.find_elements(By.XPATH, PROFILE_USER_HANDLE_XPATH)
            if handle_elements:
                user_handle = handle_elements[0].text.strip()
        except (NoSuchElementException, StaleElementReferenceException):
            pass
        
        # If we couldn't get the handle, try extracting from URL
        if not user_handle and profile_url:
            # Extract from URL like https://x.com/Tony_dsgn
            parts = profile_url.rstrip('/').split('/')
            if parts:
                user_handle = f"@{parts[-1]}"
        
        if not user_name and not user_handle:
            logger.warning("Could not extract user name or handle from profile page")
            return None
        
        # Extract bio/description
        bio = None
        try:
            bio_element = driver.find_element(By.XPATH, PROFILE_BIO_XPATH)
            bio = bio_element.text.strip() if bio_element else None
        except (NoSuchElementException, StaleElementReferenceException):
            pass
        
        # Extract location
        location = None
        try:
            location_element = driver.find_element(By.XPATH, PROFILE_LOCATION_XPATH)
            location = location_element.text.strip() if location_element else None
        except (NoSuchElementException, StaleElementReferenceException):
            pass
        
        # Extract website
        website = None
        try:
            url_element = driver.find_element(By.XPATH, PROFILE_URL_XPATH)
            website = url_element.get_attribute("href") or url_element.text.strip()
        except (NoSuchElementException, StaleElementReferenceException):
            pass
        
        # Extract joined date
        joined_date = None
        try:
            joined_element = driver.find_element(By.XPATH, PROFILE_JOINED_DATE_XPATH)
            joined_date = joined_element.text.strip() if joined_element else None
        except (NoSuchElementException, StaleElementReferenceException):
            pass
        
        # Extract birthdate if available
        birth_date = None
        try:
            birth_element = driver.find_element(By.XPATH, PROFILE_BIRTHDATE_XPATH)
            birth_date = birth_element.text.strip() if birth_element else None
        except (NoSuchElementException, StaleElementReferenceException):
            pass
        
        # Extract following count - try multiple approaches
        following_count = 0
        try:
            # Approach 1: Use the link with '/following' in href
            following_elements = driver.find_elements(By.XPATH, PROFILE_FOLLOWING_LINK_XPATH)
            for elem in following_elements:
                text = elem.text.strip()
                if text and len(text) > 0 and text[0].isdigit():
                    following_count = _parse_int_from_text(text)
                    logger.debug(f"Following count from selector: {following_count}")
                    break
            
            # Approach 2: If not found, try finding by link text containing "Following"
            if following_count == 0:
                following_links = driver.find_elements(By.XPATH, "//a[contains(@href, '/following')]")
                for link in following_links:
                    full_text = link.text.strip()
                    if "Following" in full_text:
                        # Extract number from text like "123 Following"
                        parts = full_text.split()
                        for part in parts:
                            if part[0].isdigit() if part else False:
                                following_count = _parse_int_from_text(part)
                                logger.debug(f"Following count from link text: {following_count}")
                                break
                        break
        except (NoSuchElementException, StaleElementReferenceException) as e:
            logger.debug(f"Error extracting following count: {e}")
        
        # Extract followers count - try multiple approaches
        followers_count = 0
        try:
            # Approach 1: Use the link with '/followers' or '/verified_followers' in href
            followers_elements = driver.find_elements(By.XPATH, PROFILE_FOLLOWERS_LINK_XPATH)
            for elem in followers_elements:
                text = elem.text.strip()
                if text and len(text) > 0 and text[0].isdigit():
                    followers_count = _parse_int_from_text(text)
                    logger.debug(f"Followers count from selector: {followers_count}")
                    break
            
            # Approach 2: If not found, try finding by link containing "Followers" text
            if followers_count == 0:
                followers_links = driver.find_elements(By.XPATH, "//a[contains(@href, '/followers') or contains(@href, '/verified_followers')]")
                for link in followers_links:
                    full_text = link.text.strip()
                    if "Follower" in full_text:
                        # Extract number from text like "24.4K Followers"
                        parts = full_text.split()
                        for part in parts:
                            if part[0].isdigit() if part else False:
                                followers_count = _parse_int_from_text(part)
                                logger.debug(f"Followers count from link text: {followers_count}")
                                break
                        break
        except (NoSuchElementException, StaleElementReferenceException) as e:
            logger.debug(f"Error extracting followers count: {e}")
        
        # Extract profile image URL
        profile_image_url = None
        try:
            avatar_elements = driver.find_elements(By.XPATH, PROFILE_AVATAR_XPATH)
            for elem in avatar_elements:
                src = elem.get_attribute("src")
                if src and "profile_images" in src:
                    profile_image_url = src
                    break
        except (NoSuchElementException, StaleElementReferenceException):
            pass
        
        # Extract banner image URL
        banner_image_url = None
        try:
            banner_elements = driver.find_elements(By.XPATH, PROFILE_BANNER_XPATH)
            for elem in banner_elements:
                # Try getting src first (for img elements)
                src = elem.get_attribute("src")
                if src and "banner" in src.lower():
                    banner_image_url = src
                    break
                # Try getting background-image style (for div elements)
                style = elem.get_attribute("style")
                if style and "background-image" in style:
                    # Extract URL from style
                    match = re.search(r'url\(["\']?(.*?)["\']?\)', style)
                    if match:
                        banner_image_url = match.group(1)
                        break
        except (NoSuchElementException, StaleElementReferenceException):
            pass
        
        # Check if verified
        is_verified = False
        try:
            driver.find_element(By.XPATH, PROFILE_VERIFIED_BADGE_XPATH)
            is_verified = True
        except (NoSuchElementException, StaleElementReferenceException):
            pass
        
        # Check if protected/private
        is_protected = False
        try:
            driver.find_element(By.XPATH, PROFILE_PROTECTED_XPATH)
            is_protected = True
        except (NoSuchElementException, StaleElementReferenceException):
            pass
        
        return ScrapedProfile(
            user_name=user_name or "Unknown",
            user_handle=user_handle or "Unknown",
            bio=bio,
            location=location,
            website=website,
            joined_date=joined_date,
            birth_date=birth_date,
            followers_count=followers_count,
            following_count=following_count,
            is_verified=is_verified,
            is_protected=is_protected,
            profile_image_url=profile_image_url,
            banner_image_url=banner_image_url,
            profile_url=profile_url,
        )
        
    except Exception as e:
        logger.error(f"Error parsing profile page: {e}", exc_info=True)
        return None
