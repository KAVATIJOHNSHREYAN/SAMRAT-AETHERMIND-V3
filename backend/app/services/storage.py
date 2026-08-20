import os
import uuid
import cloudinary
import cloudinary.uploader
from app.config import settings

# Configure Cloudinary if CLOUDINARY_URL is set in environment
cloudinary_url = os.getenv("CLOUDINARY_URL")
if cloudinary_url:
    # The SDK automatically uses CLOUDINARY_URL env var if configured,
    # but we can also manually parse or configure it if needed.
    cloudinary.config(secure=True)

def upload_to_cloudinary(file_bytes: bytes, folder: str, file_name: str = None) -> str:
    """
    Uploads a file's binary content to Cloudinary or falls back to local storage if credentials are missing.
    Returns the secure HTTP URL of the uploaded asset.
    """
    if not file_name:
        # Generate random unique filename
        file_name = f"{uuid.uuid4().hex}"

    if cloudinary_url:
        try:
            # Upload to Cloudinary. It automatically determines resource_type (image, video, raw).
            response = cloudinary.uploader.upload(
                file_bytes,
                folder=f"aetherchat/{folder}",
                public_id=file_name,
                resource_type="auto"
            )
            return response.get("secure_url")
        except Exception as e:
            print(f"Cloudinary upload failed: {e}. Falling back to local storage.")

    # Local fallback
    if os.getenv("VERCEL"):
        uploads_dir = "/tmp/uploads"
    else:
        uploads_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "uploads")
    os.makedirs(uploads_dir, exist_ok=True)

    # Try to guess extension based on folder
    ext = ""
    if folder == "images":
        ext = ".png"
    elif folder == "videos":
        ext = ".mp4"
    elif folder == "audio":
        ext = ".mp3"
    elif folder == "documents":
        ext = ".pdf"

    local_filename = f"{file_name}{ext}"
    local_path = os.path.join(uploads_dir, local_filename)

    with open(local_path, "wb") as f:
        f.write(file_bytes)

    # In production/local, the backend will expose static folder /uploads/
    # Return path relative to the server host
    return f"/uploads/{local_filename}"

