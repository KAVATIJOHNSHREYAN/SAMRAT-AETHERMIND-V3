import os
import time
import base64
import requests
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.api.v1.auth import get_current_user
from app.db.models import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/image-edit", tags=["image-edit"])

class ImageEditRequest(BaseModel):
    image: str  # Base64 string or Data URI
    mask: Optional[str] = None  # Optional Base64 string for inpainting
    prompt: Optional[str] = None  # Text prompt for replace_bg, inpaint, outpaint
    tool: str  # "remove_bg", "replace_bg", "inpaint", "outpaint", "upscale", "face_enhance"
    replicate_key: Optional[str] = None

def ensure_data_uri(b64_str: str) -> str:
    """Format string as correct data URI if it isn't already."""
    if not b64_str:
        return ""
    if b64_str.startswith("data:"):
        return b64_str
    # Default to PNG if raw base64
    return f"data:image/png;base64,{b64_str}"

def run_replicate_prediction(version_id: str, inputs: dict, api_key: str) -> str:
    """Run a replicate prediction and poll for completion."""
    url = "https://api.replicate.com/v1/predictions"
    headers = {
        "Authorization": f"Token {api_key}",
        "Content-Type": "application/json"
    }
    data = {
        "version": version_id,
        "input": inputs
    }
    
    logger.info(f"Triggering Replicate model version: {version_id}")
    res = requests.post(url, json=data, headers=headers, timeout=15)
    if res.status_code != 201:
        error_msg = res.json().get("detail", res.text)
        raise HTTPException(status_code=500, detail=f"Replicate API initialization failed: {error_msg}")
        
    prediction = res.json()
    prediction_id = prediction["id"]
    poll_url = f"https://api.replicate.com/v1/predictions/{prediction_id}"
    
    # Poll for up to 60 seconds
    for _ in range(30):
        poll_res = requests.get(poll_url, headers=headers, timeout=5)
        if poll_res.status_code == 200:
            result = poll_res.json()
            status = result.get("status")
            if status == "succeeded":
                output = result.get("output")
                if isinstance(output, list) and len(output) > 0:
                    return output[0]
                return str(output)
            elif status in ["failed", "canceled"]:
                error_detail = result.get("error", "Unknown prediction failure")
                raise HTTPException(status_code=500, detail=f"Replicate prediction {status}: {error_detail}")
        time.sleep(2)
        
    raise HTTPException(status_code=504, detail="Replicate prediction timed out")

@router.post("/process")
def process_image_edit(payload: ImageEditRequest, current_user: User = Depends(get_current_user)):
    effective_key = payload.replicate_key or os.getenv("REPLICATE_API_KEY")
    
    # Clean up base64 image strings
    clean_image = ensure_data_uri(payload.image)
    clean_mask = ensure_data_uri(payload.mask) if payload.mask else None
    
    # 1. REMOVE BACKGROUND
    if payload.tool == "remove_bg":
        if not effective_key:
            # Fallback mock: Return a public transparent background image representation
            return {"output_url": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=600", "message": "Keyless Simulation Mode: Returning sample portrait."}
        
        # lucataco/remove-bg
        version = "95a68c0b5f121e428416ca23cb6e174c86b2450ad5c0a373977efebaa8fbf3ef"
        res_url = run_replicate_prediction(version, {"image": clean_image}, effective_key)
        return {"output_url": res_url}
        
    # 2. REPLACE BACKGROUND
    elif payload.tool == "replace_bg":
        if not effective_key:
            # Fallback mock: Return a scenic background fallback
            return {"output_url": "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&q=80&w=800", "message": "Keyless Simulation Mode: Returning landscape background replace."}
            
        # replace background using replicate model
        # lucataco/background-removal-and-replacement or similar
        version = "8e95089e909569ed9ccde645479cb2566ec48fc4d1b827e8d08cb5f69be8489e"
        inputs = {
            "image": clean_image,
            "prompt": payload.prompt or "on a tropical beach at sunset, cinematic lighting"
        }
        res_url = run_replicate_prediction(version, inputs, effective_key)
        return {"output_url": res_url}
        
    # 3. INPAINTING
    elif payload.tool == "inpaint":
        if not effective_key:
            return {"output_url": clean_image, "message": "Keyless Simulation Mode: Inpaint requires Replicate Key."}
            
        if not clean_mask:
            raise HTTPException(status_code=400, detail="Mask image is required for inpainting")
            
        # stability-ai/sdxl-inpainting
        version = "50c2a74cbeac37482329b533e4f3a763806f1eb1752b0cd26f634585ec8fc9c4"
        inputs = {
            "image": clean_image,
            "mask": clean_mask,
            "prompt": payload.prompt or "wearing futuristic sunglasses",
            "negative_prompt": "blurry, low quality"
        }
        res_url = run_replicate_prediction(version, inputs, effective_key)
        return {"output_url": res_url}
        
    # 4. OUTPAINTING
    elif payload.tool == "outpaint":
        if not effective_key:
            return {"output_url": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=1000", "message": "Keyless Simulation Mode: Returning expanded shoreline sample."}
            
        # stability-ai/sdxl
        version = "7762fd07cf8d330c50b69a924449d657b98a32347b59496bfa2010839e2467d0"
        inputs = {
            "image": clean_image,
            "prompt": payload.prompt or "extend the landscape panorama, detailed nature background",
            "width": 1024,
            "height": 768
        }
        res_url = run_replicate_prediction(version, inputs, effective_key)
        return {"output_url": res_url}
        
    # 5. UPSCALE
    elif payload.tool == "upscale":
        if not effective_key:
            return {"output_url": clean_image, "message": "Keyless Simulation Mode: Upscale simulation complete."}
            
        # nightmareai/real-esrgan
        version = "42fed1c4974175853dcd5b11c297d31fe0e7b4122c9e782620584b4cf959cfcf"
        inputs = {
            "image": clean_image,
            "scale": 2,
            "face_enhance": True
        }
        res_url = run_replicate_prediction(version, inputs, effective_key)
        return {"output_url": res_url}
        
    # 6. FACE ENHANCEMENT
    elif payload.tool == "face_enhance":
        if not effective_key:
            return {"output_url": clean_image, "message": "Keyless Simulation Mode: Face enhancement complete."}
            
        # tencentarc/gfpgan
        version = "928360859063d2b77af57b2822a165b4d4b5d23d73c2ff406b03757786f952f4"
        inputs = {
            "img": clean_image,
            "version": "1.4",
            "scale": 2
        }
        res_url = run_replicate_prediction(version, inputs, effective_key)
        return {"output_url": res_url}
        
    else:
        raise HTTPException(status_code=400, detail="Invalid tool parameter selected")
