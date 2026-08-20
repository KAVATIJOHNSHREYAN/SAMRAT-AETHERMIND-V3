import os
import io
import re
import uuid
import json
import asyncio
import requests
from typing import Optional, List, Dict
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, Header, status, BackgroundTasks
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
import pypdf

from app.db.postgres import get_db
from app.db.models import User, Chat, Message
from app.api.v1.auth import get_current_user
from app.services.storage import upload_to_cloudinary
from app.services.ner import extract_entities
from app.services.web_search import search_web_query
from app.services.ai_pipeline import generate_response_stream
from app.services.media_pipeline import generate_image, swap_faces
from app.db.vector_store import add_documents_to_vector_store

router = APIRouter(tags=["production"])

# Celery import wrapped in try-except to avoid crash if celery app fails to boot
celery_available = False
try:
    from app.tasks import celery_app, async_generate_video_task
    celery_available = True
except Exception as e:
    print(f"Celery task worker queue disabled or offline: {e}")

# In-memory database for background tasks status (FastAPI BackgroundTasks fallback)
bg_tasks_db: Dict[str, Dict] = {}

# Security definitions
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from app.config import settings

security_opt = HTTPBearer(auto_error=False)

def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_opt),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """Parse user from token if available, but do not fail if absent."""
    if not credentials:
        return None
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
        if user_id:
            return db.query(User).filter(User.id == user_id).first()
    except Exception:
        pass
    return None

# Pydantic Schemas
class ChatMessageHistory(BaseModel):
    sender: str
    content: str

class AttachmentSchema(BaseModel):
    type: str
    data: str

class ChatRequest(BaseModel):
    content: str
    chat_id: Optional[str] = None
    chat_history: Optional[List[ChatMessageHistory]] = None
    model_name: Optional[str] = "gemini-2.5-flash"
    temperature: Optional[float] = 0.7
    system_prompt: Optional[str] = None
    enable_rag: Optional[bool] = True
    rag_k: Optional[int] = 3
    attachments: Optional[List[AttachmentSchema]] = None

class SpeakRequest(BaseModel):
    text: str

class ImageRequest(BaseModel):
    prompt: str

class VideoRequest(BaseModel):
    prompt: str

class SearchRequest(BaseModel):
    query: str
    max_results: Optional[int] = 5

# Helper function for background task fallback
def run_sync_video_generation(task_id: str, prompt: str, replicate_key: str = None):
    bg_tasks_db[task_id] = {"status": "PROGRESS", "result": None}
    try:
        from app.services.media_pipeline import generate_video
        temp_video_url = generate_video(prompt, replicate_key)

        # Persist to Cloudinary if real
        final_url = temp_video_url
        if temp_video_url and temp_video_url.startswith("http") and "mixkit.co" not in temp_video_url:
            response = requests.get(temp_video_url, timeout=30)
            if response.status_code == 200:
                final_url = upload_to_cloudinary(response.content, "videos")

        bg_tasks_db[task_id] = {"status": "SUCCESS", "result": final_url}
    except Exception as e:
        bg_tasks_db[task_id] = {"status": "FAILURE", "result": str(e)}

# --- ENDPOINTS ---

