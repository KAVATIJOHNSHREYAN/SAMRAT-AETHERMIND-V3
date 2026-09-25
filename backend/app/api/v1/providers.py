from fastapi import APIRouter, Depends
from app.services.provider_registry import provider_registry

router = APIRouter(prefix="/providers", tags=["providers"])

@router.get("")
@router.get("/")
def get_provider_health():
    """Returns server-side discovered AI providers, connection health, and diagnostics."""
    return provider_registry.discover_providers(force_refresh=False)

@router.post("/refresh")
def refresh_provider_health():
    """Forces a fresh scan of server-side environment variables and updates provider health cache."""
    return provider_registry.discover_providers(force_refresh=True)
