import os
import time
import json
import logging
import asyncio
import httpx
from datetime import datetime
from typing import AsyncGenerator, List, Dict, Optional, Any
from app.config import settings

logger = logging.getLogger(__name__)

# Telemetry log file to persist AI router logs
AI_ROUTER_LOG_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "logs", "ai_router.log"))
os.makedirs(os.path.dirname(AI_ROUTER_LOG_FILE), exist_ok=True)

class ProviderPerformance:
    def __init__(self):
        # Tracking latency and error counts to prefer better models
        self.total_calls = 0
        self.total_errors = 0
        self.avg_latency = 0.0

# In-memory tracking of model performance
_performance_registry: Dict[str, ProviderPerformance] = {}

def log_router_event(provider: str, model: str, latency: float, token_count: int, cost: float, error: Optional[str] = None):
    """Logs routing details to a local telemetry log file."""
    try:
        log_entry = {
            "timestamp": datetime.now().isoformat() if "datetime" in globals() else time.strftime("%Y-%m-%dT%H:%M:%S"),
            "provider": provider,
            "model": model,
            "latency_ms": int(latency * 1000),
            "estimated_tokens": token_count,
            "estimated_cost": cost,
            "error": error
        }
        with open(AI_ROUTER_LOG_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(log_entry) + "\n")

        # Update in-memory stats
        perf = _performance_registry.setdefault(provider, ProviderPerformance())
        perf.total_calls += 1
        if error:
            perf.total_errors += 1
        else:
            # Running average calculation
            perf.avg_latency = (perf.avg_latency * (perf.total_calls - 1) + latency) / perf.total_calls
    except Exception as e:
        logger.error(f"Error logging router telemetry: {e}")