@router.post("/chat")
def chat_endpoint(
    payload: ChatRequest,
    background_tasks: BackgroundTasks,
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
    x_gemini_api_key: Optional[str] = Header(None, alias="X-Gemini-API-Key"),
    x_openai_api_key: Optional[str] = Header(None, alias="X-OpenAI-API-Key"),
    x_replicate_api_key: Optional[str] = Header(None, alias="X-Replicate-API-Key"),
    x_cohere_api_key: Optional[str] = Header(None, alias="X-Cohere-API-Key")
):
    """
    Unified chat endpoint. Streams responses back. Saves history if user is authenticated and chat_id is provided.
    Supports inline `/image` and `/video` generations.
    """
    user_id = current_user.id if current_user else None

    # Save User message in DB if authenticated and chat_id is provided
    if current_user and payload.chat_id:
        chat = db.query(Chat).filter(Chat.id == payload.chat_id, Chat.user_id == current_user.id).first()
        if chat:
            # Check if user message already exists
            last_msg = db.query(Message).filter(Message.chat_id == payload.chat_id).order_by(Message.created_at.desc()).first()
            if not last_msg or last_msg.content != payload.content or last_msg.sender != "user":
                user_msg = Message(
                    chat_id=payload.chat_id,
                    sender="user",
                    content=payload.content
                )
                db.add(user_msg)
                db.commit()

    # 1. Parse Image and Video triggers
    content_lower = payload.content.lower().strip()
    is_image_request = content_lower.startswith("/image") or any(phrase in content_lower for phrase in ["generate image", "generate a picture", "draw a", "make a picture"])
    is_video_request = content_lower.startswith("/video") or any(phrase in content_lower for phrase in ["generate video", "make a video", "generate an animation", "animate "])

    has_image_attachment = payload.attachments and len(payload.attachments) > 0 and any(a.type.startswith("image/") for a in payload.attachments)

    if is_image_request:
        prompt_text = payload.content.replace("/image", "").strip()

        async def image_stream_generator():
            yield f"data: {json.dumps({'chunk': '🎨 Initializing AetherMind Image Generation Engine...\n'})}\n\n"
            await asyncio.sleep(0.4)

            if has_image_attachment:
                yield f"data: {json.dumps({'chunk': '👤 Processing face references for consistency...\n'})}\n\n"
                await asyncio.sleep(0.4)
                face_b64 = [a.data for a in payload.attachments if a.type.startswith("image/")][0]
                img_url = await asyncio.to_thread(swap_faces, face_b64, prompt_text or "a model portrait", x_replicate_api_key)
            else:
                yield f"data: {json.dumps({'chunk': '⚡ Fetching high-quality visual outputs...\n'})}\n\n"
                await asyncio.sleep(0.4)
                img_url = await asyncio.to_thread(generate_image, prompt_text or "cyberpunk portrait", x_openai_api_key)

            # Upload to Cloudinary for production persistence
            try:
                response = requests.get(img_url, timeout=20)
                if response.status_code == 200:
                    img_url = upload_to_cloudinary(response.content, "images")
            except Exception as e:
                print(f"Cloudinary upload fallback exception: {e}")

            markdown_content = f"\n\n![Generated Image]({img_url})\n"

            # Save complete reply to DB if stateful
            if current_user and payload.chat_id:
                from app.db.postgres import SessionLocal
                with SessionLocal() as db_session:
                    bot_msg = Message(
                        chat_id=payload.chat_id,
                        sender="assistant",
                        content=markdown_content
                    )
                    db_session.add(bot_msg)
                    db_session.commit()

            yield f"data: {json.dumps({'chunk': markdown_content})}\n\n"

        return StreamingResponse(image_stream_generator(), media_type="text/event-stream")

    elif is_video_request:
        prompt_text = payload.content.replace("/video", "").strip()
        rep_key = x_replicate_api_key or os.getenv("REPLICATE_API_KEY")

        async def video_stream_generator():
            yield f"data: {json.dumps({'chunk': '🎥 Initializing AetherMind Video Generation Engine...\n'})}\n\n"
            await asyncio.sleep(0.4)

            task_id = f"bg_{uuid.uuid4().hex}"
            queue = "background_tasks"

            if celery_available:
                try:
                    task = async_generate_video_task.delay(prompt_text or "cyberpunk city", rep_key)
                    task_id = task.id
                    queue = "celery"
                except Exception as e:
                    print(f"Celery queue error: {e}. Falling back to BackgroundTasks.")

            if queue == "background_tasks":
                bg_tasks_db[task_id] = {"status": "PENDING", "result": None}
                background_tasks.add_task(run_sync_video_generation, task_id, prompt_text or "cyberpunk city", rep_key)

            yield f"data: {json.dumps({'chunk': f'🎥 Video enqueued successfully. (Task ID: {task_id})\nRendering frames...\n', 'task_id': task_id, 'status': 'PENDING'})}\n\n"

        return StreamingResponse(video_stream_generator(), media_type="text/event-stream")

    # Construct history structure for standard text chatbot
    history = []
    if payload.chat_history:
        history = [{"sender": m.sender, "content": m.content} for m in payload.chat_history]

    async def response_generator():
        assistant_content = ""
        attachments_list = [{"type": a.type, "data": a.data} for a in payload.attachments] if payload.attachments else None

        # Load user_id context to restrict FAISS search multi-tenancy
        async for chunk in generate_response_stream(
            query=payload.content,
            chat_history=history,
            chat_mode="general",
            active_model=payload.model_name,
            temperature=payload.temperature,
            system_prompt=payload.system_prompt,
            enable_rag=payload.enable_rag,
            rag_k=payload.rag_k,
            openai_key=x_openai_api_key,
            gemini_key=x_gemini_api_key,
            cohere_key=x_cohere_api_key,
            attachments=attachments_list,
            user_id=user_id
        ):
            assistant_content += chunk
            yield f"data: {json.dumps({'chunk': chunk})}\n\n"

        # Save complete reply to DB if authenticated and chat_id is provided
        if current_user and payload.chat_id:
            from app.db.postgres import SessionLocal
            with SessionLocal() as db_session:
                bot_msg = Message(
                    chat_id=payload.chat_id,
                    sender="assistant",
                    content=assistant_content
                )
                db_session.add(bot_msg)
                active_chat = db_session.query(Chat).filter(Chat.id == payload.chat_id).first()
                if active_chat:
                    from sqlalchemy import func
                    active_chat.updated_at = func.now()
                db_session.commit()

    return StreamingResponse(response_generator(), media_type="text/event-stream")

