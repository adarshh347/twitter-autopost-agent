"""
Groq API Service for chatbot functionality.
Supports text and vision models with model switching.
"""

import os
import base64
import httpx
from typing import List, Dict, Any, Optional
import logging
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

logger = logging.getLogger(__name__)

# Groq API configuration
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

if not GROQ_API_KEY:
    logger.warning("GROQ_API_KEY not found in environment. Please set it in .env file.")

# Available models (Updated based on Groq docs - Jan 2026)
# Production Models
AVAILABLE_MODELS = {
    "text": [
        {"id": "openai/gpt-oss-120b", "name": "GPT OSS 120B", "description": "High-quality reasoning model (Production)"},
        {"id": "openai/gpt-oss-20b", "name": "GPT OSS 20B", "description": "Fast and efficient (Production)"},
        {"id": "llama-3.3-70b-versatile", "name": "Llama 3.3 70B", "description": "Versatile large model (Production)"},
        {"id": "llama-3.1-8b-instant", "name": "Llama 3.1 8B", "description": "Fast responses (Production)"},
        {"id": "qwen/qwen3-32b", "name": "Qwen 3 32B", "description": "Advanced reasoning (Preview)"},
        {"id": "moonshotai/kimi-k2-instruct-0905", "name": "Kimi K2", "description": "Multilingual model (Preview)"},
    ],
    "vision": [
        {"id": "meta-llama/llama-4-scout-17b-16e-instruct", "name": "Llama 4 Scout", "description": "Vision-language model (Preview)"},
        {"id": "meta-llama/llama-4-maverick-17b-128e-instruct", "name": "Llama 4 Maverick", "description": "Advanced vision model (Preview)"},
    ]
}

# Default models
DEFAULT_TEXT_MODEL = "openai/gpt-oss-120b"
DEFAULT_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"


# System prompts
PROFILE_ANALYZER_SYSTEM_PROMPT = """You are an expert Twitter/X profile analyst and growth strategist. Your role is to:

1. Analyze the user's current Twitter presence based on their description and any data they share
2. Understand their goals, niche, and target audience through conversation
3. Provide actionable insights for profile optimization
4. Help define their content strategy, posting schedule, and engagement approach
5. Extract and remember key insights about their aspirations

When the user shares information, acknowledge it and provide thoughtful analysis. Ask clarifying questions to better understand their goals. Be encouraging but realistic.

Key areas to explore:
- Current profile status (handle, bio, follower count)
- Niche/industry focus
- Content pillars (main topics they want to cover)
- Target audience demographics and interests
- Tone of voice (professional, casual, humorous, etc.)
- Posting frequency goals
- Growth objectives (follower targets, engagement rates)
- Monetization goals if any

After gathering insights, summarize them clearly so they can be saved for future reference."""

GENERAL_CHAT_SYSTEM_PROMPT = """You are an AI assistant specialized in Twitter/X automation and social media strategy. You help users:

1. Craft engaging tweets and threads
2. Respond to questions about Twitter strategy
3. Suggest content ideas based on trends
4. Provide tips for growing their presence
5. Help with automation setup and optimization

Be helpful, concise, and actionable in your responses. When suggesting tweets, keep them under 280 characters unless asked for threads."""


