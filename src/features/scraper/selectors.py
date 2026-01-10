THREAD_INDICATORS = [
    r"\(\d+/\d+\)",
    r"\d+/\d+",
    "thread",
    "🧵",
    r"1\.",
    r"a\.",
    r"i\.",
]

# XPath/CSS selectors used by the scraper
X_TWEET_ARTICLE_XPATH = "//article[@data-testid='tweet']"
X_USER_NAME_XPATH = "//div[@data-testid='User-Name']//span[1]//span"
X_USER_HANDLE_XPATH = "//div[@data-testid='User-Name']//span[contains(text(), '@')]"
X_TWEET_TEXT_XPATH = "//div[@data-testid='tweetText']//span | //div[@data-testid='tweetText']//a"
X_STATUS_LINK_XPATH = "//a[contains(@href, '/status/') and .//time]"
X_TIME_TAG = ".//time"
X_ENGAGEMENT_BUTTON_XPATH = (
    "//button[@data-testid='{testid}']//span[@data-testid='app-text-transition-container']//span"
)
X_ANALYTICS_VIEW_XPATH = (
    "//a[contains(@href, '/analytics')]//span[@data-testid='app-text-transition-container']//span"
)
X_HASHTAG_LINKS_XPATH = "//a[contains(@href, 'src=hashtag_click')]"
X_MENTION_LINKS_XPATH = "//div[@data-testid='tweetText']//a[contains(text(), '@')]"
X_PROFILE_IMG_XPATH = "//div[@data-testid='Tweet-User-Avatar']//img"
X_MEDIA_XPATH = (
    "//div[@data-testid='tweetPhoto']//img | //div[contains(@data-testid, 'videoPlayer')]//video"
)
X_VERIFIED_ICON_SVG = "//*[local-name()='svg' and @data-testid='icon-verified']"

# Profile page selectors (for extracting user profile details)
# Header section
PROFILE_USER_NAME_XPATH = "//div[@data-testid='UserName']//span[1]//span"
PROFILE_USER_HANDLE_XPATH = "//div[@data-testid='UserName']//span[contains(text(), '@')]"
PROFILE_BIO_XPATH = "//div[@data-testid='UserDescription']"
PROFILE_LOCATION_XPATH = "//span[@data-testid='UserLocation']"
PROFILE_URL_XPATH = "//a[@data-testid='UserUrl']"
PROFILE_JOINED_DATE_XPATH = "//span[@data-testid='UserJoinDate']"
PROFILE_BIRTHDATE_XPATH = "//span[@data-testid='UserBirthdate']"

# Profile stats - multiple patterns for better coverage
# Note: First span usually has the number, can be formatted like "10.5K" 
PROFILE_FOLLOWING_LINK_XPATH = "//a[contains(@href, '/following')]//span[@class] | //a[contains(@href, '/following')]/span"
PROFILE_FOLLOWERS_LINK_XPATH = "//a[contains(@href, '/followers') or contains(@href, '/verified_followers')]//span[@class] | //a[contains(@href, '/followers')]/span"

# Profile images
PROFILE_AVATAR_XPATH = "//div[@data-testid='UserAvatar-Container-unknown']//img | //a[contains(@href, '/photo')]//img[@src and contains(@src, 'profile_images')]"
PROFILE_BANNER_XPATH = "//div[@data-testid='UserProfileHeader_Items']//ancestor::div[contains(@style, 'background-image')] | //a[contains(@href, '/header_photo')]//img"

# Verification badges
PROFILE_VERIFIED_BADGE_XPATH = "//div[@data-testid='UserName']//*[local-name()='svg' and @data-testid='icon-verified']"

# Protected/private account indicator
PROFILE_PROTECTED_XPATH = "//div[@data-testid='UserName']//*[local-name()='svg' and contains(@aria-label, 'Protected')]"