@router.post("/voice/transcribe")
async def voice_transcribe(
    file: UploadFile = File(...),
    x_openai_api_key: Optional[str] = Header(None, alias="X-OpenAI-API-Key")
):
    """
    Transcribe raw voice recordings using OpenAI Whisper API.
    """
    api_key = x_openai_api_key or os.getenv("OPENAI_API_KEY")
    if not api_key:
        # Fallback simulated transcription for sandbox/developer setups
        return {"text": "Aether voice command received. Please configure an OpenAI API key in the settings tab to enable Whisper."}

    content = await file.read()
    ext = os.path.splitext(file.filename or "audio.webm")[1]
    if not ext:
        ext = ".webm"

    import tempfile
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)
        with open(tmp_path, "rb") as audio_file:
            transcript = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file
            )
            return {"text": transcript.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Whisper transcription failed: {str(e)}")
    finally:
        try:
            os.remove(tmp_path)
        except:
            pass

@router.post("/voice/speak")
async def voice_speak(
    payload: SpeakRequest,
    x_openai_api_key: Optional[str] = Header(None, alias="X-OpenAI-API-Key"),
    elevenlabs_api_key: Optional[str] = Header(None, alias="ElevenLabs-API-Key")
):
    """
    Convert text back to speech using ElevenLabs or OpenAI TTS.
    """
    # 1. ElevenLabs Speech Synthesis (higher quality)
    el_key = elevenlabs_api_key or os.getenv("ELEVENLABS_API_KEY")
    if el_key:
        try:
            url = "https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM"
            headers = {
                "xi-api-key": el_key,
                "Content-Type": "application/json",
                "accept": "audio/mpeg"
            }
            body = {
                "text": payload.text,
                "model_id": "eleven_monolingual_v1",
                "voice_settings": {
                    "stability": 0.5,
                    "similarity_boost": 0.5
                }
            }
            res = requests.post(url, json=body, headers=headers, timeout=15)
            if res.status_code == 200:
                return StreamingResponse(io.BytesIO(res.content), media_type="audio/mpeg")
        except Exception as e:
            print(f"ElevenLabs TTS failed, falling back to OpenAI TTS: {e}")

    # 2. OpenAI Speech Synthesis
    oa_key = x_openai_api_key or os.getenv("OPENAI_API_KEY")
    if oa_key:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=oa_key)
            response = client.audio.speech.create(
                model="tts-1",
                voice="alloy",
                input=payload.text
            )
            return StreamingResponse(io.BytesIO(response.content), media_type="audio/mpeg")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"OpenAI TTS synthesis failed: {str(e)}")

    # 3. Fail gracefully if no keys configured
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Speech synthesis requires ElevenLabs or OpenAI API credentials."
    )

