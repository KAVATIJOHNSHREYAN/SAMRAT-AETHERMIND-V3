import logging
import logging.handlers
import os
from pathlib import Path

def setup_logging():
    """Configure logging for the application."""
    # Get log level from environment
    log_level = os.getenv("LOG_LEVEL", "INFO")

    # Create logger
    logger = logging.getLogger()
    logger.setLevel(getattr(logging, log_level))

    # Define log format
    log_format = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(getattr(logging, log_level))
    console_handler.setFormatter(log_format)
    logger.addHandler(console_handler)

    # Skip file logging on Vercel/read-only systems
    if not os.getenv("VERCEL"):
        try:
            # Create logs directory if it doesn't exist
            log_dir = Path("logs")
            log_dir.mkdir(exist_ok=True)

            # File handler with rotation
            file_handler = logging.handlers.RotatingFileHandler(
                filename=log_dir / "app.log",
                maxBytes=10 * 1024 * 1024,  # 10 MB
                backupCount=10
            )
            file_handler.setLevel(logging.DEBUG)
            file_handler.setFormatter(log_format)
            logger.addHandler(file_handler)

            # Error file handler
            error_handler = logging.handlers.RotatingFileHandler(
                filename=log_dir / "errors.log",
                maxBytes=10 * 1024 * 1024,
                backupCount=5
            )
            error_handler.setLevel(logging.ERROR)
            error_handler.setFormatter(log_format)
            logger.addHandler(error_handler)
        except Exception as e:
            # Fallback if writing fails
            logger.warning(f"Could not initialize file logging: {e}")

    return logger

# Configure logging on import
logger = setup_logging()

