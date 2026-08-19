import logging
import os
from dotenv import load_dotenv
load_dotenv()

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.config import settings
from app.db.postgres import Base, engine
from app.api.v1 import auth, chat, upload, production, profile, doc_chat, image_edit
from app.logging_config import logger

# Initialize logging
logging.basicConfig(level=logging.INFO)
app_logger = logging.getLogger(__name__)

# Database initialization
try:
    app_logger.info("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    app_logger.info("Database tables created successfully")
except Exception as e:
    app_logger.error(f"Failed to create database tables: {e}")
    raise


# Lifespan context manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        app_logger.info(f"Starting {settings.PROJECT_NAME} API server...")
        app_logger.info(f"Project: {settings.PROJECT_NAME}")
        yield
    except Exception as e:
        app_logger.error(f"Error during startup: {e}")
        raise
    finally:
        app_logger.info(f"Shutting down {settings.PROJECT_NAME} API server...")
        try:
            app_logger.info("Cleanup completed successfully")
        except Exception as e:
            app_logger.error(f"Error during shutdown: {e}")


# FastAPI app
app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS FIX
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # open for testing
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Error handlers
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    app_logger.warning(f"Validation error on {request.url.path}: {exc}")
    return JSONResponse(
        status_code=422,
        content={"detail": "Validation error", "errors": str(exc)},
    )

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    app_logger.error(f"Unhandled exception on {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )

# Static uploads
if os.getenv("VERCEL"):
    uploads_dir = "/tmp/uploads"
else:
    uploads_dir = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "uploads")
    )

os.makedirs(uploads_dir, exist_ok=True)

app.mount(
    "/uploads",
    StaticFiles(directory=uploads_dir),
    name="uploads"
)

app_logger.info(f"Static files mounted at /uploads: {uploads_dir}")

# Routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(profile.router, prefix=settings.API_V1_STR)
app.include_router(chat.router, prefix=settings.API_V1_STR)
app.include_router(upload.router, prefix=settings.API_V1_STR)
app.include_router(doc_chat.router, prefix=settings.API_V1_STR)
app.include_router(image_edit.router, prefix=settings.API_V1_STR)

# Production routes
app.include_router(production.router)


@app.get("/")
def read_root():
    return {
        "status": "online",
        "project": settings.PROJECT_NAME,
        "api_docs": "/docs"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": "1.0.0"
    }