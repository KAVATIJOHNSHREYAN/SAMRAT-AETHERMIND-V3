import os
import time
import requests
import urllib.parse
import logging
import asyncio
from typing import Optional
from app.config import settings

logger = logging.getLogger(__name__)

def generate_image(prompt: str, openai_key: str = None) -> str:
    """
    Generate image using OpenAI DALL-E 3 if key is present,
    otherwise fallback to Pollinations.ai (Free Keyless Tier).
    """
    effective_openai_key = openai_key or settings.OPENAI_API_KEY or None
    if effective_openai_key:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=effective_openai_key)
            response = client.images.generate(
                model="dall-e-3",
                prompt=prompt,
                n=1,
                size="1024x1024"
            )
            image_url = response.data[0].url
            if image_url:
                logger.info(f"Generated image with DALL-E 3")
                return image_url
        except Exception as e:
            logger.warning(f"DALL-E 3 generation failed: {e}. Falling back to Pollinations.ai.")

    # Fallback / Free tier Pollinations.ai image generator
    encoded_prompt = urllib.parse.quote(prompt)
    # Append random salt to avoid caching and ensure fresh generation
    salt = int(time.time())
    image_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=1024&height=1024&nologo=true&seed={salt}"
    logger.info(f"Generated image with Pollinations.ai (fallback)")
    return image_url

def generate_video(prompt: str, replicate_key: str = None) -> str:
    """
    Generate video using Replicate (animatediff or similar models) if token is present,
    otherwise returns a beautifully styled fallback simulation warning video.
    """
    effective_replicate_key = replicate_key or settings.REPLICATE_API_KEY or None
    if not effective_replicate_key:
        logger.warning("No Replicate API key provided, using fallback video URL")
        return "https://assets.mixkit.co/videos/preview/mixkit-stars-in-space-background-1611-large.mp4"

    try:
        # Replicate text-to-video (lucataco/animatediff)
        version_id = "11932140be1529d89260d2b1f8e8b61582e75cb7b77ab2765355653457d38392"
        url = "https://api.replicate.com/v1/predictions"
        headers = {
            "Authorization": f"Token {effective_replicate_key}",
            "Content-Type": "application/json"
        }
        data = {
            "version": version_id,
            "input": {
                "prompt": prompt,
                "n_frames": 16,
                "guidance_scale": 7.5
            }
        }
        res = requests.post(url, json=data, headers=headers, timeout=12)
        if res.status_code == 201:
            prediction = res.json()
            prediction_id = prediction["id"]
            poll_url = f"https://api.replicate.com/v1/predictions/{prediction_id}"
            
            logger.info(f"Started video generation with prediction ID: {prediction_id}")
            
            # Poll up to 60 seconds
            for _ in range(30):
                poll_res = requests.get(poll_url, headers=headers, timeout=5)
                if poll_res.status_code == 200:
                    result = poll_res.json()
                    status = result.get("status")
                    if status == "succeeded":
                        output = result.get("output")
                        logger.info(f"Video generation succeeded")
                        if isinstance(output, list) and len(output) > 0:
                            return output[0]
                        return str(output)
                    elif status in ["failed", "canceled"]:
                        logger.error(f"Video generation {status}")
                        break
                time.sleep(2)
    except Exception as e:
        logger.error(f"Replicate video API failure: {e}")
    
    logger.warning("Video generation failed, using fallback video URL")
    return "https://assets.mixkit.co/videos/preview/mixkit-stars-in-space-background-1611-large.mp4"

def swap_faces(source_image_base64: str, target_image_prompt: str, replicate_key: str = None) -> str:
    """
    Swap faces: generates a base target scene using image generator,
    then calls Replicate's faceswap to place the user's face into it.
    """
    # 1. Generate target image scene
    # We use Pollinations to create the scene prompt
    scene_url = generate_image(target_image_prompt)
    
    effective_replicate_key = replicate_key or settings.REPLICATE_API_KEY or None
    if not effective_replicate_key:
        # If no key, we cannot run faceswap. Return the base scene image as a fallback
        logger.warning("No Replicate key for face swap, returning base scene image")
        return scene_url

    try:
        # We need to upload the user's base64 face to a temporary image URL or pass it directly.
        # Replicate's faceswap model accepts URL or data URIs.
        # lucataco/faceswap version:
        version_id = "9a42301c4e1031a1007fd99414b0e35e4526d7f4be0880b9911e3b0d2d3127fc"
        url = "https://api.replicate.com/v1/predictions"
        headers = {
            "Authorization": f"Token {effective_replicate_key}",
            "Content-Type": "application/json"
        }
        
        # Ensure correct base64 data URI format
        if not source_image_base64.startswith("data:"):
            source_image_base64 = f"data:image/jpeg;base64,{source_image_base64}"
            
        data = {
            "version": version_id,
            "input": {
                "target_image": scene_url,
                "swap_image": source_image_base64
            }
        }
        res = requests.post(url, json=data, headers=headers, timeout=12)
        if res.status_code == 201:
            prediction = res.json()
            prediction_id = prediction["id"]
            poll_url = f"https://api.replicate.com/v1/predictions/{prediction_id}"
            
            logger.info(f"Started face swap with prediction ID: {prediction_id}")
            
            for _ in range(30):
                poll_res = requests.get(poll_url, headers=headers, timeout=5)
                if poll_res.status_code == 200:
                    result = poll_res.json()
                    status = result.get("status")
                    if status == "succeeded":
                        logger.info(f"Face swap succeeded")
                        return result.get("output", "")
                    elif status in ["failed", "canceled"]:
                        logger.error(f"Face swap {status}")
                        break
                time.sleep(2)
    except Exception as e:
        logger.error(f"Replicate face swap error: {e}")
        
    return scene_url


# Async wrappers for use with asyncio
async def generate_image_async(prompt: str, openai_key: str = None) -> str:
    """Async wrapper for generate_image."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, generate_image, prompt, openai_key)


async def generate_video_async(prompt: str, replicate_key: str = None) -> str:
    """Async wrapper for generate_video."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, generate_video, prompt, replicate_key)


async def swap_faces_async(source_image_base64: str, target_image_prompt: str, replicate_key: str = None) -> str:
    """Async wrapper for swap_faces."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, swap_faces, source_image_base64, target_image_prompt, replicate_key)

