import os
import requests
from celery import Celery
from app.services.media_pipeline import generate_video
from app.services.storage import upload_to_cloudinary

# Configure Celery with Redis backend and broker
redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
celery_app = Celery("aether_tasks", broker=redis_url, backend=redis_url)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True
)

@celery_app.task(name="tasks.async_generate_video")
def async_generate_video_task(prompt: str, replicate_key: str = None) -> str:
    """
    Asynchronous Celery task to generate a video clip using Replicate
    and upload it permanently to Cloudinary.
    """
    print(f"Starting async video generation for prompt: '{prompt}'")

    # 1. Call standard Replicate pipeline
    temp_video_url = generate_video(prompt, replicate_key)

    # 2. If it is a real URL and not a warning/fallback placeholder, persist in Cloudinary
    if temp_video_url and temp_video_url.startswith("http") and "mixkit.co" not in temp_video_url:
        try:
            print(f"Downloading temporary video from Replicate: {temp_video_url}")
            response = requests.get(temp_video_url, timeout=30)
            if response.status_code == 200:
                print("Uploading video bytes to Cloudinary...")
                permanent_url = upload_to_cloudinary(
                    file_bytes=response.content,
                    folder="videos",
                    file_name=None
                )
                print(f"Permanent video uploaded to Cloudinary: {permanent_url}")
                return permanent_url
        except Exception as e:
            print(f"Error persisting generated video to Cloudinary: {e}")

    # Fallback to the temp url or placeholder
    return temp_video_url

