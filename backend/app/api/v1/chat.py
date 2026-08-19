import json
import asyncio
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Header
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.postgres import get_db
from app.db.models import User, Chat, Message
from app.api.v1.auth import get_current_user
from app.services.ai_pipeline import generate_response_stream

router = APIRouter(prefix="/chat", tags=["chat"])

# Pydantic Schemas
class ChatCreate(BaseModel):
    title: Optional[str] = "New Chat"
    mode: Optional[str] = "general"
    is_pinned: Optional[bool] = None

class ChatResponse(BaseModel):
    id: str
    title: str
    mode: str
    is_pinned: bool
    created_at: str

class Attachment(BaseModel):
    type: str  # e.g. "image/png", "image/jpeg"
    data: str  # base64 string
    name: Optional[str] = None

class MessageCreate(BaseModel):
    content: str
    model_name: Optional[str] = "gemini-2.5-flash"
    temperature: Optional[float] = 0.7
    system_prompt: Optional[str] = None
    enable_rag: Optional[bool] = True
    rag_k: Optional[int] = 3
    attachments: Optional[List[Attachment]] = None

class MessageResponse(BaseModel):
    id: str
    chat_id: str
    sender: str
    content: str
    created_at: str

# Endpoints
@router.post("", response_model=ChatResponse)
def create_chat(payload: ChatCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    new_chat = Chat(
        user_id=current_user.id,
        title=payload.title,
        mode=payload.mode
    )
    db.add(new_chat)
    db.commit()
    db.refresh(new_chat)
    
    return {
        "id": new_chat.id,
        "title": new_chat.title,
        "mode": new_chat.mode,
        "is_pinned": new_chat.is_pinned,
        "created_at": new_chat.created_at.isoformat()
    }

@router.get("", response_model=List[ChatResponse])
def get_chats(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    chats = db.query(Chat).filter(Chat.user_id == current_user.id).order_by(Chat.updated_at.desc()).all()
    return [
        {
            "id": chat.id,
            "title": chat.title,
            "mode": chat.mode,
            "is_pinned": chat.is_pinned,
            "created_at": chat.created_at.isoformat()
        } for chat in chats
    ]

@router.get("/{chat_id}/history", response_model=List[MessageResponse])
def get_chat_history(chat_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    chat = db.query(Chat).filter(Chat.id == chat_id, Chat.user_id == current_user.id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
        
    messages = db.query(Message).filter(Message.chat_id == chat_id).order_by(Message.created_at.asc()).all()
    return [
        {
            "id": msg.id,
            "chat_id": msg.chat_id,
            "sender": msg.sender,
            "content": msg.content,
            "created_at": msg.created_at.isoformat()
        } for msg in messages
    ]

@router.post("/{chat_id}/message")
def post_message(
    chat_id: str, 
    payload: MessageCreate, 
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db),
    x_gemini_api_key: Optional[str] = Header(None, alias="X-Gemini-API-Key"),
    x_openai_api_key: Optional[str] = Header(None, alias="X-OpenAI-API-Key"),
    x_replicate_api_key: Optional[str] = Header(None, alias="X-Replicate-API-Key"),
    x_cohere_api_key: Optional[str] = Header(None, alias="X-Cohere-API-Key")
):
    chat = db.query(Chat).filter(Chat.id == chat_id, Chat.user_id == current_user.id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
        
    # Save User message (append image and document attachments as markdown/text)
    content_to_save = payload.content
    if payload.attachments:
        for att in payload.attachments:
            if att.type.startswith("image/"):
                content_to_save += f"\n\n![Image](data:{att.type};base64,{att.data})"
            else:
                type_label = "File Attachment"
                att_type = att.type.lower() if att.type else ""
                if "pdf" in att_type:
                    type_label = "PDF Document"
                elif "word" in att_type or "docx" in att_type:
                    type_label = "Word Document"
                elif "presentation" in att_type or "powerpoint" in att_type or "pptx" in att_type:
                    type_label = "PowerPoint Presentation"
                elif "text" in att_type or "plain" in att_type:
                    type_label = "Text File"
                
                filename = att.name or "Document"
                content_to_save += f"\n\n---\n📎 **{filename}** ({type_label})"

    user_msg = Message(
        chat_id=chat_id,
        sender="user",
        content=content_to_save
    )
    db.add(user_msg)
    
    # Auto-title generation
    if chat.title == "New Chat" or chat.title == "New Conversation":
        chat.title = payload.content[:30] + ("..." if len(payload.content) > 30 else "")
        
    # Extract dialogue logs for prompts
    history_msgs = db.query(Message).filter(Message.chat_id == chat_id).order_by(Message.created_at.asc()).all()
    history = [{"sender": m.sender, "content": m.content} for m in history_msgs]
    
    db.commit()
    
    # 1. Parse Image and Video Generation Triggers
    content_lower = payload.content.lower().strip()
    image_triggers = [
        "create an image", "create image", "create pic", "create a picture", 
        "generate image", "generate a picture", "generate pic", "generate a pic", 
        "draw a", "make a picture", "make a photo", "create a photo", "/image"
    ]
    is_image_request = content_lower.startswith("/image") or any(phrase in content_lower for phrase in image_triggers)
    is_video_request = content_lower.startswith("/video") or any(phrase in content_lower for phrase in ["generate video", "make a video", "generate an animation", "animate "])
    
    has_image_attachment = payload.attachments and len(payload.attachments) > 0 and any(a.type.startswith("image/") for a in payload.attachments)

    if is_image_request:
        prompt_text = payload.content
        for trigger in image_triggers:
            if trigger in content_lower:
                # Case-insensitive replacement
                idx = prompt_text.lower().find(trigger)
                if idx != -1:
                    prompt_text = prompt_text[:idx] + prompt_text[idx+len(trigger):]
        prompt_text = prompt_text.strip()
        
        async def media_image_generator():
            yield f"data: {json.dumps({'chunk': '🎨 Initalizing AetherMind Image Generation Engine...\n'})}\n\n"
            await asyncio.sleep(0.4)
            
            from app.services.media_pipeline import generate_image, swap_faces
            
            if has_image_attachment:
                yield f"data: {json.dumps({'chunk': '👤 Processing face references for consistency...\n'})}\n\n"
                await asyncio.sleep(0.4)
                face_b64 = [a.data for a in payload.attachments if a.type.startswith("image/")][0]
                img_url = await asyncio.to_thread(swap_faces, face_b64, prompt_text or "a model portrait", x_replicate_api_key)
            else:
                yield f"data: {json.dumps({'chunk': '⚡ Fetching high-quality visual outputs...\n'})}\n\n"
                await asyncio.sleep(0.4)
                img_url = await asyncio.to_thread(generate_image, prompt_text or "cyberpunk portrait", x_openai_api_key)
            
            markdown_content = f"\n\n![Generated Image]({img_url})\n"
            
            # Save complete reply to DB at end of stream
            from app.db.postgres import SessionLocal
            with SessionLocal() as db_session:
                bot_msg = Message(
                    chat_id=chat_id,
                    sender="assistant",
                    content=markdown_content
                )
                db_session.add(bot_msg)
                
                active_chat = db_session.query(Chat).filter(Chat.id == chat_id).first()
                if active_chat:
                    from sqlalchemy import func
                    active_chat.updated_at = func.now()
                db_session.commit()
                
            yield f"data: {json.dumps({'chunk': markdown_content})}\n\n"
            
        return StreamingResponse(media_image_generator(), media_type="text/event-stream")

    elif is_video_request:
        prompt_text = payload.content.replace("/video", "").strip()
        
        async def media_video_generator():
            yield f"data: {json.dumps({'chunk': '🎥 Initializing AetherMind Video Generation Engine...\n'})}\n\n"
            await asyncio.sleep(0.4)
            yield f"data: {json.dumps({'chunk': '⚙️ Rendering temporal frames and motion vectors...\n'})}\n\n"
            await asyncio.sleep(0.4)
            
            from app.services.media_pipeline import generate_video
            video_url = await asyncio.to_thread(generate_video, prompt_text or "cyberpunk city loop", x_replicate_api_key)
            
            video_content = f'\n\n<video src="{video_url}" controls class="w-full max-w-lg rounded-2xl border border-violet-850 shadow-lg shadow-violet-950/30" />\n'
            
            from app.db.postgres import SessionLocal
            with SessionLocal() as db_session:
                bot_msg = Message(
                    chat_id=chat_id,
                    sender="assistant",
                    content=video_content
                )
                db_session.add(bot_msg)
                
                active_chat = db_session.query(Chat).filter(Chat.id == chat_id).first()
                if active_chat:
                    from sqlalchemy import func
                    active_chat.updated_at = func.now()
                db_session.commit()
                
            yield f"data: {json.dumps({'chunk': video_content})}\n\n"
            
        return StreamingResponse(media_video_generator(), media_type="text/event-stream")

    # Standard Chat response stream generator
    async def response_generator():
        assistant_content = ""
        
        # Convert attachments schema to dictionaries
        attachments_list = [{"type": a.type, "data": a.data} for a in payload.attachments] if payload.attachments else None
        
        async for chunk in generate_response_stream(
            query=payload.content, 
            chat_history=history, 
            chat_mode=chat.mode,
            active_model=payload.model_name,
            temperature=payload.temperature,
            system_prompt=payload.system_prompt,
            enable_rag=payload.enable_rag,
            rag_k=payload.rag_k,
            openai_key=x_openai_api_key,
            gemini_key=x_gemini_api_key,
            cohere_key=x_cohere_api_key,
            attachments=attachments_list,
            user_id=current_user.id
        ):
            assistant_content += chunk
            yield f"data: {json.dumps({'chunk': chunk})}\n\n"
            
        # Save complete reply to DB at end of stream
        from app.db.postgres import SessionLocal
        with SessionLocal() as db_session:
            bot_msg = Message(
                chat_id=chat_id,
                sender="assistant",
                content=assistant_content
            )
            db_session.add(bot_msg)
            
            active_chat = db_session.query(Chat).filter(Chat.id == chat_id).first()
            if active_chat:
                from sqlalchemy import func
                active_chat.updated_at = func.now()
            db_session.commit()
            
    return StreamingResponse(response_generator(), media_type="text/event-stream")

@router.put("/{chat_id}")
def update_chat(
    chat_id: str,
    payload: ChatCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update chat title, mode, or pinned status."""
    chat = db.query(Chat).filter(Chat.id == chat_id, Chat.user_id == current_user.id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    if payload.title is not None:
        chat.title = payload.title
    if payload.mode is not None:
        chat.mode = payload.mode
    if payload.is_pinned is not None:
        chat.is_pinned = payload.is_pinned
    
    db.commit()
    db.refresh(chat)
    
    return {
        "id": chat.id,
        "title": chat.title,
        "mode": chat.mode,
        "is_pinned": chat.is_pinned,
        "created_at": chat.created_at.isoformat()
    }

@router.delete("/{chat_id}")
def delete_chat(
    chat_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a chat and all its messages."""
    chat = db.query(Chat).filter(Chat.id == chat_id, Chat.user_id == current_user.id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    # Delete all messages in this chat (cascade should handle this, but explicit is safer)
    db.query(Message).filter(Message.chat_id == chat_id).delete()
    
    # Delete the chat
    db.delete(chat)
    db.commit()
    
    return {"message": "Chat deleted successfully", "chat_id": chat_id}

@router.delete("/{chat_id}/message/{message_id}")
def delete_message(
    chat_id: str,
    message_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a specific message from a chat."""
    # Verify the chat belongs to the user
    chat = db.query(Chat).filter(Chat.id == chat_id, Chat.user_id == current_user.id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    # Delete the message
    message = db.query(Message).filter(
        Message.id == message_id,
        Message.chat_id == chat_id
    ).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    db.delete(message)
    db.commit()
    
    return {"message": "Message deleted successfully", "message_id": message_id}
