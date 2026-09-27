import os
import logging
import asyncio
import requests
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
from app.services.storage import upload_to_cloudinary

logger = logging.getLogger(__name__)

class BaseImageProvider(ABC):
    def __init__(self, provider_id: str, name: str):
        self.provider_id = provider_id
        self.name = name

    @abstractmethod
    def generate(self, prompt: str, api_key: str) -> Optional[str]:
        pass

class OpenAIImageProvider(BaseImageProvider):
    def __init__(self):
        super().__init__("openai", "OpenAI DALL-E")

    def generate(self, prompt: str, api_key: str) -> Optional[str]:
        if not api_key:
            return None
        from openai import OpenAI
        client = OpenAI(api_key=api_key)
        res = client.images.generate(
            model="dall-e-3",
            prompt=prompt,
            n=1,
            size="1024x1024"
        )
        if res.data and len(res.data) > 0:
            return res.data[0].url
        return None

class StabilityImageProvider(BaseImageProvider):
    def __init__(self):
        super().__init__("stability", "Stability AI")

    def generate(self, prompt: str, api_key: str) -> Optional[str]:
        if not api_key:
            return None
        url = "https://api.stability.ai/v1/generation/stable-diffusion-v1-6/text-to-image"
        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {api_key}"
        }
        body = {
            "text_prompts": [{"text": prompt}],
            "cfg_scale": 7,
            "height": 1024,
            "width": 1024,
            "samples": 1,
            "steps": 30,
        }
        res = requests.post(url, headers=headers, json=body, timeout=25)
        if res.status_code == 200:
            artifacts = res.json().get("artifacts", [])
            if artifacts:
                import base64
                img_bytes = base64.b64decode(artifacts[0].get("base64"))
                return upload_to_cloudinary(img_bytes, "images")
        return None

class ReplicateImageProvider(BaseImageProvider):
    def __init__(self):
        super().__init__("replicate", "Replicate SDXL")

    def generate(self, prompt: str, api_key: str) -> Optional[str]:
        if not api_key:
            return None
        import replicate
        os.environ["REPLICATE_API_TOKEN"] = api_key
        output = replicate.run(
            "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
            input={"prompt": prompt}
        )
        if output and isinstance(output, list) and len(output) > 0:
            return str(output[0])
        return None

class PollinationsFallbackProvider(BaseImageProvider):
    def __init__(self):
        super().__init__("pollinations", "Pollinations AI (High-Speed Baseline)")

    def generate(self, prompt: str, api_key: str) -> Optional[str]:
        import urllib.parse
        encoded_prompt = urllib.parse.quote(prompt.strip())
        seed = int(asyncio.get_event_loop().time() * 1000) % 1000000 if asyncio.get_event_loop().is_running() else 42
        return f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=1024&height=1024&nologo=true&seed={seed}&model=flux"

class ImageProviderManager:
    """Centralized Image Provider Manager with automatic fallback."""
    def __init__(self):
        self.providers: Dict[str, BaseImageProvider] = {
            "openai": OpenAIImageProvider(),
            "stability": StabilityImageProvider(),
            "replicate": ReplicateImageProvider(),
            "pollinations": PollinationsFallbackProvider()
        }

    def get_api_key(self, provider_id: str, keys: Dict[str, Optional[str]]) -> Optional[str]:
        if keys and keys.get(f"{provider_id}_key"):
            val = keys[f"{provider_id}_key"]
            if val and val.strip():
                return val.strip()

        env_vars = {
            "openai": ["OPENAI_API_KEY", "IMAGE_PROVIDER_KEY"],
            "stability": ["STABILITY_API_KEY", "IMAGE_PROVIDER_KEY"],
            "replicate": ["REPLICATE_API_KEY", "IMAGE_PROVIDER_KEY"]
        }.get(provider_id, [f"{provider_id.upper()}_API_KEY"])

        for var in env_vars:
            val = os.getenv(var)
            if val and val.strip():
                return val.strip()

        return None

    def generate_image_with_fallback(self, prompt: str, keys: Dict[str, Optional[str]]) -> str:
        order = ["openai", "stability", "replicate", "pollinations"]

        for provider_id in order:
            provider = self.providers.get(provider_id)
            if not provider:
                continue

            api_key = self.get_api_key(provider_id, keys)
            if not api_key and provider_id != "pollinations":
                continue

            logger.info(f"ImageProviderManager: Attempting image generation with provider={provider_id}")
            try:
                img_url = provider.generate(prompt, api_key or "")
                if img_url:
                    # Persist url to Cloudinary if it's external
                    if img_url.startswith("http") and "cloudinary.com" not in img_url:
                        try:
                            resp = requests.get(img_url, timeout=20)
                            if resp.status_code == 200:
                                return upload_to_cloudinary(resp.content, "images")
                        except Exception as upload_err:
                            logger.warning(f"Cloudinary upload fallback exception: {upload_err}")
                    return img_url
            except Exception as e:
                logger.warning(f"ImageProviderManager: provider={provider_id} failed: {e}")

        # Final baseline guarantee
        return self.providers["pollinations"].generate(prompt, "") or ""

image_provider_manager = ImageProviderManager()
