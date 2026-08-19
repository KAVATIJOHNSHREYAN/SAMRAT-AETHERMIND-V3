import os
import hashlib
import json
from typing import List
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Header, status
from pydantic import BaseModel
import pypdf
from sqlalchemy.orm import Session

from app.db.vector_store import add_documents_to_vector_store, get_embedding
from app.api.v1.auth import get_current_user
from app.db.models import User, PDF, PDFChunk
from app.db.postgres import get_db

router = APIRouter(prefix="/upload", tags=["upload"])

def chunk_text(text: str, chunk_size: int = 600, chunk_overlap: int = 100) -> List[str]:
    chunks = []
    start = 0
    if not text:
        return chunks
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        # Break if we've reached the end
        if end >= len(text):
            break
        start += (chunk_size - chunk_overlap)
    return chunks

@router.post("")
async def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    x_gemini_api_key: str = Header(None, alias="X-Gemini-API-Key"),
    x_openai_api_key: str = Header(None, alias="X-OpenAI-API-Key")
):
    # Validate extension
    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in [".pdf", ".txt"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF and TXT files are accepted for custom knowledge RAG ingestion."
        )

    # Save to temp uploads to calculate hash and parse
    uploads_dir = "/tmp/uploads" if os.getenv("VERCEL") else os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "uploads"))
    os.makedirs(uploads_dir, exist_ok=True)
    temp_file_path = os.path.join(uploads_dir, filename)

    try:
        # Read contents
        contents = await file.read()
        # Calculate SHA-256 hash
        sha256 = hashlib.sha256(contents).hexdigest()

        # Check if PDF already exists
        existing_pdf = db.query(PDF).filter(PDF.file_hash == sha256, PDF.user_id == current_user.id).first()
        if existing_pdf:
            return {
                "status": "success",
                "message": "PDF already exists.",
                "pdf_id": existing_pdf.id,
                "filename": existing_pdf.filename,
                "chunks_indexed": 0
            }

        # Write to disk temporarily
        with open(temp_file_path, "wb") as f:
            f.write(contents)

        raw_text = ""
        if ext == ".pdf":
            # Read PDF pages
            reader = pypdf.PdfReader(temp_file_path)
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    raw_text += text + "\n"
        elif ext == ".txt":
            raw_text = contents.decode("utf-8")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to parse document: {str(e)}"
        )

    if not raw_text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file contains no readable text."
        )

    # Chunk text
    chunks = chunk_text(raw_text)
    if not chunks:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to segment text into processing chunks."
        )

    # We pass the API key to generate vectors if present
    api_key = x_gemini_api_key or x_openai_api_key

    try:
        # Save to main relational tables (PDF & PDFChunk)
        pdf_record = PDF(
            filename=filename,
            user_id=current_user.id,
            file_hash=sha256,
            extracted_text=raw_text
        )
        db.add(pdf_record)
        db.commit()
        db.refresh(pdf_record)

        # Write chunks with embeddings to database and FAISS
        metadatas = [{"filename": filename, "user_id": current_user.id, "pdf_id": pdf_record.id} for _ in chunks]
        add_documents_to_vector_store(chunks, metadatas=metadatas, api_key=api_key)

        for index, chunk in enumerate(chunks):
            embedding = get_embedding(chunk, api_key) or []
            chunk_record = PDFChunk(
                pdf_id=pdf_record.id,
                chunk_number=index,
                chunk_text=chunk,
                embedding=json.dumps(embedding)
            )
            db.add(chunk_record)
        db.commit()

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to write embeddings to vector database: {str(e)}"
        )

    return {
        "status": "success",
        "message": "PDF uploaded successfully!",
        "pdf_id": pdf_record.id,
        "filename": filename,
        "chunks_indexed": len(chunks),
        "total_characters": len(raw_text)
    }

