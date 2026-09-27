import re
from typing import Optional, List, Dict, Any

class IntentDetector:
    """Centralized Intent Classifier to route user requests to appropriate AI pipelines."""

    def detect_intent(self, query: str, chat_mode: str = "general", attachments: Optional[List[Dict[str, Any]]] = None) -> str:
        query_clean = query.strip()
        query_lower = query_clean.lower()

        # 1. Image Generation Intent
        if query_lower.startswith("/image") or any(phrase in query_lower for phrase in [
            "generate image", "create an image", "draw a", "make a picture", "paint a", "generate a photo", "render an artwork"
        ]):
            return "image_generation"

        # 2. Vision Intent (Image Attachment Analysis)
        if attachments and any(att.get("type", "").startswith("image/") for att in attachments):
            return "vision"

        # 3. Document / RAG Intent
        if chat_mode == "docChat" or (attachments and any(
            any(ext in att.get("type", "").lower() for ext in ["pdf", "word", "docx", "text", "csv", "excel"])
            for att in attachments
        )):
            return "document"

        # 4. Audio / Speech Intent
        if chat_mode == "voice" or (attachments and any(att.get("type", "").startswith("audio/") for att in attachments)):
            return "speech"

        # 5. Default Text Chat Intent
        return "chat"

intent_detector = IntentDetector()
