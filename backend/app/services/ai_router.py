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
            key = keys.get(f"{provider}_key") or getattr(settings, f"{provider.upper()}_API_KEY", None)
            if key:
                sequence.append({
                    "provider": provider,
                    "model": item["model"],
                    "key": key
                })

        # Append remaining configured providers as safe fallback
        all_providers = ["gemini", "cohere", "openai", "anthropic", "deepseek"]
        for p in all_providers:
            # Skip if already added
            if any(item["provider"] == p for item in sequence):
                continue
            key = keys.get(f"{p}_key") or getattr(settings, f"{p.upper()}_API_KEY", None)
            if key:
                # Find matching model in static catalog or guess default
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
            # Higher error rates push items down, lower average latency pulls them up
            error_weight = perf.total_errors / max(perf.total_calls, 1)
            return error_weight * 1000 + perf.avg_latency

        if any(p in _performance_registry for p in all_providers):
            sequence.sort(key=get_score)

        return sequence

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
            yield "AetherMind: No AI provider keys are currently configured. Please add an API key in your Settings."
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