@router.post("/generate/image")
async def generate_image_route(
    payload: ImageRequest,
    x_openai_api_key: Optional[str] = Header(None, alias="X-OpenAI-API-Key"),
    stability_api_key: Optional[str] = Header(None, alias="Stability-API-Key")
):
    """
    Generate image using OpenAI DALL-E, Stability AI, or Pollinations.
    Persists final image to Cloudinary storage.
    """
    prompt = payload.prompt

    # 1. Try Stability AI
    stab_key = stability_api_key or os.getenv("STABILITY_API_KEY")
    if stab_key:
        try:
            url = "https://api.stability.ai/v1/generation/stable-diffusion-v1-6/text-to-image"
            headers = {
                "Accept": "application/json",
                "Authorization": f"Bearer {stab_key}"
            }
            body = {
                "text_prompts": [{"text": prompt}],
                "cfg_scale": 7,
                "height": 1024,
                "width": 1024,
                "samples": 1,
                "steps": 30,
            }
            res = requests.post(url, headers=headers, json=body, timeout=20)
            if res.status_code == 200:
                artifacts = res.json().get("artifacts", [])
                if artifacts:
                    import base64
                    img_bytes = base64.b64decode(artifacts[0].get("base64"))
                    url = upload_to_cloudinary(img_bytes, "images")
                    return {"url": url}
        except Exception as e:
            print(f"Stability AI image generation failed: {e}. Trying DALL-E.")

    # 2. Try DALL-E / Pollinations standard service
    img_url = generate_image(prompt, x_openai_api_key)

    # 3. Store in Cloudinary for permanence if generated via Pollinations/DALL-E
    try:
        response = requests.get(img_url, timeout=20)
        if response.status_code == 200:
            permanent_url = upload_to_cloudinary(response.content, "images")
            return {"url": permanent_url}
    except Exception as e:
        print(f"Failed uploading generated image to Cloudinary: {e}")

    return {"url": img_url}

@router.post("/generate/video")
def generate_video_route(
    payload: VideoRequest,
    background_tasks: BackgroundTasks,
    x_replicate_api_key: Optional[str] = Header(None, alias="X-Replicate-API-Key"),
    runway_api_key: Optional[str] = Header(None, alias="Runway-API-Key")
):
    """
    Enqueues video generation asynchronously via Celery/Redis.
    Falls back to FastAPI BackgroundTasks if Celery is unavailable.
    """
    rep_key = x_replicate_api_key or os.getenv("REPLICATE_API_KEY")
    prompt = payload.prompt

    if celery_available and celery_app.broker_connection():
        try:
            # Enqueue celery task
            task = async_generate_video_task.delay(prompt, rep_key)
            return {"task_id": task.id, "status": "PENDING", "queue": "celery"}
        except Exception as e:
            print(f"Failed enqueuing Celery task: {e}. Falling back to BackgroundTasks.")

    # Fallback to local BackgroundTasks
    task_id = f"bg_{uuid.uuid4().hex}"
    bg_tasks_db[task_id] = {"status": "PENDING", "result": None}
    background_tasks.add_task(run_sync_video_generation, task_id, prompt, rep_key)
    return {"task_id": task_id, "status": "PENDING", "queue": "background_tasks"}

@router.get("/tasks/{task_id}")
def get_task_status(task_id: str):
    """
    Query the status of an enqueued video generation task.
    """
    if task_id.startswith("bg_"):
        # Check background tasks db
        task_info = bg_tasks_db.get(task_id)
        if not task_info:
            raise HTTPException(status_code=404, detail="Task not found")
        return task_info

    if not celery_available:
        raise HTTPException(status_code=400, detail="Celery backend is disabled")

    from celery.result import AsyncResult
    task_result = AsyncResult(task_id, app=celery_app)

    response = {
        "status": task_result.state,
        "result": None
    }

    if task_result.state == "SUCCESS":
        response["result"] = task_result.result
    elif task_result.state == "FAILURE":
        response["result"] = str(task_result.result)

    return response

