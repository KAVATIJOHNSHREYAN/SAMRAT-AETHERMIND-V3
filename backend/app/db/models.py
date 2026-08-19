import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean, Text, Integer, func
from sqlalchemy.orm import relationship
from app.db.postgres import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(String(255), primary_key=True, index=True) # supports Clerk ID formats e.g. user_...
    email = Column(String(255), unique=True, index=True, nullable=False)
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    username = Column(String(100), nullable=True)
    preferred_language = Column(String(50), default="English")
    interface_style = Column(String(50), default="Classic")
    theme_style = Column(String(50), default="dark")
    profile_picture_url = Column(Text, nullable=True)
    hashed_password = Column(String(255), nullable=True) # Nullable for OAuth-only users
    stripe_customer_id = Column(String(255), nullable=True)
    subscription_status = Column(String(50), default="free")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    chats = relationship("Chat", back_populates="user", cascade="all, delete-orphan")

class Chat(Base):
    __tablename__ = "chats"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(255), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), default="New Chat")
    is_pinned = Column(Boolean, default=False)
    mode = Column(String(50), default="general") # general, resume_prep, coding, debug
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="chats")
    messages = relationship("Message", back_populates="chat", cascade="all, delete-orphan")

class Message(Base):
    __tablename__ = "messages"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    chat_id = Column(String(36), ForeignKey("chats.id", ondelete="CASCADE"), nullable=False)
    sender = Column(String(50), nullable=False) # user, assistant, system
    content = Column(Text, nullable=False)
    tokens_used = Column(Integer, default=0)
    sentiment = Column(String(20), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    chat = relationship("Chat", back_populates="messages")

class PDF(Base):
    __tablename__ = "pdfs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(255), nullable=True)
    filename = Column(String(255))
    file_hash = Column(String(255), unique=True, index=True)
    extracted_text = Column(Text)

class PDFChunk(Base):
    __tablename__ = "pdf_chunks"

    id = Column(Integer, primary_key=True, index=True)
    pdf_id = Column(Integer)
    chunk_number = Column(Integer)
    chunk_text = Column(Text)
    embedding = Column(Text)

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    pdf_id = Column(Integer, index=True)
    role = Column(String(50))
    message = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

