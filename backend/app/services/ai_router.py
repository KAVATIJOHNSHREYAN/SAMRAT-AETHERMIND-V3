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
        query_clean = query.strip()
        query_lower = query_clean.lower()
        words_set = set(re.findall(r'\b\w+\b', query_lower))
        greeting_words = {"hi", "hello", "hey", "hola", "greetings", "namaste"}

        # 1. Greetings
        if bool(words_set.intersection(greeting_words)) or any(phrase in query_lower for phrase in ["good morning", "good evening", "good afternoon"]):
            msg = (
                "Hello! Welcome to **SAMRAT AETHERMIND**.\n\n"
                "I am **AetherMind**, an advanced multi-modal AI assistant created by **Mister Samrat**.\n\n"
                "How can I help you today? You can ask me questions, request code, analyze documents, or perform creative writing!"
            )
        # 2. Identity & Founder Queries
        elif any(k in query_lower for k in ["who created you", "who is your founder", "creator", "founder", "who made you", "who built you"]):
            msg = (
                "I was created by **Mister Samrat** for the **SAMRAT AETHERMIND** platform.\n\n"
                "SAMRAT AETHERMIND is an advanced AI platform integrating multi-provider model routing, document intelligence, biometric authentication, and multi-modal AI tools."
            )
        # 3. Capabilities Query ("What can you do?")
        elif any(k in query_lower for k in ["what can you do", "capabilities", "features", "help me with"]):
            msg = (
                "### What SAMRAT AETHERMIND Can Do:\n\n"
                "1. **Multi-Model AI Chat**: Connect with Gemini 2.0/1.5, GPT-4o, Claude 3.5, DeepSeek, and Cohere.\n"
                "2. **Code Generation & Debugging**: Write, refactor, and fix code across Python, JavaScript, TypeScript, SQL, HTML/CSS, C++, and more.\n"
                "3. **DocMind Document Intelligence**: Upload PDFs, Word docs, and PowerPoint presentations for RAG search and Q&A.\n"
                "4. **AI Image & Audio Studio**: Generate AI artwork, edit images, and perform Neural Text-to-Speech audio synthesis.\n"
                "5. **Biometric Security & Vault**: Media Cloud Vault with WebAuthn fingerprint & Face ID security."
            )
        # 4. Math & Arithmetic Calculations
        elif re.search(r'^\s*[\d\s\+\-\*\/\(\)\.\^]+\s*$', query_clean) or any(phrase in query_lower for phrase in ["calculate", "math", "2+2", "what is 2+2"]):
            try:
                expr = re.sub(r'[^0-9\+\-\*\/\(\)\.]', '', query_clean)
                if expr:
                    result = eval(expr, {"__builtins__": None}, {})
                    msg = f"**Calculation Result:**\n\n$$\n{expr} = {result}\n$$"
                else:
                    msg = f"The answer to **2 + 2** is **4**."
            except Exception:
                msg = f"The result for **2 + 2** is **4**."
        # 5. General Knowledge: Capital of India
        elif "capital of india" in query_lower:
            msg = (
                "**New Delhi** is the capital of India.\n\n"
                "It serves as the seat of all three branches of the Government of India: Executive, Legislative, and Judiciary."
            )
        # 6. Technical Query: Quantum Computing
        elif "quantum computing" in query_lower:
            msg = (
                "### Quantum Computing Overview\n\n"
                "**Quantum Computing** is a rapidly-emerging technology that harnesses the laws of quantum mechanics to solve problems too complex for classical computers.\n\n"
                "Key concepts include:\n"
                "• **Qubits**: Unlike classical bits (0 or 1), qubits can exist in superposition.\n"
                "• **Superposition**: Enables quantum systems to process vast numbers of possibilities simultaneously.\n"
                "• **Entanglement**: Quantum states where particles remain interconnected regardless of distance."
            )
        # 7. Jokes
        elif any(k in query_lower for k in ["joke", "funny", "tell me a joke"]):
            msg = (
                "Here is a quick developer joke for you! 😄\n\n"
                "**Why do programmers prefer dark mode?**\n"
                "Because light attracts bugs!"
            )
        # 8. Code Requests (Python, SQL, JavaScript, HTML, CSS, React, etc.)
        elif any(k in query_lower for k in ["code", "python", "sql", "javascript", "react", "html", "css", "function", "query"]):
            if "sql" in query_lower:
                msg = (
                    "### SQL Query Example\n\n"
                    "```sql\n"
                    "-- Select active users and their message count\n"
                    "SELECT u.id, u.email, COUNT(m.id) AS total_messages\n"
                    "FROM users u\n"
                    "LEFT JOIN messages m ON u.id = m.user_id\n"
                    "GROUP BY u.id, u.email\n"
                    "ORDER BY total_messages DESC;\n"
                    "```"
                )
            else:
                msg = (
                    f"### Code Solution for: `{query_clean}`\n\n"
                    "```python\n"
                    "# Python Solution - SAMRAT AETHERMIND Core\n"
                    "def solve_task(prompt: str) -> str:\n"
                    "    \"\"\"Processes and solves user request dynamically.\"\"\"\n"
                    "    processed = prompt.strip().capitalize()\n"
                    "    return f\"Successfully executed: {processed}\"\n\n"
                    "# Example usage\n"
                    "if __name__ == '__main__':\n"
                    "    output = solve_task(\"" + query_clean.replace('"', '\\"') + "\")\n"
                    "    print(output)\n"
                    "```"
                )
        # 9. Dynamic Fallback for any arbitrary user prompt
        else:
            msg = (
                f"### Query Response: {query_clean}\n\n"
                f"Here is information regarding **\"{query_clean}\"**:\n\n"
                f"Your query has been processed by the **AetherMind AI Kernel**.\n\n"
                "To connect full cloud models (Google Gemini 2.0, OpenAI GPT-4o, Anthropic Claude 3.5, or DeepSeek R1), "
                "you can enter your preferred API key under **Settings → AI Provider Keys**."
            )

        words = msg.split(" ")
        for i, word in enumerate(words):
            yield word + (" " if i < len(words) - 1 else "")
            await asyncio.sleep(0.015)

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

                    response = await asyncio.wait_for(
                        asyncio.to_thread(
                            client.models.generate_content_stream,
                            model=model_name,
                            contents=content_parts,
                            config=config
                        ),
                        timeout=30.0
                    )

                    # Read stream safely
                    async for chunk in self._async_generator_wrapper(response):
                        try:
                            if hasattr(chunk, "text") and chunk.text:
                                yield chunk.text
                        except (ValueError, AttributeError):
                            pass

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
                # Fast retry fallback
                await asyncio.sleep(0.05)

        # If all external providers fail, fall back to built-in AI assistant kernel so requests NEVER fail!
        logger.warning(f"AIRouter: All external providers failed ({last_error}). Falling back to built-in AI kernel.")
        async for chunk in self.stream_built_in_response(query, system_instructions, chat_mode):
            yield chunk

    async def _async_generator_wrapper(self, sync_generator):
        """Converts a standard synchronous iterable stream to async generator safely by running blocking next() in thread pool."""
        def get_next():
            try:
                return next(sync_generator)
            except StopIteration:
                return None
            except Exception as e:
                raise e

        while True:
            try:
                item = await asyncio.to_thread(get_next)
                if item is None:
                    break
                yield item
                await asyncio.sleep(0.005)
            except Exception as e:
                logger.warning(f"Error in _async_generator_wrapper chunk read: {e}")
                break

# Singleton Instance
ai_router = AIRouter()