@router.post("/upload/document")
async def upload_document_production(
    file: UploadFile = File(...),
    current_user: Optional[User] = Depends(get_optional_user)
):
    """
    Ingest text documents and PDFs, indexing them into local FAISS database.
    """
    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in [".pdf", ".txt"]:
        raise HTTPException(status_code=400, detail="Accepts PDF or TXT only.")

    raw_text = ""
    try:
        if ext == ".pdf":
            reader = pypdf.PdfReader(file.file)
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    raw_text += text + "\n"
        else:
            content = await file.read()
            raw_text = content.decode("utf-8")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed parsing file: {e}")

    if not raw_text.strip():
        raise HTTPException(status_code=400, detail="Document text content is empty.")

    # Standard chunking
    from app.api.v1.upload import chunk_text
    chunks = chunk_text(raw_text)

    # Construct metadata (store user_id for tenant filtering if logged in)
    u_id = current_user.id if current_user else "guest"
    metadatas = [{"filename": filename, "user_id": u_id} for _ in chunks]

    try:
        add_documents_to_vector_store(chunks, metadatas)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"FAISS indexing failed: {e}")

    return {
        "status": "SUCCESS",
        "filename": filename,
        "chunks_indexed": len(chunks)
    }

@router.post("/search/web")
def web_search_endpoint(payload: SearchRequest):
    """
    Exposes web crawl query results.
    """
    results = search_web_query(payload.query, payload.max_results)
    return {"results": results}

@router.post("/resume/analyze")
async def resume_analyze_endpoint(
    file: UploadFile = File(...),
    job_description: Optional[str] = Form(None),
    x_gemini_api_key: Optional[str] = Header(None, alias="X-Gemini-API-Key"),
    x_openai_api_key: Optional[str] = Header(None, alias="X-OpenAI-API-Key")
):
    """
    Parses resume (PDF/TXT), runs spaCy Named Entity Recognition (NER),
    and scores skills against the target job description using LLM.
    """
    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in [".pdf", ".txt"]:
        raise HTTPException(status_code=400, detail="Accepts PDF or TXT resume files only.")

    # Read text
    text_content = ""
    if ext == ".pdf":
        reader = pypdf.PdfReader(file.file)
        for page in reader.pages:
            t = page.extract_text()
            if t:
                text_content += t + "\n"
    else:
        content = await file.read()
        text_content = content.decode("utf-8")

    if not text_content.strip():
        raise HTTPException(status_code=400, detail="Empty resume file.")

    # 1. Run spaCy NER Information Extraction
    extracted_info = extract_entities(text_content)

    # 2. Score and analyze against Job Description using LLM if keys available
    analysis_report = "Please configure an OpenAI or Gemini API Key to perform full resume-to-job analysis."
    score = 50 # Fallback baseline score

    api_key = x_openai_api_key or x_gemini_api_key or os.getenv("OPENAI_API_KEY") or os.getenv("GEMINI_API_KEY")
    if api_key and job_description:
        prompt = (
            f"Review this candidate resume text and match it against the job description below.\n\n"
            f"Resume Text:\n{text_content[:3000]}\n\n"
            f"Job Description:\n{job_description}\n\n"
            f"Provide a structured analysis. First output a score between 0 and 100 on a line matching: 'SCORE: <value>'. "
            f"Then write a summary detailing key strengths, matching technologies, missing skills, and recommended improvements."
        )

        try:
            # We run a synchronous generator request helper to retrieve complete answer
            reply = ""
            async for chunk in generate_response_stream(
                query=prompt,
                chat_history=[],
                chat_mode="general",
                model_name="gemini-2.5-flash" if not x_openai_api_key else "gpt-4o-mini",
                temperature=0.3,
                openai_key=x_openai_api_key,
                gemini_key=x_gemini_api_key,
                enable_rag=False
            ):
                reply += chunk

            analysis_report = reply
            # Extract score
            score_match = re.search(r'SCORE:\s*(\d+)', reply, re.IGNORECASE)
            if score_match:
                score = int(score_match.group(1))
        except Exception as e:
            analysis_report = f"LLM Match Evaluation failed: {e}"

    elif not job_description:
        analysis_report = "Resume successfully parsed. Provide a target Job Description to activate matching analysis."
        score = 100 if len(extracted_info["skills"]) > 5 else 70

    return {
        "filename": filename,
        "entities": extracted_info,
        "match_score": score,
        "analysis": analysis_report
    }

