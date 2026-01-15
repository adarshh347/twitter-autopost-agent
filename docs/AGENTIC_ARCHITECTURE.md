# Agentic AI Architecture for Twitter Automation

## A Comprehensive Guide to Implementing LangChain Tool-Calling Agents

This document provides an elaborate, theory-driven yet code-focused explanation of how to transform your current chatbot into an **agentic AI system** - similar to how Cursor/Antigravity works.

---

## Table of Contents

1. [Theory: What is an Agentic AI?](#1-theory-what-is-an-agentic-ai)
2. [The ReAct Pattern](#2-the-react-pattern)
3. [LangChain Agent Architecture](#3-langchain-agent-architecture)
4. [Your Current Architecture vs. Agentic Architecture](#4-your-current-architecture-vs-agentic-architecture)
5. [Defining Tools from Your Existing Services](#5-defining-tools-from-your-existing-services)
6. [Complete Implementation Code](#6-complete-implementation-code)
7. [Frontend Integration](#7-frontend-integration)
8. [Example Flows](#8-example-flows)

---

## 1. Theory: What is an Agentic AI?

### The Problem with Traditional Chatbots

Your current chatbot (`GlobalChatSidebar.tsx` → `groq_service.py`) follows a **simple pattern**:

```
User Message → LLM → Text Response
```

This is **reactive** and **stateless in terms of action**. The LLM can only:
- Generate text
- Answer questions
- Give suggestions

It **cannot** take actions like:
- Actually post a tweet
- Analyze a specific URL
- Upload an image and generate content

### The Agentic Solution

An **Agent** is an AI system that can:
1. **Reason** about what needs to be done
2. **Select** the right tool(s) to use
3. **Execute** those tools
4. **Observe** the results
5. **Repeat** or respond to the user

```
User Message → Agent → [Think → Select Tool → Execute → Observe]* → Response
```

The `*` means this loop can happen multiple times until the agent has enough information to respond.

### Why This Matters for Your Use Case

When a user says: *"Analyze this tweet and generate a witty reply: https://x.com/elonmusk/status/123..."*

**Current System Response:**
> "Sure! Please go to the Feed AI page, paste the URL, click fetch, then generate suggestions..."

**Agentic System Response:**
> *[Internally: Detects intent → Calls `feed_ai_fetch_url` tool → Gets tweet → Calls `generate_suggestions` tool]*
> "Here's the tweet by Elon: '...' and here are 3 reply options for you:
> 1. 'Great insight! The future of...'
> 2. 'This is exactly why...'
> 3. 'Bold move! Reminds me of...'"

---

## 2. The ReAct Pattern

LangChain agents primarily use the **ReAct** (Reasoning + Acting) pattern:

### The Loop

```
                    ┌─────────────────────┐
                    │    User Message     │
                    └─────────┬───────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │         THINK (Reason)         │
              │  "What does the user want?"    │
              │  "What tool should I use?"     │
              └───────────────┬───────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │         ACT (Tool Call)        │
              │  Execute: feed_ai_fetch_url    │
              │  Args: {url: "https://..."}    │
              └───────────────┬───────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │      OBSERVE (Tool Result)     │
              │  Result: {tweet_text: "...",   │
              │           author: "@elonmusk"} │
              └───────────────┬───────────────┘
                              │
                    ┌─────────┴─────────┐
                    │ Need more tools?  │
                    └─────────┬─────────┘
                      Yes │         │ No
                          │         │
                          ▼         ▼
                    [Loop Back]   [Final Response]
```

### In Practice

The LLM is given a **scratchpad** format:

```
Thought: I need to fetch this tweet first to analyze it
Action: feed_ai_fetch_url
Action Input: {"tweet_url": "https://x.com/elonmusk/status/123"}
Observation: {"tweet_text": "AI will transform everything", "author": "@elonmusk", "likes": 50000}

Thought: Now I have the tweet, I should generate engagement suggestions
Action: generate_tweet_suggestions
Action Input: {"tweet_text": "AI will transform everything", "tweet_author": "@elonmusk"}
Observation: {"quote_tweet": "The real question is...", "reply": "Couldn't agree more!", "independent": "..."}

Thought: I now have everything needed to respond to the user
Final Answer: Here's what I found and generated for you...
```

---

## 3. LangChain Agent Architecture

### Components Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        LANGCHAIN AGENT                          │
│                                                                 │
│  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐   │
│  │   LLM (Groq)  │    │  Tool Registry│    │ Agent Executor│   │
│  │               │←──→│               │←──→│               │   │
│  │ - Reasoning   │    │ - feed_ai     │    │ - Run loop    │   │
│  │ - Tool select │    │ - curator     │    │ - Manage state│   │
│  │ - Response    │    │ - post_tweet  │    │ - Handle errs │   │
│  └───────────────┘    └───────────────┘    └───────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
    ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
    │  Feed AI    │   │  Curator    │   │  Twitter    │
    │  Service    │   │  Service    │   │  Publisher  │
    │             │   │             │   │             │
    │ fetch_url() │   │ analyze()   │   │ post()      │
    │ suggest()   │   │ generate()  │   │ reply()     │
    └─────────────┘   └─────────────┘   └─────────────┘
```

### Key Concepts

#### 3.1 Tools

A **Tool** in LangChain is a function the agent can call. It has:
- **Name**: Identifier (e.g., `feed_ai_fetch_url`)
- **Description**: What the tool does (LLM reads this to decide when to use it)
- **Parameters**: Input schema (JSON Schema format)
- **Function**: The actual Python function to execute

```python
from langchain.tools import Tool, StructuredTool
from pydantic import BaseModel, Field

# Simple tool using decorator
@tool
def fetch_tweet_from_url(url: str) -> dict:
    """Fetch a tweet from Twitter/X given its URL. Returns tweet content and metadata."""
    # Your implementation
    pass

# Structured tool with complex inputs
class GenerateSuggestionsInput(BaseModel):
    tweet_text: str = Field(description="The text content of the tweet")
    tweet_author: str = Field(description="The author's handle (e.g., @elonmusk)")
    user_instructions: str = Field(default="", description="Optional custom instructions")

@tool(args_schema=GenerateSuggestionsInput)
def generate_tweet_suggestions(tweet_text: str, tweet_author: str, user_instructions: str = "") -> dict:
    """Generate AI-powered tweet suggestions (quote, reply, independent) for a given tweet."""
    pass
```

#### 3.2 Agent

The **Agent** is the decision-making component. It uses the LLM to:
1. Parse user intent
2. Select which tool to use
3. Format tool arguments
4. Decide when to stop

```python
from langchain.agents import create_tool_calling_agent
from langchain_groq import ChatGroq

llm = ChatGroq(model="llama-3.3-70b-versatile", api_key=GROQ_API_KEY)
tools = [fetch_tweet_from_url, generate_tweet_suggestions, post_tweet, ...]

agent = create_tool_calling_agent(llm, tools, prompt)
```

#### 3.3 Agent Executor

The **AgentExecutor** runs the actual loop:

```python
from langchain.agents import AgentExecutor

agent_executor = AgentExecutor(
    agent=agent,
    tools=tools,
    verbose=True,  # Shows thinking process
    max_iterations=10,  # Prevent infinite loops
    handle_parsing_errors=True
)

# Use it
result = await agent_executor.ainvoke({"input": user_message})
```

---

## 4. Your Current Architecture vs. Agentic Architecture

### Current Flow (Non-Agentic)

```python
# backend/api.py - Current /chat/general endpoint

@app.post("/chat/general")
async def general_chat(request: GeneralChatMessage):
    # Just sends message to LLM
    response = await groq_service.general_chat(
        user_message=request.message,
        history=history_for_llm,
        profile_context=profile_context,
        model=model
    )
    return {"response": response}
```

**What happens:**
1. User sends: "Analyze https://x.com/user/status/123"
2. LLM generates text: "I'd be happy to help! Please use the Feed AI page..."
3. User has to manually do it themselves 😔

### Proposed Agentic Flow

```python
# backend/agentic_service.py - NEW

@app.post("/chat/agentic")
async def agentic_chat(request: GeneralChatMessage):
    # Agent decides what to do
    result = await agent_executor.ainvoke({
        "input": request.message,
        "chat_history": history_for_llm
    })
    return {"response": result["output"], "tool_calls": result.get("intermediate_steps", [])}
```

**What happens:**
1. User sends: "Analyze https://x.com/user/status/123"
2. Agent thinks: "User wants to analyze a tweet URL. I should use feed_ai_fetch_url"
3. Agent calls `feed_ai_fetch_url(url="https://x.com/user/status/123")`
4. Agent receives: `{"tweet_text": "...", "author": "..."}`
5. Agent thinks: "Got the tweet! Now I should generate suggestions"
6. Agent calls `generate_tweet_suggestions(...)`
7. Agent returns: "Here's the tweet analysis and 3 engagement options..."

---

## 5. Defining Tools from Your Existing Services

Based on your codebase, here are the tools we'll create:

### 5.1 Feed AI Tools

| Tool Name | Description | Maps To |
|-----------|-------------|---------|
| `feed_ai_fetch_url` | Fetch a single tweet by URL | `POST /feed/fetch-url` |
| `feed_ai_scan_timeline` | Scan home timeline | `GET /feed/scan` |
| `feed_ai_suggest` | Generate suggestions for a tweet | `POST /feed/suggest` |
| `feed_ai_refine` | Refine a draft | `POST /feed/refine` |
| `feed_ai_post` | Post/quote/reply | `POST /feed/post` |

### 5.2 Curator Tools

| Tool Name | Description | Maps To |
|-----------|-------------|---------|
| `curator_analyze_image` | Analyze image for aesthetics | `POST /curator/analyze` |
| `curator_generate_tweet` | Generate tweet for image | `POST /curator/generate` |
| `curator_get_families` | List tweet families | `GET /curator/families` |

### 5.3 Twitter Action Tools

| Tool Name | Description | Maps To |
|-----------|-------------|---------|
| `post_new_tweet` | Post a new tweet | `POST /feed/post` with action_type=post |
| `quote_tweet` | Quote a tweet | `POST /feed/post` with action_type=quote |
| `reply_to_tweet` | Reply to a tweet | `POST /feed/post` with action_type=reply |

---

## 6. Complete Implementation Code

### 6.1 Install Dependencies

```bash
pip install langchain langchain-groq langchain-core pydantic
```

### 6.2 Create the Agentic Service

```python
# backend/agentic_service.py

"""
Agentic AI Service for Twitter Automation.

This service transforms the chatbot into an intelligent agent that can:
1. Understand user intent
2. Select and execute appropriate tools
3. Chain multiple operations
4. Provide comprehensive responses
"""

import os
import asyncio
import json
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
import logging

from langchain_groq import ChatGroq
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.tools import tool, StructuredTool
from langchain.memory import ConversationBufferWindowMemory

logger = logging.getLogger(__name__)

# ============================================================
# CONFIGURATION
# ============================================================

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
DEFAULT_AGENT_MODEL = "llama-3.3-70b-versatile"  # Best for tool calling

# ============================================================
# TOOL DEFINITIONS
# ============================================================

# These are references to your existing services
# We'll import them when initializing
_groq_service = None
_browser_manager = None


def set_services(groq_service, browser_manager):
    """Initialize service references for tools to use."""
    global _groq_service, _browser_manager
    _groq_service = groq_service
    _browser_manager = browser_manager


# --------------------------------------------------------
# FEED AI TOOLS
# --------------------------------------------------------

class FetchTweetUrlInput(BaseModel):
    """Input schema for fetching a tweet from URL."""
    tweet_url: str = Field(
        description="The full Twitter/X URL of the tweet to fetch. "
                    "Example: https://x.com/elonmusk/status/1234567890 or "
                    "https://twitter.com/user/status/123"
    )


@tool("feed_ai_fetch_url", args_schema=FetchTweetUrlInput)
async def feed_ai_fetch_url(tweet_url: str) -> Dict[str, Any]:
    """
    Fetch a single tweet from Twitter/X given its direct URL.
    
    Use this tool when:
    - User provides a tweet URL and wants to analyze it
    - User asks to generate responses for a specific tweet link
    - User wants to see what a tweet says
    
    Returns the tweet's text content, author, engagement metrics, and URL.
    """
    from scraping import TweetScraper
    
    global _browser_manager
    
    if not _browser_manager or not _browser_manager.is_driver_active():
        return {"error": "Browser session not active. Please ask user to start a session first."}
    
    try:
        scraper = TweetScraper(_browser_manager)
        tweets = scraper.scrape_tweets_from_url(tweet_url, "single_tweet", max_tweets=1)
        
        if not tweets:
            return {"error": f"Could not fetch tweet from URL: {tweet_url}"}
        
        tweet = tweets[0]
        
        # Convert to dict
        if hasattr(tweet, 'model_dump'):
            tweet_dict = tweet.model_dump(mode='json')
        else:
            tweet_dict = tweet.dict() if hasattr(tweet, 'dict') else tweet
        
        return {
            "success": True,
            "tweet_id": tweet_dict.get("tweet_id"),
            "text_content": tweet_dict.get("text_content"),
            "author_name": tweet_dict.get("user_name"),
            "author_handle": tweet_dict.get("user_handle"),
            "like_count": tweet_dict.get("like_count", 0),
            "retweet_count": tweet_dict.get("retweet_count", 0),
            "reply_count": tweet_dict.get("reply_count", 0),
            "tweet_url": tweet_dict.get("tweet_url")
        }
    except Exception as e:
        logger.error(f"Error fetching tweet: {e}")
        return {"error": str(e)}


class ScanTimelineInput(BaseModel):
    """Input for scanning home timeline."""
    max_tweets: int = Field(
        default=10,
        description="Number of tweets to scan from the home timeline (1-20)"
    )


@tool("feed_ai_scan_timeline", args_schema=ScanTimelineInput)
async def feed_ai_scan_timeline(max_tweets: int = 10) -> Dict[str, Any]:
    """
    Scan the user's Twitter/X home timeline and return recent tweets.
    
    Use this tool when:
    - User wants to see their timeline
    - User asks "what's trending" or "what's on my feed"
    - User wants engagement opportunities from their timeline
    
    Returns a list of tweets with content and metadata.
    """
    from scraping import TweetScraper
    
    global _browser_manager
    
    if not _browser_manager or not _browser_manager.is_driver_active():
        return {"error": "Browser session not active"}
    
    try:
        scraper = TweetScraper(_browser_manager)
        tweets = scraper.scrape_home_timeline(max_tweets=min(max_tweets, 20))
        
        result_tweets = []
        for tweet in tweets[:max_tweets]:
            if hasattr(tweet, 'model_dump'):
                t = tweet.model_dump(mode='json')
            else:
                t = tweet.dict() if hasattr(tweet, 'dict') else tweet
            
            result_tweets.append({
                "tweet_id": t.get("tweet_id"),
                "text_content": t.get("text_content", "")[:200] + "..." if len(t.get("text_content", "")) > 200 else t.get("text_content", ""),
                "author": t.get("user_handle"),
                "likes": t.get("like_count", 0)
            })
        
        return {
            "success": True,
            "count": len(result_tweets),
            "tweets": result_tweets
        }
    except Exception as e:
        return {"error": str(e)}


class GenerateSuggestionsInput(BaseModel):
    """Input for generating tweet suggestions."""
    tweet_text: str = Field(description="The text content of the tweet to respond to")
    tweet_author: str = Field(description="The author's handle (e.g., @username)")
    custom_instructions: str = Field(
        default="",
        description="Optional instructions for the AI (e.g., 'make it humorous', 'be professional')"
    )


@tool("feed_ai_generate_suggestions", args_schema=GenerateSuggestionsInput)
async def feed_ai_generate_suggestions(
    tweet_text: str,
    tweet_author: str,
    custom_instructions: str = ""
) -> Dict[str, Any]:
    """
    Generate AI-powered engagement suggestions for a tweet.
    
    Use this tool when:
    - User has a tweet (from fetch or timeline) and wants response ideas
    - User asks "how should I respond to this"
    - User wants quote tweet, reply, or independent tweet ideas
    
    Returns suggestions for: quote tweet, reply, and independent tweet.
    """
    global _groq_service
    
    if not _groq_service:
        return {"error": "Groq service not initialized"}
    
    try:
        result = await _groq_service.generate_tweet_suggestion(
            tweet_text=tweet_text,
            tweet_author=tweet_author,
            suggestion_type="all",
            user_prompt=custom_instructions if custom_instructions else None
        )
        
        return {
            "success": True,
            "suggestions": {
                "quote_tweet": result.get("quote_tweet", ""),
                "reply": result.get("reply", ""),
                "independent_tweet": result.get("independent_tweet", ""),
                "context_summary": result.get("context_summary", "")
            }
        }
    except Exception as e:
        return {"error": str(e)}


class PostTweetInput(BaseModel):
    """Input for posting a tweet."""
    text: str = Field(description="The tweet text to post (max 280 characters)")
    action_type: str = Field(
        default="post",
        description="Type of action: 'post' (new tweet), 'quote' (quote tweet), or 'reply'"
    )
    original_tweet_url: str = Field(
        default="",
        description="Required for quote/reply: URL of the tweet to quote or reply to"
    )


@tool("post_tweet", args_schema=PostTweetInput)
async def post_tweet(
    text: str,
    action_type: str = "post",
    original_tweet_url: str = ""
) -> Dict[str, Any]:
    """
    Post a tweet to Twitter/X.
    
    Use this tool when:
    - User explicitly asks to "post" or "tweet" something
    - User confirms they want to publish content
    - User says "yes post it" or "send it"
    
    IMPORTANT: Always confirm with user before posting. Never post without explicit approval.
    
    action_type options:
    - "post": New independent tweet
    - "quote": Quote tweet (requires original_tweet_url)
    - "reply": Reply to tweet (requires original_tweet_url)
    """
    from publishing import TweetPublisher, TweetContent
    from scraping import TweetScraper
    
    global _browser_manager
    
    if not _browser_manager or not _browser_manager.is_driver_active():
        return {"error": "Browser session not active"}
    
    if len(text) > 280:
        return {"error": f"Tweet exceeds 280 characters (currently {len(text)})"}
    
    if action_type in ["quote", "reply"] and not original_tweet_url:
        return {"error": f"original_tweet_url is required for {action_type}"}
    
    try:
        publisher = TweetPublisher(_browser_manager)
        
        if action_type == "post":
            content = TweetContent(text=text)
            success = await publisher.post_new_tweet(content)
            return {
                "success": success,
                "message": "Tweet posted successfully!" if success else "Failed to post tweet",
                "action": "post"
            }
        
        elif action_type == "quote":
            scraper = TweetScraper(_browser_manager)
            tweets = scraper.scrape_tweets_from_url(original_tweet_url, "single_tweet", max_tweets=1)
            if not tweets:
                return {"error": "Could not fetch original tweet for quoting"}
            success = await publisher.retweet_tweet(tweets[0], quote_text_prompt_or_direct=text)
            return {
                "success": success,
                "message": "Quote tweet posted!" if success else "Failed to post quote",
                "action": "quote"
            }
        
        elif action_type == "reply":
            scraper = TweetScraper(_browser_manager)
            tweets = scraper.scrape_tweets_from_url(original_tweet_url, "single_tweet", max_tweets=1)
            if not tweets:
                return {"error": "Could not fetch original tweet for replying"}
            success = await publisher.reply_to_tweet(tweets[0], text)
            return {
                "success": success,
                "message": "Reply posted!" if success else "Failed to post reply",
                "action": "reply"
            }
        
        else:
            return {"error": f"Invalid action_type: {action_type}"}
            
    except Exception as e:
        return {"error": str(e)}


# --------------------------------------------------------
# CURATOR TOOLS
# --------------------------------------------------------

class AnalyzeImageInput(BaseModel):
    """Input for image analysis."""
    image_base64: str = Field(
        default="",
        description="Base64 encoded image data"
    )
    image_url: str = Field(
        default="",
        description="URL of the image to analyze"
    )


@tool("curator_analyze_image", args_schema=AnalyzeImageInput)
async def curator_analyze_image(
    image_base64: str = "",
    image_url: str = ""
) -> Dict[str, Any]:
    """
    Analyze an image for aesthetic qualities and tweet compatibility.
    
    Use this tool when:
    - User uploads or provides an image
    - User asks to analyze visual content
    - User wants to generate tweets based on an image
    
    Returns aesthetic analysis, taste score, and recommended tweet styles.
    """
    from src.features.curator import get_curator_service
    import base64
    
    global _groq_service
    
    if not image_base64 and not image_url:
        return {"error": "Either image_base64 or image_url is required"}
    
    try:
        curator = get_curator_service(_groq_service, "default")
        
        if image_base64:
            image_bytes = base64.b64decode(image_base64)
            result = await curator.process_image(image_bytes=image_bytes)
        else:
            # URL-based analysis (if implemented)
            return {"error": "URL-based image analysis not yet implemented. Please provide base64."}
        
        return {
            "success": True,
            "image_id": result.get("image_id"),
            "taste_score": result.get("taste_score", {}).get("score", 0),
            "approved": result.get("taste_score", {}).get("approved", False),
            "mood": result.get("analysis", {}).get("mood", ""),
            "recommended_families": result.get("recommendations", {}).get("families", []),
            "recommended_archetypes": result.get("recommendations", {}).get("archetypes", [])
        }
    except Exception as e:
        return {"error": str(e)}


class GenerateCuratedTweetInput(BaseModel):
    """Input for generating a curated tweet for an image."""
    image_id: str = Field(description="ID of the previously analyzed image")
    family_id: str = Field(default="", description="Optional: specific tweet family to use")
    archetype_id: str = Field(default="", description="Optional: specific archetype to use")
    custom_prompt: str = Field(default="", description="Optional: custom guidance for generation")


@tool("curator_generate_tweet", args_schema=GenerateCuratedTweetInput)
async def curator_generate_tweet(
    image_id: str,
    family_id: str = "",
    archetype_id: str = "",
    custom_prompt: str = ""
) -> Dict[str, Any]:
    """
    Generate an aesthetic tweet for a previously analyzed image.
    
    Use this tool when:
    - User has analyzed an image and wants tweet content for it
    - User asks to "generate a tweet for this image"
    - User wants aesthetic/curated tweet content
    
    Requires a previously analyzed image_id from curator_analyze_image.
    """
    from src.features.curator import get_curator_service
    
    global _groq_service
    
    try:
        curator = get_curator_service(_groq_service, "default")
        
        result = await curator.generate_tweet_for_image(
            image_id=image_id,
            family_id=family_id if family_id else None,
            archetype_id=archetype_id if archetype_id else None,
            custom_prompt=custom_prompt if custom_prompt else None
        )
        
        return {
            "success": True,
            "tweet_text": result.get("tweet_text", ""),
            "family_used": result.get("family_id", ""),
            "archetype_used": result.get("archetype_id", "")
        }
    except Exception as e:
        return {"error": str(e)}


# ============================================================
# AGENT SYSTEM PROMPT
# ============================================================

AGENT_SYSTEM_PROMPT = """You are an intelligent Twitter/X automation assistant with the ability to take real actions.

## Your Capabilities

You have access to tools that allow you to:
1. **Fetch and analyze tweets** from URLs
2. **Scan the user's timeline** for engagement opportunities
3. **Generate AI-powered suggestions** for quotes, replies, and new tweets
4. **Analyze images** for aesthetic tweet generation
5. **Actually post tweets** (with user confirmation)

## Your Behavior

### When to use tools:
- If user provides a Twitter/X URL → use `feed_ai_fetch_url` to get the tweet
- If user asks about their timeline → use `feed_ai_scan_timeline`
- If user wants response ideas for a tweet → use `feed_ai_generate_suggestions`
- If user uploads/shares an image → use `curator_analyze_image`
- If user explicitly approves posting → use `post_tweet`

### Important rules:
1. **NEVER post without explicit user confirmation.** Always show the content first and ask "Would you like me to post this?"
2. If a tool fails due to browser session, politely ask the user to start a session from the Connect page.
3. When generating suggestions, present them clearly with options (1, 2, 3).
4. Be concise but helpful. Don't over-explain.
5. If you can accomplish something with tools, DO IT. Don't just describe how to do it.

### Response style:
- Use **bold** for important info
- Use bullet points for lists
- Keep tweets under 280 chars
- Add relevant emojis where appropriate ✨

## Context

{profile_context}
"""


# ============================================================
# AGENT FACTORY
# ============================================================

def create_twitter_agent(
    groq_service,
    browser_manager,
    profile_context: str = ""
) -> AgentExecutor:
    """
    Create a LangChain agent for Twitter automation.
    
    Args:
        groq_service: Instance of GroqService
        browser_manager: Instance of BrowserManager (for scraping/posting)
        profile_context: Optional profile insights to include
        
    Returns:
        AgentExecutor ready to handle user messages
    """
    # Set global service references for tools
    set_services(groq_service, browser_manager)
    
    # Initialize LLM
    llm = ChatGroq(
        model=DEFAULT_AGENT_MODEL,
        api_key=GROQ_API_KEY,
        temperature=0.7,
        max_tokens=4096
    )
    
    # Collect all tools
    tools = [
        feed_ai_fetch_url,
        feed_ai_scan_timeline,
        feed_ai_generate_suggestions,
        post_tweet,
        curator_analyze_image,
        curator_generate_tweet,
    ]
    
    # Create prompt template
    prompt = ChatPromptTemplate.from_messages([
        ("system", AGENT_SYSTEM_PROMPT.format(profile_context=profile_context or "No profile context available.")),
        MessagesPlaceholder(variable_name="chat_history"),
        ("human", "{input}"),
        MessagesPlaceholder(variable_name="agent_scratchpad"),
    ])
    
    # Create the agent
    agent = create_tool_calling_agent(llm, tools, prompt)
    
    # Create executor with configuration
    agent_executor = AgentExecutor(
        agent=agent,
        tools=tools,
        verbose=True,  # Set to False in production
        max_iterations=10,  # Prevent runaway loops
        return_intermediate_steps=True,  # Return tool call history
        handle_parsing_errors=True,
    )
    
    return agent_executor


# ============================================================
# HIGH-LEVEL API
# ============================================================

class AgenticChatService:
    """
    High-level service for agentic chat interactions.
    
    Usage:
        service = AgenticChatService(groq_service, browser_manager)
        response = await service.chat("Analyze this tweet: https://...")
    """
    
    def __init__(self, groq_service, browser_manager):
        self.groq_service = groq_service
        self.browser_manager = browser_manager
        self.agent_executor = None
        self.conversation_history: List[Dict[str, str]] = []
    
    def _ensure_agent(self, profile_context: str = ""):
        """Create agent if not exists."""
        if not self.agent_executor:
            self.agent_executor = create_twitter_agent(
                self.groq_service,
                self.browser_manager,
                profile_context
            )
    
    async def chat(
        self,
        user_message: str,
        profile_context: str = "",
        reset_history: bool = False
    ) -> Dict[str, Any]:
        """
        Send a message to the agentic chatbot.
        
        Args:
            user_message: The user's message
            profile_context: Optional profile insights
            reset_history: Whether to clear conversation history
            
        Returns:
            Dict with:
                - response: Final text response
                - tool_calls: List of tools that were called
                - success: Whether the interaction succeeded
        """
        if reset_history:
            self.conversation_history = []
        
        self._ensure_agent(profile_context)
        
        try:
            # Convert history to LangChain format
            from langchain_core.messages import HumanMessage, AIMessage
            
            lc_history = []
            for msg in self.conversation_history:
                if msg["role"] == "user":
                    lc_history.append(HumanMessage(content=msg["content"]))
                else:
                    lc_history.append(AIMessage(content=msg["content"]))
            
            # Run the agent
            result = await self.agent_executor.ainvoke({
                "input": user_message,
                "chat_history": lc_history
            })
            
            # Extract response
            response_text = result.get("output", "I apologize, I couldn't process that request.")
            
            # Extract tool calls from intermediate steps
            tool_calls = []
            for step in result.get("intermediate_steps", []):
                action, observation = step
                tool_calls.append({
                    "tool": action.tool,
                    "input": action.tool_input,
                    "output": str(observation)[:500]  # Truncate for frontend
                })
            
            # Update history
            self.conversation_history.append({"role": "user", "content": user_message})
            self.conversation_history.append({"role": "assistant", "content": response_text})
            
            # Keep only last 20 messages
            if len(self.conversation_history) > 20:
                self.conversation_history = self.conversation_history[-20:]
            
            return {
                "success": True,
                "response": response_text,
                "tool_calls": tool_calls,
                "tools_used": len(tool_calls)
            }
            
        except Exception as e:
            logger.error(f"Agentic chat error: {e}")
            return {
                "success": False,
                "response": f"I encountered an error: {str(e)}",
                "tool_calls": [],
                "tools_used": 0
            }
    
    def clear_history(self):
        """Clear conversation history."""
        self.conversation_history = []


# ============================================================
# SINGLETON INSTANCE (optional)
# ============================================================

_agentic_service: Optional[AgenticChatService] = None


def get_agentic_service(groq_service, browser_manager) -> AgenticChatService:
    """Get or create the agentic service singleton."""
    global _agentic_service
    
    if _agentic_service is None:
        _agentic_service = AgenticChatService(groq_service, browser_manager)
    else:
        # Update references in case they changed
        _agentic_service.groq_service = groq_service
        _agentic_service.browser_manager = browser_manager
        _agentic_service.agent_executor = None  # Force recreation
    
    return _agentic_service
```

### 6.3 Add API Endpoint

```python
# Add to backend/api.py

from agentic_service import get_agentic_service, AgenticChatService

# Add this endpoint alongside your existing /chat/general


class AgenticChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    image_data: Optional[str] = None  # Base64 image if provided
    use_profile_context: Optional[bool] = True
    reset_history: Optional[bool] = False


@app.post("/chat/agentic")
async def agentic_chat(request: AgenticChatRequest):
    """
    Agentic chat endpoint - the AI can take real actions.
    
    Unlike /chat/general, this endpoint allows the AI to:
    - Fetch and analyze tweets from URLs
    - Scan the timeline
    - Generate suggestions with tool calls
    - Post tweets (with confirmation)
    """
    accounts = config_loader.get_accounts_config()
    account_id = accounts[0].get("account_id", "default") if accounts else "default"
    
    # Get profile context if enabled
    profile_context = ""
    if request.use_profile_context:
        profile_context = get_profile_context_summary(account_id)
    
    # Get the agentic service
    agentic_service = get_agentic_service(groq_service, global_browser_manager)
    
    try:
        result = await agentic_service.chat(
            user_message=request.message,
            profile_context=profile_context,
            reset_history=request.reset_history or False
        )
        
        return {
            "response": result["response"],
            "tool_calls": result.get("tool_calls", []),
            "tools_used": result.get("tools_used", 0),
            "success": result.get("success", True)
        }
        
    except Exception as e:
        logger.error(f"Agentic chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat/agentic/clear")
async def clear_agentic_history():
    """Clear the agentic chat history."""
    try:
        agentic_service = get_agentic_service(groq_service, global_browser_manager)
        agentic_service.clear_history()
        return {"success": True, "message": "Agentic chat history cleared"}
    except Exception as e:
        return {"success": False, "error": str(e)}
```

---

## 7. Frontend Integration

### 7.1 Update GlobalChatSidebar

```tsx
// In GlobalChatSidebar.tsx, modify handleSendMessage:

const handleSendMessage = async (message: string, imageData?: string) => {
    const userMsg: Message = {
        id: Date.now(),
        role: 'user',
        content: message
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
        // Use agentic endpoint instead of general
        const res = await axios.post('http://localhost:8000/chat/agentic', {
            message,
            session_id: sessionId,
            image_data: imageData,
            use_profile_context: useProfileContext
        });

        // Handle response with potential tool calls
        const assistantMsg: Message = {
            id: Date.now() + 1,
            role: 'assistant',
            content: res.data.response,
            model_used: 'Agentic',
            tool_calls: res.data.tool_calls  // New field
        };
        setMessages(prev => [...prev, assistantMsg]);

        // Optionally show tool call indicator
        if (res.data.tools_used > 0) {
            console.log(`Agent used ${res.data.tools_used} tools:`, res.data.tool_calls);
        }
    } catch (err: any) {
        // ... error handling
    } finally {
        setIsLoading(false);
    }
};
```

### 7.2 Show Tool Usage Indicator (Optional Enhancement)

```tsx
// Add a component to show when agent used tools

{msg.tool_calls && msg.tool_calls.length > 0 && (
    <div className="text-xs text-gray-400 mt-2 flex items-center gap-1">
        <Sparkles size={12} className="text-violet-400" />
        <span>Used {msg.tool_calls.length} tool(s): {msg.tool_calls.map(t => t.tool).join(', ')}</span>
    </div>
)}
```

---

## 8. Example Flows

### Flow 1: URL Analysis

**User:** "What's this tweet about? https://x.com/naval/status/123"

**Agent Internal Process:**
```
Thought: User wants to know about a tweet. I should fetch it first.
Action: feed_ai_fetch_url
Action Input: {"tweet_url": "https://x.com/naval/status/123"}
Observation: {"text_content": "The goal is not to be busy, it's to be productive", "author": "@naval", "likes": 45000}

Thought: I have the tweet content. I can now answer the user.
Final Answer: 📌 **Tweet by @naval:**
"The goal is not to be busy, it's to be productive"

This tweet has **45K likes** and is about the distinction between busyness and productivity. Naval is highlighting that many people mistake being busy for being effective.

Would you like me to generate some response ideas for this tweet? 💡
```

### Flow 2: Full Generate + Post Flow

**User:** "Generate a reply for that tweet and post it"

**Agent Internal Process:**
```
Thought: User wants me to generate a reply and post it. I should first generate suggestions.
Action: feed_ai_generate_suggestions
Action Input: {"tweet_text": "The goal is not to be busy, it's to be productive", "tweet_author": "@naval"}
Observation: {"reply": "This is why I block my calendar for deep work. Busy is a feeling, productive is a result.", ...}

Thought: I have a suggestion. Before posting, I need to confirm with the user.
Final Answer: Here's a reply suggestion:

💬 "This is why I block my calendar for deep work. Busy is a feeling, productive is a result."

**Would you like me to post this reply?** (Say "Yes, post it" to confirm)
```

**User:** "Yes post it"

```
Thought: User confirmed. I'll post the reply.
Action: post_tweet
Action Input: {"text": "This is why I block my calendar for deep work. Busy is a feeling, productive is a result.", "action_type": "reply", "original_tweet_url": "https://x.com/naval/status/123"}
Observation: {"success": true, "message": "Reply posted!"}

Final Answer: ✅ **Posted!** Your reply is now live on @naval's tweet.
```

---

## Summary

The agentic architecture transforms your chatbot from a "text generator" into an "action taker." Key components:

1. **Tools**: Python functions wrapped with LangChain decorators that the agent can call
2. **Agent**: LLM-powered decision maker that chooses tools based on user intent
3. **AgentExecutor**: Orchestrator that runs the think→act→observe loop
4. **Memory**: Conversation history for context

This gives you a Cursor/Antigravity-like experience where the AI understands intent and takes real actions on behalf of the user, while keeping humans in the loop for destructive actions like posting.
