import os
import shutil
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.postgres import get_db
from app.db.models import User
from app.api.v1.auth import get_current_user

router = APIRouter(prefix="/profile", tags=["profile"])

class ProfileUpdate(BaseModel):
    username: Optional[str] = None
    preferred_language: Optional[str] = None
    interface_style: Optional[str] = None
    theme_style: Optional[str] = None

@router.patch("")
def update_profile(
    payload: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if payload.username is not None:
        current_user.username = payload.username
    if payload.preferred_language is not None:
        current_user.preferred_language = payload.preferred_language
    if payload.interface_style is not None:
        current_user.interface_style = payload.interface_style
    if payload.theme_style is not None:
        current_user.theme_style = payload.theme_style

    db.commit()
    db.refresh(current_user)

    return {
        "message": "Profile updated successfully",
        "user": {
            "id": current_user.id,
            "username": current_user.username,
            "preferred_language": current_user.preferred_language,
            "interface_style": current_user.interface_style,
            "theme_style": current_user.theme_style
        }
    }

@router.post("/upload")
async def upload_profile_picture(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Validate extension
    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in [".png", ".jpg", ".jpeg", ".webp"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PNG, JPG, JPEG, and WEBP files are allowed."
        )

    # Ensure upload directory exists
    upload_dir = "uploads/profile"
    os.makedirs(upload_dir, exist_ok=True)

    unique_filename = f"{current_user.id}_{uuid.uuid4().hex[:8]}{ext}"
    file_path = os.path.join(upload_dir, unique_filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # URL could be just path or fully qualified
    # In a real app we might serve static files via FastAPI or external storage
    profile_picture_url = f"/uploads/profile/{unique_filename}"

    current_user.profile_picture_url = profile_picture_url
    db.commit()
    db.refresh(current_user)

    return {
        "message": "Profile picture uploaded successfully",
        "profile_picture_url": profile_picture_url
    }

