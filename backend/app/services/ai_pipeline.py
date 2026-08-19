import os
import asyncio
import time
from app.config import settings
from typing import AsyncGenerator, List, Dict, Optional

from app.db.vector_store import similarity_search

# Global dictionary to track last request execution times
_user_last_request_time = {}

def extract_text_from_file(file_bytes: bytes, mime_type: str) -> str:
    import io
    text = ""
    mime_type_lower = mime_type.lower()
    
    if "pdf" in mime_type_lower:
        try:
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            for page in reader.pages:
                text += (page.extract_text() or "") + "\n"
        except Exception as e:
            print("PDF text extraction error:", e)
    elif "word" in mime_type_lower or "docx" in mime_type_lower or "doc" in mime_type_lower:
        try:
            import docx
            doc = docx.Document(io.BytesIO(file_bytes))
            for para in doc.paragraphs:
                text += para.text + "\n"
        except Exception as e:
            print("DOCX text extraction error:", e)
    elif "presentation" in mime_type_lower or "powerpoint" in mime_type_lower or "pptx" in mime_type_lower or "ppt" in mime_type_lower:
        try:
            from pptx import Presentation
            prs = Presentation(io.BytesIO(file_bytes))
            for slide in prs.slides:
                for shape in slide.shapes:
                    if hasattr(shape, "text"):
                        text += shape.text + "\n"
        except Exception as e:
            print("PPTX text extraction error:", e)
    elif "text" in mime_type_lower or "plain" in mime_type_lower or "csv" in mime_type_lower or "json" in mime_type_lower:
        try:
            text = file_bytes.decode("utf-8", errors="ignore")
        except Exception as e:
            print("Text extraction error:", e)
    return text.strip()


