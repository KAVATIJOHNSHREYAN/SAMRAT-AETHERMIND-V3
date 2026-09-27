import os
import time
import json
import logging
import asyncio
import httpx
from abc import ABC, abstractmethod
from typing import AsyncGenerator, List, Dict, Optional, Any
from app.config import settings

logger = logging.getLogger(__name__)

class BaseTextProvider(ABC):
    """Abstract base class for all Text LLM providers."""
    def __init__(self, provider_id: str, name: str):
        self.provider_id = provider_id
        self.name = name

    @abstractmethod
    async def generate_stream(
        self,
        query: str,
        model_name: str,
        api_key: str,
        chat_history: List[Dict[str, str]],
        system_instructions: str,
        temperature: float,
        attachments: Optional[List[dict]] = None
    ) -> AsyncGenerator[str, None]:
        pass

class GeminiProvider(BaseTextProvider):
    def __init__(self):
        super().__init__("gemini", "Google Gemini")

    async def generate_stream(
        self,
        query: str,
        model_name: str,
        api_key: str,
        chat_history: List[Dict[str, str]],
        system_instructions: str,
        temperature: float,
        attachments: Optional[List[dict]] = None
    ) -> AsyncGenerator[str, None]:
        from google import genai
        from google.genai import types as genai_types
        client = genai.Client(api_key=api_key)

        text_parts = [f"Background/System Context:\n{system_instructions}"]
        for msg in chat_history[-6:]:
            sender = "User" if msg.get("sender") == "user" else "Assistant"
            text_parts.append(f"{sender}: {msg.get('content', '')}")
        text_parts.append(f"User Query: {query}")

        multimodal_parts = []
        if attachments:
            import base64
            for att in attachments:
                att_type = att.get("type", "").lower()
                if att.get("data") and att_type:
                    b64_data = att["data"]
                    if "," in b64_data:
                        b64_data = b64_data.split(",")[1]
                    raw_bytes = base64.b64decode(b64_data)
                    multimodal_parts.append(
                        genai_types.Part.from_bytes(data=raw_bytes, mime_type=att["type"])
                    )

        content_parts = [genai_types.Part.from_text(text="\n".join(text_parts))] + multimodal_parts
        config = genai_types.GenerateContentConfig(temperature=temperature)

        response = await asyncio.wait_for(
            asyncio.to_thread(
                client.models.generate_content_stream,
                model=model_name or "gemini-1.5-flash",
                contents=content_parts,
                config=config
            ),
            timeout=30.0
        )

        def get_next(sync_gen):
            try:
                return next(sync_gen)
            except StopIteration:
                return None
            except Exception as e:
                raise e

        while True:
            item = await asyncio.to_thread(get_next, response)
            if item is None:
                break
            if hasattr(item, "text") and item.text:
                yield item.text
            await asyncio.sleep(0.005)

class OpenAIProvider(BaseTextProvider):
    def __init__(self):
        super().__init__("openai", "OpenAI")

    async def generate_stream(
        self,
        query: str,
        model_name: str,
        api_key: str,
        chat_history: List[Dict[str, str]],
        system_instructions: str,
        temperature: float,
        attachments: Optional[List[dict]] = None
    ) -> AsyncGenerator[str, None]:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=api_key)

        messages = [{"role": "system", "content": system_instructions}]
        for msg in chat_history[-6:]:
            role = "assistant" if msg.get("sender") == "assistant" else "user"
            messages.append({"role": role, "content": msg.get("content", "")})
        messages.append({"role": "user", "content": query})

        response = await client.chat.completions.create(
            model=model_name or "gpt-4o-mini",
            messages=messages,
            temperature=temperature,
            stream=True
        )

        async for chunk in response:
            if chunk.choices:
                text = chunk.choices[0].delta.content
                if text:
                    yield text