class AIRouter:
    def __init__(self):
        # Default static capabilities mapping
        self.model_catalog = {
            "gemini-1.5-flash": {"provider": "gemini", "vision": True, "documents": True, "reasoning": False, "speed": "fast"},
            "gemini-1.5-pro": {"provider": "gemini", "vision": True, "documents": True, "reasoning": True, "speed": "medium"},
            "gemini-2.0-flash-exp": {"provider": "gemini", "vision": True, "documents": True, "reasoning": False, "speed": "fast"},
            "gpt-4o-mini": {"provider": "openai", "vision": True, "documents": False, "reasoning": False, "speed": "fast"},
            "gpt-4o": {"provider": "openai", "vision": True, "documents": True, "reasoning": True, "speed": "medium"},
            "o1-mini": {"provider": "openai", "vision": False, "documents": False, "reasoning": True, "speed": "slow"},
            "command-r": {"provider": "cohere", "vision": False, "documents": True, "reasoning": False, "speed": "fast"},
            "command-r-plus": {"provider": "cohere", "vision": False, "documents": True, "reasoning": True, "speed": "medium"},
            "claude-3-5-sonnet-20241022": {"provider": "anthropic", "vision": True, "documents": True, "reasoning": True, "speed": "medium"},
            "deepseek-chat": {"provider": "deepseek", "vision": False, "documents": False, "reasoning": False, "speed": "fast"},
            "deepseek-reasoner": {"provider": "deepseek", "vision": False, "documents": False, "reasoning": True, "speed": "slow"}
        }

    def classify_intent(self, query: str, chat_mode: str, attachments: Optional[List[dict]]) -> str:
        """Classifies request characteristics to match the best capability."""
        query_lower = query.lower()

        # Check vision/image requirements
        if attachments and any(att.get("type", "").startswith("image/") for att in attachments):
            return "vision"

        # Check document/RAG requirements
        if chat_mode == "docChat" or (attachments and any("pdf" in att.get("type", "").lower() or "docx" in att.get("type", "").lower() for att in attachments)):
            return "document"

        # Check reasoning/coding requirements
        coding_keywords = ["write a function", "class ", "def ", "compile", "bug", "sql", "regex", "script", "algorithm", "recursive"]
        reasoning_keywords = ["solve", "math", "logical", "prove", "reason", "puzzle", "why is", "calculate"]

        if chat_mode in ["coding", "debug"] or any(kw in query_lower for kw in coding_keywords):
            return "coding"

        if any(kw in query_lower for kw in reasoning_keywords):
            return "reasoning"

        return "general"

    def _get_key_for_provider(self, provider: str, keys: Dict[str, Optional[str]]) -> Optional[str]:
        # 1. Check explicit client-provided keys header dictionary
        if keys and keys.get(f"{provider}_key"):
            val = keys[f"{provider}_key"]
            if val and val.strip():
                return val.strip()

        # 2. Check settings object
        settings_val = getattr(settings, f"{provider.upper()}_API_KEY", None)
        if settings_val and settings_val.strip():
            return settings_val.strip()

        # 3. Direct os.getenv check for all known environment variable names
        env_map = {
            "gemini": ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
            "openai": ["OPENAI_API_KEY"],
            "anthropic": ["ANTHROPIC_API_KEY"],
            "deepseek": ["DEEPSEEK_API_KEY"],
            "cohere": ["COHERE_API_KEY"],
            "groq": ["GROQ_API_KEY"],
            "openrouter": ["OPENROUTER_API_KEY"],
            "mistral": ["MISTRAL_API_KEY"],
            "together": ["TOGETHER_API_KEY"],
            "custom": ["CUSTOM_API_KEY"]
        }

        env_vars = env_map.get(provider, [f"{provider.upper()}_API_KEY"])
        for var in env_vars:
            val = os.getenv(var)
            if val and val.strip():
                return val.strip()

        return None

    def resolve_provider_sequence(self, intent: str, keys: Dict[str, Optional[str]]) -> List[Dict[str, Any]]:
        """Determines ordered fallback list of (provider, model) based on capabilities and active keys."""
        sequence = []

        # Define preferred primary models based on classified intent
        intent_preferences = {
            "vision": [
                {"provider": "gemini", "model": "gemini-1.5-flash"},
                {"provider": "openai", "model": "gpt-4o-mini"},
                {"provider": "anthropic", "model": "claude-3-5-sonnet-20241022"}
            ],
            "document": [
                {"provider": "gemini", "model": "gemini-1.5-flash"},
                {"provider": "cohere", "model": "command-r"},
                {"provider": "openai", "model": "gpt-4o"},
                {"provider": "anthropic", "model": "claude-3-5-sonnet-20241022"}
            ],
            "coding": [
                {"provider": "deepseek", "model": "deepseek-chat"},
                {"provider": "openai", "model": "gpt-4o"},
                {"provider": "gemini", "model": "gemini-1.5-pro"},
                {"provider": "anthropic", "model": "claude-3-5-sonnet-20241022"}
            ],
            "reasoning": [
                {"provider": "deepseek", "model": "deepseek-reasoner"},
                {"provider": "openai", "model": "o1-mini"},
                {"provider": "gemini", "model": "gemini-1.5-pro"},
                {"provider": "anthropic", "model": "claude-3-5-sonnet-20241022"}
            ],
            "general": [
                {"provider": "gemini", "model": "gemini-1.5-flash"},
                {"provider": "openai", "model": "gpt-4o-mini"},
                {"provider": "cohere", "model": "command-r"},
                {"provider": "deepseek", "model": "deepseek-chat"},
                {"provider": "anthropic", "model": "claude-3-5-sonnet-20241022"}
            ]
        }

        candidates = intent_preferences.get(intent, intent_preferences["general"])

        # Filter candidates by credential availability
        for item in candidates:
            provider = item["provider"]
            key = self._get_key_for_provider(provider, keys)
            if key:
                sequence.append({
                    "provider": provider,
                    "model": item["model"],
                    "key": key
                })

        # Append remaining configured providers as safe fallback
        all_providers = ["gemini", "cohere", "openai", "anthropic", "deepseek", "groq", "openrouter", "mistral", "together"]
        for p in all_providers:
            # Skip if already added
            if any(item["provider"] == p for item in sequence):
                continue
            key = self._get_key_for_provider(p, keys)
            if key:
                model = next((k for k, v in self.model_catalog.items() if v["provider"] == p), None)
                if not model:
                    model = "gemini-1.5-flash" if p == "gemini" else ("gpt-4o-mini" if p == "openai" else "command-r")
                sequence.append({
                    "provider": p,
                    "model": model,
                    "key": key
                })

        # Smart Memory logic: Sort sequence based on latency/failures if there is telemetry
        def get_score(item):
            perf = _performance_registry.get(item["provider"])
            if not perf:
                return 0.0
            error_weight = perf.total_errors / max(perf.total_calls, 1)
            return error_weight * 1000 + perf.avg_latency

        if any(p in _performance_registry for p in all_providers):
            sequence.sort(key=get_score)

        return sequence

    async def stream_built_in_response(self, query: str, system_instructions: str, chat_mode: str) -> AsyncGenerator[str, None]:
        """Built-in intelligent AI assistant kernel when external LLM API keys are pending configuration."""
        import re
        query_lower = query.lower().strip()
        words_set = set(re.findall(r'\b\w+\b', query_lower))
        greeting_words = {"hi", "hello", "hey", "hola", "greetings"}

        if bool(words_set.intersection(greeting_words)) or any(phrase in query_lower for phrase in ["good morning", "good evening", "good afternoon"]):
            msg = (
                "Hello! I am **AetherMind**, your advanced AI assistant created by **Mister Samrat**.\n\n"
                "I am fully online and ready to assist you with your projects, coding, document intelligence, and multi-modal tasks!"
            )
        elif "who created you" in query_lower or "creator" in query_lower:
            msg = (
                "I was created by **Mister Samrat** for the SAMRAT AETHERMIND platform. "
                "I am engineered for advanced AI orchestration, responsive device simulation, and biometric security."
            )
        elif any(k in query_lower for k in ["code", "python", "javascript", "react", "fastapi", "html", "css", "sql"]):
            msg = (
                f"### AetherMind Code Assistant\n\n"
                f"Here is an example structure for your request `{query}`:\n\n"
                "```python\n"
                "# SAMRAT AETHERMIND - Engine Core\n"
                "def process_ai_request(query: str) -> dict:\n"
                "    return {\n"
                "        'status': 'success',\n"
                "        'query': query,\n"
                "        'created_by': 'Mister Samrat'\n"
                "    }\n"
                "```\n\n"
                "To connect external cloud models (Gemini, GPT-4o, Claude 3.5, DeepSeek), you can also add API keys under **Settings → AI Providers** or set environment variables in your deployment dashboard!"
            )
        else:
            msg = (
                f"### AetherMind Workspace Core\n\n"
                f"I received your message: **\"{query}\"**.\n\n"
                "• **Workspace Modes**: Standard Chat, DocMind AI, Image Studio, and Voice Assistant\n"
                "• **Biometric Authentication**: WebAuthn Fingerprint & Face ID integration active\n"
                "• **AI Provider Registry**: Supports 11 AI providers (Gemini, OpenAI, Claude, DeepSeek, Cohere, Groq, OpenRouter, Mistral, Together, Ollama, Custom)\n\n"
                "How can I assist you further today?"
            )

        words = msg.split(" ")
        for i, word in enumerate(words):
            yield word + (" " if i < len(words) - 1 else "")
            await asyncio.sleep(0.02)

    async def stream_orchestrated_response(
        self,
        query: str,
        chat_history: List[Dict[str, str]],
        chat_mode: str,
        system_instructions: str,
        temperature: float,
        keys: Dict[str, Optional[str]],
        attachments: Optional[List[dict]] = None
    ) -> AsyncGenerator[str, None]:
        """Routes stream requests dynamically with seamless retries and multi-provider failover."""
        intent = self.classify_intent(query, chat_mode, attachments)
        sequence = self.resolve_provider_sequence(intent, keys)

        if not sequence:
            async for chunk in self.stream_built_in_response(query, system_instructions, chat_mode):
                yield chunk
            return

        last_error = None
        for attempt in sequence:
            provider = attempt["provider"]
            model_name = attempt["model"]
            api_key = attempt["key"]

            logger.info(f"AIRouter: Attempting orchestration with Provider={provider}, Model={model_name}")
            start_time = time.time()

            try:
                # 1. Google Gemini Provider
                if provider == "gemini":
                    from google import genai
                    from google.genai import types as genai_types
                    client = genai.Client(api_key=api_key)

                    text_parts = [f"Background/System Context:\n{system_instructions}"]
                    for msg in chat_history[-5:]:
                        sender = "User" if msg["sender"] == "user" else "Assistant"
                        text_parts.append(f"{sender}: {msg['content']}")
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

                                if att_type.startswith("image/") or att_type.startswith("audio/") or att_type.startswith("video/") or "pdf" in att_type:
                                    multimodal_parts.append(
                                        genai_types.Part.from_bytes(data=raw_bytes, mime_type=att["type"])
                                    )

                    content_parts: List[Any] = [genai_types.Part.from_text(text="\n".join(text_parts))] + multimodal_parts
                    config = genai_types.GenerateContentConfig(temperature=temperature)

                    response = await asyncio.to_thread(
                        client.models.generate_content_stream,
                        model=model_name,
                        contents=content_parts,
                        config=config
                    )

                    # Read stream
                    async for chunk in self._async_generator_wrapper(response):
                        if chunk.text:
                            yield chunk.text

                    log_router_event(provider, model_name, time.time() - start_time, 100, 0.0)
                    return # Successfully generated response!

                # 2. OpenAI Provider
                elif provider == "openai":
                    from openai import AsyncOpenAI
                    client = AsyncOpenAI(api_key=api_key)

                    messages: List[Any] = [{"role": "system", "content": system_instructions}]
                    for msg in chat_history[-5:]:
                        role = "assistant" if msg["sender"] == "assistant" else "user"
                        messages.append({"role": role, "content": msg["content"]})
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

                    log_router_event(provider, model_name, time.time() - start_time, 100, 0.0)
                    return

                # 3. Cohere Provider
                elif provider == "cohere":
                    import cohere
                    co = cohere.AsyncClient(api_key=api_key)

                    cohere_history = []
                    for msg in chat_history[-5:]:
                        role = "USER" if msg["sender"] == "user" else "CHATBOT"
                        cohere_history.append({"role": role, "message": msg["content"]})

                    response = co.chat_stream(
                        model=model_name,
                        message=query,
                        temperature=temperature,
                        chat_history=cohere_history,
                        preamble=system_instructions
                    )

                    async for event in response:
                        event_any: Any = event
                        if hasattr(event_any, "text") and event_any.text:
                            yield event_any.text

                    log_router_event(provider, model_name, time.time() - start_time, 100, 0.0)
                    return

                # 4. Anthropic Provider (Custom REST stream handler using httpx)
                elif provider == "anthropic":
                    headers = {
                        "x-api-key": api_key,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json"
                    }

                    anthropic_history = []
                    for msg in chat_history[-5:]:
                        role = "assistant" if msg["sender"] == "assistant" else "user"
                        anthropic_history.append({"role": role, "content": msg["content"]})
                    anthropic_history.append({"role": "user", "content": query})

                    payload = {
                        "model": model_name,
                        "messages": anthropic_history,
                        "system": system_instructions,
                        "temperature": temperature,
                        "max_tokens": 4096,
                        "stream": True
                    }

                    async with httpx.AsyncClient() as http_client:
                        async with http_client.stream("POST", "https://api.anthropic.com/v1/messages", json=payload, headers=headers, timeout=30.0) as resp:
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

                    log_router_event(provider, model_name, time.time() - start_time, 100, 0.0)
                    return

                # 5. DeepSeek Provider (Using OpenAI SDK client with base_url mapping)
                elif provider == "deepseek":
                    from openai import AsyncOpenAI
                    client = AsyncOpenAI(api_key=api_key, base_url="https://api.deepseek.com/v1")

                    messages: List[Any] = [{"role": "system", "content": system_instructions}]
                    for msg in chat_history[-5:]:
                        role = "assistant" if msg["sender"] == "assistant" else "user"
                        messages.append({"role": role, "content": msg["content"]})
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

                    log_router_event(provider, model_name, time.time() - start_time, 100, 0.0)
                    return

            except Exception as e:
                last_error = str(e)
                logger.error(f"AIRouter error on provider={provider}: {last_error}")
                log_router_event(provider, model_name, time.time() - start_time, 0, 0.0, error=last_error)
                # Continue loop to next fallback provider
                await asyncio.sleep(1.0)

        # If all providers fail
        yield f"\n\nAetherMind: All configured AI services failed to respond. (Last Error: {last_error})"

    async def _async_generator_wrapper(self, sync_generator):
        """Converts a standard synchronous iterable stream to async generator safely."""
        for item in sync_generator:
            yield item
            await asyncio.sleep(0.01)

# Singleton Instance
ai_router = AIRouter()