async def generate_response_stream(
    query: str,
    chat_history: List[Dict[str, str]],
    chat_mode: str = "general",
    active_model: str = "gemini-2.5-flash",
    temperature: float = 0.7,
    system_prompt: str = None,
    enable_rag: bool = True,
    rag_k: int = 3,
    openai_key: str = None,
    gemini_key: str = None,
    cohere_key: str = None,
    attachments: Optional[List[dict]] = None,
    user_id: Optional[str] = None
) -> AsyncGenerator[str, None]:

    # Rate Limiting
    REQUEST_DELAY = 4.0
    tracking_key = user_id or "anonymous"
    current_time = time.time()
    last_allowed_time = _user_last_request_time.get(tracking_key, 0.0)

    if current_time < last_allowed_time + REQUEST_DELAY:
        wait_time = (last_allowed_time + REQUEST_DELAY) - current_time
        yield f"Please wait {wait_time:.1f}s before sending another message...\n\n"
        await asyncio.sleep(wait_time)

    _user_last_request_time[tracking_key] = time.time()

    context_str = ""

    # RAG Search
    if enable_rag and chat_mode in ["general", "voice"]:
        api_key = gemini_key or openai_key
        docs = similarity_search(query, k=rag_k, api_key=api_key)

        if docs:
            context_str = "\n".join(
                [f"- {doc.page_content}" for doc in docs]
            )

    # System Instructions
    system_instructions = (
        "You are AetherMind, an advanced AI assistant. "
        "Mister Samrat created you for assistance. "
        "Always mention Mister Samrat if asked who created you. "
        "Provide clean, concise and professional responses."
    )

    if system_prompt:
        system_instructions = system_prompt
    else:
        if chat_mode == "coding":
            system_instructions += " Focus on writing clean code."
        elif chat_mode == "debug":
            system_instructions += " Focus on debugging and fixing issues."
        elif chat_mode == "voice":
            system_instructions += " Keep responses short and conversational."

    # Static Fallback Replies
    fallback_replies = {
        "hello": "Hello! AetherMind is online.",
        "who created you": "Mister Samrat created me for assistance.",
        "what is your name": "I am AetherMind."
    }

    query_lower = query.lower()

    for key, value in fallback_replies.items():
        if key in query_lower:
            for word in value.split():
                yield word + " "
                await asyncio.sleep(0.05)
            return

    # Provider Detection
    is_openai_model = active_model.startswith("gpt-")
    is_cohere_model = active_model.startswith("cohere-") or active_model.startswith("command-")
    is_gemini_model = active_model.startswith("gemini-")

    effective_openai_key = openai_key or settings.OPENAI_API_KEY or None
    effective_gemini_key = gemini_key or settings.GEMINI_API_KEY or None
    effective_cohere_key = cohere_key or settings.COHERE_API_KEY or None

    # Fallback to Gemini if selected provider key is missing but Gemini key is present
    if is_cohere_model and not effective_cohere_key and effective_gemini_key:
        active_model = "gemini-2.5-flash"
        is_cohere_model = False
        is_gemini_model = True
    elif is_openai_model and not effective_openai_key and effective_gemini_key:
        active_model = "gemini-2.5-flash"
        is_openai_model = False
        is_gemini_model = True

    print("Gemini Loaded:", effective_gemini_key is not None)
    print("Cohere Loaded:", effective_cohere_key is not None)

    # OPENAI
    if is_openai_model:
        if not effective_openai_key:
            yield "AetherMind: Please enter your OpenAI API key."
            return

        try:
            from openai import OpenAI

            client = OpenAI(api_key=effective_openai_key)

            messages = [{"role": "system", "content": system_instructions}]

            for msg in chat_history[-5:]:
                role = "assistant" if msg["sender"] == "assistant" else "user"
                messages.append({
                    "role": role,
                    "content": msg["content"]
                })

            messages.append({
                "role": "user",
                "content": query
            })

            response = await asyncio.to_thread(
                client.chat.completions.create,
                model=active_model,
                messages=messages,
                temperature=temperature,
                stream=True
            )

            for chunk in response:
                if chunk.choices:
                    content = chunk.choices[0].delta.content
                    if content:
                        yield content

            return

        except Exception as e:
            yield f"AI Error: {str(e)}"
            return

    # COHERE
    elif is_cohere_model:
        if not effective_cohere_key:
            yield "AetherMind: Please enter your Cohere API key."
            return

        try:
            import cohere
            print("Incoming active_model:", active_model)
            print("Is Cohere:", is_cohere_model)

            stripped_model = active_model.replace("cohere-", "")

            model_map = {
                "command-r": "command-r-08-2024",
                "command-r-plus": "command-r-plus-08-2024",
                "command-light": "command-r7b-12-2024"
            }

            real_cohere_model = model_map.get(
                stripped_model,
                "command-r-plus-08-2024"
            )

            print("Mapped model:", real_cohere_model)

            co = cohere.AsyncClient(
                api_key=effective_cohere_key
            )

            chat_history_cohere = []

            for msg in chat_history[-5:]:
                role = "USER" if msg["sender"] == "user" else "CHATBOT"

                chat_history_cohere.append({
                    "role": role,
                    "message": msg["content"]
                })

            user_content = query

            if context_str:
                user_content = (
                    f"Background Context:\n{context_str}\n\n"
                    f"User Query: {query}"
                )

            response = co.chat_stream(
                model=real_cohere_model,
                message=user_content,
                temperature=temperature,
                chat_history=chat_history_cohere,
                preamble=system_instructions
            )

            async for event in response:
                if hasattr(event, "text") and event.text:
                    yield event.text

            return


        except Exception as e:
            error_str = str(e)

            if "404" in error_str:
                yield "AetherMind: Invalid Cohere model selected."

            elif "429" in error_str:
                yield "AetherMind: Cohere API rate limit reached."

            else:
                yield f"AI Error: {error_str}"

            return

    # GEMINI — using new google.genai SDK
    elif is_gemini_model:
        if not effective_gemini_key:
            yield "AetherMind: Please enter your Gemini API key in Settings."
            return

        try:
            from google import genai
            from google.genai import types as genai_types

            client = genai.Client(api_key=effective_gemini_key)

            # Build content parts
            text_parts = []

            if context_str:
                text_parts.append(f"Background Context:\n{context_str}")

            for msg in chat_history[-5:]:
                sender = "User" if msg["sender"] == "user" else "Assistant"
                text_parts.append(f"{sender}: {msg['content']}")

            text_parts.append(f"User Query: {query}")

            # Process attachments
            multimodal_parts = []
            if attachments:
                import base64
                for att in attachments:
                    att_type = att.get("type", "").lower()
                    if att.get("data") and att_type:
                        try:
                            b64_data = att["data"]
                            if "," in b64_data:
                                b64_data = b64_data.split(",")[1]
                            raw_data = base64.b64decode(b64_data)

                            # Native Gemini multimodal mime types: images, video, audio, pdf
                            if att_type.startswith("image/") or att_type.startswith("audio/") or att_type.startswith("video/") or "pdf" in att_type:
                                multimodal_parts.append(
                                    genai_types.Part.from_bytes(
                                        data=raw_data,
                                        mime_type=att["type"]
                                    )
                                )
                            else:
                                # Fallback text extraction for office documents & plaintext
                                ext_text = extract_text_from_file(raw_data, att_type)
                                if ext_text:
                                    text_parts.append(
                                        f"\n--- Attached Document ({att.get('name', 'file')}) ---\n{ext_text}\n-------------------------------\n"
                                    )
                        except Exception as e:
                            print("Error processing attachment:", e)

            # Combine text + multimodal parts
            content_parts = ["\n".join(text_parts)] + multimodal_parts

            config = genai_types.GenerateContentConfig(
                system_instruction=system_instructions,
                temperature=temperature,
            )

            response = await asyncio.to_thread(
                client.models.generate_content_stream,
                model=active_model,
                contents=content_parts,
                config=config,
            )

            for chunk in response:
                if chunk.text:
                    yield chunk.text

            return

        except Exception as e:
            error_str = str(e)

            if "429" in error_str or "quota" in error_str.lower():
                yield "AetherMind: Gemini quota exceeded. Please wait 30 seconds."
            elif "API_KEY_INVALID" in error_str or "invalid" in error_str.lower():
                yield "AetherMind: Invalid Gemini API key. Please check your key in Settings."
            else:
                yield f"AI Error: {error_str}"

            return

    # UNKNOWN MODEL
    else:
        yield f"AetherMind Error: Model '{active_model}' not supported."
        return