class AnthropicProvider(BaseTextProvider):
    def __init__(self):
        super().__init__("anthropic", "Anthropic Claude")

    async def generate_stream(
        self,
        query: str,
        model_name: str,
        api_key: str,
        chat_history: List[Dict[str, str]],
        system_instructions: str,
        temperature: float,
        attachments: Optional[List[dict]] = None
    ) -> AsyncGenerator[str, None]:
        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }

        anthropic_history = []
        for msg in chat_history[-6:]:
            role = "assistant" if msg.get("sender") == "assistant" else "user"
            anthropic_history.append({"role": role, "content": msg.get("content", "")})
        anthropic_history.append({"role": "user", "content": query})

        payload = {
            "model": model_name or "claude-3-5-sonnet-20241022",
            "messages": anthropic_history,
            "system": system_instructions,
            "temperature": temperature,
            "max_tokens": 4096,
            "stream": True
        }

        async with httpx.AsyncClient() as client:
            async with client.stream("POST", "https://api.anthropic.com/v1/messages", json=payload, headers=headers, timeout=30.0) as resp:
                if resp.status_code != 200:
                    error_body = await resp.aread()
                    raise Exception(f"Anthropic error HTTP {resp.status_code}: {error_body.decode('utf-8')}")

                async for line in resp.aiter_lines():
                    line = line.strip()
                    if line.startswith("data:"):
                        try:
                            data = json.loads(line[5:].strip())
                            if data.get("type") == "content_block_delta":
                                text = data.get("delta", {}).get("text", "")
                                if text:
                                    yield text
                        except Exception:
                            pass

class DeepSeekProvider(BaseTextProvider):
    def __init__(self):
        super().__init__("deepseek", "DeepSeek AI")

    async def generate_stream(
        self,
        query: str,
        model_name: str,
        api_key: str,
        chat_history: List[Dict[str, str]],
        system_instructions: str,
        temperature: float,
        attachments: Optional[List[dict]] = None
    ) -> AsyncGenerator[str, None]:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=api_key, base_url="https://api.deepseek.com/v1")

        messages = [{"role": "system", "content": system_instructions}]
        for msg in chat_history[-6:]:
            role = "assistant" if msg.get("sender") == "assistant" else "user"
            messages.append({"role": role, "content": msg.get("content", "")})
        messages.append({"role": "user", "content": query})

        response = await client.chat.completions.create(
            model=model_name or "deepseek-chat",
            messages=messages,
            temperature=temperature,
            stream=True
        )

        async for chunk in response:
            if chunk.choices:
                text = chunk.choices[0].delta.content
                if text:
                    yield text

class OpenAICompatibleProvider(BaseTextProvider):
    def __init__(self, provider_id: str, name: str, default_base_url: str):
        super().__init__(provider_id, name)
        self.default_base_url = default_base_url

    async def generate_stream(
        self,
        query: str,
        model_name: str,
        api_key: str,
        chat_history: List[Dict[str, str]],
        system_instructions: str,
        temperature: float,
        attachments: Optional[List[dict]] = None
    ) -> AsyncGenerator[str, None]:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=api_key or "dummy_key", base_url=self.default_base_url)

        messages = [{"role": "system", "content": system_instructions}]
        for msg in chat_history[-6:]:
            role = "assistant" if msg.get("sender") == "assistant" else "user"
            messages.append({"role": role, "content": msg.get("content", "")})
        messages.append({"role": "user", "content": query})

        response = await client.chat.completions.create(
            model=model_name,
            messages=messages,
            temperature=temperature,
            stream=True
        )

        async for chunk in response:
            if chunk.choices:
                text = chunk.choices[0].delta.content
                if text:
                    yield text