class GroqService:
    def __init__(self, api_key: str = None):
        self.api_key = api_key or GROQ_API_KEY
        self.client = httpx.Client(timeout=60.0)
    
    def get_available_models(self) -> Dict[str, List[Dict]]:
        """Return available models for text and vision."""
        return AVAILABLE_MODELS
    
    async def chat_completion(
        self,
        messages: List[Dict[str, Any]],
        model: str = None,
        temperature: float = 0.7,
        max_tokens: int = 8192,
        stream: bool = False
    ) -> str:
        """
        Send a chat completion request to Groq API.
        
        Args:
            messages: List of message dicts with 'role' and 'content'
            model: Model ID to use (defaults to DEFAULT_TEXT_MODEL)
            temperature: Sampling temperature (0-2)
            max_tokens: Maximum tokens in response
            stream: Whether to stream the response (not implemented yet)
        
        Returns:
            The assistant's response text
        """
        if model is None:
            model = DEFAULT_TEXT_MODEL
            
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    GROQ_API_URL,
                    headers=headers,
                    json=payload
                )
                response.raise_for_status()
                
                data = response.json()
                return data["choices"][0]["message"]["content"]
                
        except httpx.HTTPStatusError as e:
            logger.error(f"Groq API error: {e.response.status_code} - {e.response.text}")
            raise Exception(f"Groq API error: {e.response.status_code}")
        except Exception as e:
            logger.error(f"Groq request failed: {e}")
            raise
    
    async def chat_with_image(
        self,
        messages: List[Dict[str, Any]],
        image_data: str,
        model: str = None,
        temperature: float = 0.7,
        max_tokens: int = 8192
    ) -> str:
        """
        Send a chat completion with an image to Groq API.
        
        Args:
            messages: List of message dicts (the last user message will have image added)
            image_data: Base64 encoded image data
            model: Vision model ID to use (defaults to DEFAULT_VISION_MODEL)
            temperature: Sampling temperature
            max_tokens: Maximum tokens in response
        
        Returns:
            The assistant's response text
        """
        if model is None:
            model = DEFAULT_VISION_MODEL
            
        # Format the last message to include the image
        formatted_messages = messages.copy()
        
        if formatted_messages and formatted_messages[-1]["role"] == "user":
            text_content = formatted_messages[-1]["content"]
            formatted_messages[-1]["content"] = [
                {"type": "text", "text": text_content},
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/jpeg;base64,{image_data}"
                    }
                }
            ]
        
        return await self.chat_completion(
            messages=formatted_messages,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens
        )
    
    async def profile_chat(
        self,
        user_message: str,
        history: List[Dict[str, str]],
        model: str = None,
        image_data: Optional[str] = None
    ) -> str:
        """
        Chat specifically for profile analysis.
        
        Args:
            user_message: The user's message
            history: Previous conversation history
            model: Model to use (defaults to DEFAULT_TEXT_MODEL)
            image_data: Optional base64 image data
        
        Returns:
            Assistant's response
        """
        if model is None:
            model = DEFAULT_TEXT_MODEL
            
        messages = [{"role": "system", "content": PROFILE_ANALYZER_SYSTEM_PROMPT}]
        
        # Add history
        for msg in history:
            messages.append({"role": msg["role"], "content": msg["content"]})
        
        # Add current message
        messages.append({"role": "user", "content": user_message})
        
        if image_data:
            return await self.chat_with_image(messages, image_data, model, max_tokens=8192)
        else:
            return await self.chat_completion(messages, model, max_tokens=8192)
    
    async def general_chat(
        self,
        user_message: str,
        history: List[Dict[str, str]],
        profile_context: Optional[str] = None,
        model: str = None,
        image_data: Optional[str] = None
    ) -> str:
        """
        General purpose chat with optional profile context.
        
        Args:
            user_message: The user's message
            history: Previous conversation history
            profile_context: Optional profile analysis context to include
            model: Model to use (defaults to DEFAULT_TEXT_MODEL)
            image_data: Optional base64 image data
        
        Returns:
            Assistant's response
        """
        if model is None:
            model = DEFAULT_TEXT_MODEL
            
        system_prompt = GENERAL_CHAT_SYSTEM_PROMPT
        
        if profile_context:
            system_prompt += f"\n\n{profile_context}"
        
        messages = [{"role": "system", "content": system_prompt}]
        
        # Add history
        for msg in history:
            messages.append({"role": msg["role"], "content": msg["content"]})
        
        # Add current message
        messages.append({"role": "user", "content": user_message})
        
        if image_data:
            return await self.chat_with_image(messages, image_data, model, max_tokens=8192)
        else:
            return await self.chat_completion(messages, model, max_tokens=8192)
    
    async def extract_profile_insights(
        self,
        conversation_history: List[Dict[str, str]],
        model: str = None
    ) -> Dict[str, str]:
        """
        Extract structured insights from a profile analysis conversation.
        
        Returns a dict with keys like: goal, niche, tone, target_audience, etc.
        """
        if model is None:
            model = DEFAULT_TEXT_MODEL
            
        extraction_prompt = """Based on the conversation below, extract key profile insights in JSON format.
Include only fields that were clearly discussed. Use these exact keys if applicable:
- goal: Their main Twitter growth goals
- niche: Their niche or industry focus
- tone: Their preferred tone of voice
- target_audience: Who they want to reach
- content_pillars: Main topics they want to cover (comma-separated)
- posting_frequency: How often they plan to post
- strengths: Their current strengths
- improvement_areas: Areas they want to improve
- brand_voice: Description of their brand voice
- key_topics: Specific topics they want to focus on

Only include fields that were explicitly discussed. Return valid JSON only, no markdown.

Conversation:
"""
        
        # Build conversation text
        conv_text = ""
        for msg in conversation_history:
            role = "User" if msg["role"] == "user" else "Assistant"
            conv_text += f"{role}: {msg['content']}\n\n"
        
        messages = [
            {"role": "user", "content": extraction_prompt + conv_text}
        ]
        
        try:
            response = await self.chat_completion(messages, model, temperature=0.3)
            
            # Parse JSON response
            import json
            # Clean up response if needed
            response = response.strip()
            if response.startswith("```"):
                response = response.split("```")[1]
                if response.startswith("json"):
                    response = response[4:]
            
            return json.loads(response)
        except Exception as e:
            logger.error(f"Failed to extract insights: {e}")
            return {}


# Singleton instance
groq_service = GroqService()