class AIProviderManager:
    """Centralized AI Provider Manager supporting retry, provider failover, and telemetry."""
    def __init__(self):
        self.providers: Dict[str, BaseTextProvider] = {
            "gemini": GeminiProvider(),
            "openai": OpenAIProvider(),
            "anthropic": AnthropicProvider(),
            "deepseek": DeepSeekProvider(),
            "groq": OpenAICompatibleProvider("groq", "Groq LPU", "https://api.groq.com/openai/v1"),
            "openrouter": OpenAICompatibleProvider("openrouter", "OpenRouter", "https://openrouter.ai/api/v1"),
            "mistral": OpenAICompatibleProvider("mistral", "Mistral AI", "https://api.mistral.ai/v1"),
            "together": OpenAICompatibleProvider("together", "Together AI", "https://api.together.xyz/v1"),
            "ollama": OpenAICompatibleProvider("ollama", "Local Ollama", os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1"))
        }

    def get_api_key(self, provider_id: str, keys: Dict[str, Optional[str]]) -> Optional[str]:
        # 1. Explicit key parameter
        if keys and keys.get(f"{provider_id}_key"):
            val = keys[f"{provider_id}_key"]
            if val and val.strip():
                return val.strip()

        # 2. Config settings
        settings_val = getattr(settings, f"{provider_id.upper()}_API_KEY", None)
        if settings_val and settings_val.strip():
            return settings_val.strip()

        # 3. Environment variables
        env_vars = {
            "gemini": ["GEMINI_API_KEY", "GOOGLE_API_KEY", "TEXT_PROVIDER_KEY"],
            "openai": ["OPENAI_API_KEY", "TEXT_PROVIDER_KEY"],
            "anthropic": ["ANTHROPIC_API_KEY"],
            "deepseek": ["DEEPSEEK_API_KEY"],
            "groq": ["GROQ_API_KEY"],
            "openrouter": ["OPENROUTER_API_KEY"],
            "mistral": ["MISTRAL_API_KEY"],
            "together": ["TOGETHER_API_KEY"]
        }.get(provider_id, [f"{provider_id.upper()}_API_KEY"])

        for var in env_vars:
            val = os.getenv(var)
            if val and val.strip():
                return val.strip()

        return None

    async def stream_with_fallback(
        self,
        query: str,
        chat_history: List[Dict[str, str]],
        system_instructions: str,
        temperature: float,
        keys: Dict[str, Optional[str]],
        preferred_provider: Optional[str] = None,
        preferred_model: Optional[str] = None,
        attachments: Optional[List[dict]] = None
    ) -> AsyncGenerator[str, None]:
        # Build priority sequence of providers
        order = ["gemini", "openai", "groq", "deepseek", "anthropic", "openrouter", "mistral", "together", "ollama"]
        if preferred_provider and preferred_provider in order:
            order.remove(preferred_provider)
            order.insert(0, preferred_provider)

        last_error = None
        for provider_id in order:
            provider = self.providers.get(provider_id)
            if not provider:
                continue

            api_key = self.get_api_key(provider_id, keys)
            if not api_key and provider_id != "ollama":
                continue

            model_name = preferred_model if (provider_id == preferred_provider and preferred_model) else None
            if not model_name:
                model_name = {
                    "gemini": "gemini-1.5-flash",
                    "openai": "gpt-4o-mini",
                    "groq": "llama-3.3-70b-versatile",
                    "deepseek": "deepseek-chat",
                    "anthropic": "claude-3-5-sonnet-20241022",
                    "openrouter": "auto",
                    "mistral": "mistral-large-latest",
                    "together": "togethercomputer/llama-3-70b-instruct",
                    "ollama": "llama3"
                }.get(provider_id, "gemini-1.5-flash")

            logger.info(f"AIProviderManager: Executing with provider={provider_id}, model={model_name}")

            # Attempt provider execution with retry logic
            for attempt in range(2):
                try:
                    async for chunk in provider.generate_stream(
                        query=query,
                        model_name=model_name,
                        api_key=api_key or "",
                        chat_history=chat_history,
                        system_instructions=system_instructions,
                        temperature=temperature,
                        attachments=attachments
                    ):
                        yield chunk
                    return # Execution successful!
                except Exception as e:
                    last_error = str(e)
                    logger.warning(f"AIProviderManager: provider={provider_id} attempt {attempt + 1} failed: {last_error}")
                    await asyncio.sleep(0.1)

        # Fall back to built-in dynamic assistant kernel if all cloud providers are unreachable
        logger.warning(f"AIProviderManager: All cloud providers failed ({last_error}). Triggering dynamic kernel.")
        from app.services.ai_router import ai_router
        async for chunk in ai_router.stream_built_in_response(query, system_instructions, "general"):
            yield chunk

ai_provider_manager = AIProviderManager()
