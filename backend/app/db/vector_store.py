import os
import json
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime

logger = logging.getLogger(__name__)

# Fallback storage for when no vector DB is available
if os.getenv("VERCEL"):
    FALLBACK_STORE_FILE = "/tmp/documents_store.json"
else:
    FALLBACK_STORE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "documents_store.json")

class Document:
    """Represents a document with content and metadata."""
    def __init__(self, page_content: str, metadata: dict = None):
        self.page_content = page_content
        self.metadata = metadata or {}

def _get_fallback_store() -> List[Dict[str, Any]]:
    """Load documents from fallback JSON store."""
    if os.path.exists(FALLBACK_STORE_FILE):
        try:
            with open(FALLBACK_STORE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error loading fallback store: {e}")
    return []

def _save_fallback_store(store: List[Dict[str, Any]]):
    """Save documents to fallback JSON store."""
    try:
        os.makedirs(os.path.dirname(FALLBACK_STORE_FILE), exist_ok=True)
        with open(FALLBACK_STORE_FILE, "w", encoding="utf-8") as f:
            json.dump(store, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"Error saving fallback store: {e}")

def get_embedding(text: str, api_key: Optional[str] = None) -> Optional[List[float]]:
    """
    Generate embeddings using Google Generative AI.

    Args:
        text: Text to embed
        api_key: Optional API key (uses env variable if not provided)

    Returns:
        List of floats representing embeddings, or None on error
    """
    try:
        key = api_key or os.getenv("GOOGLE_GENAI_API_KEY")
        if not key:
            logger.warning("No GOOGLE_GENAI_API_KEY provided for embeddings")
            return None

        from google import genai
        client = genai.Client(api_key=key)
        result = client.models.embed_content(
            model="text-embedding-004",
            contents=text
        )
        # Handle new SDK response format which wraps embeddings in a list
        if result.embeddings:
            return result.embeddings[0].values
        return None

    except Exception as e:
        logger.error(f"Error generating embeddings: {e}")
        return None

def _cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """Calculate cosine similarity between two vectors."""
    if not vec1 or not vec2:
        return 0.0

    dot_product = sum(a * b for a, b in zip(vec1, vec2))
    norm1 = sum(a ** 2 for a in vec1) ** 0.5
    norm2 = sum(b ** 2 for b in vec2) ** 0.5

    if norm1 == 0 or norm2 == 0:
        return 0.0

    return dot_product / (norm1 * norm2)

def add_documents_to_vector_store(
    texts: List[str],
    metadatas: List[dict] = None,
    api_key: str = None,
    user_id: Optional[str] = None
):
    """
    Add documents to the vector store.
    Uses Google Generative AI embeddings and fallback JSON storage.

    Args:
        texts: List of text strings to add
        metadatas: Optional list of metadata dicts for each text
        api_key: Optional API key for embeddings
        user_id: User ID for organizing documents
    """
    if not texts:
        logger.warning("No texts provided to add to vector store")
        return

    store = _get_fallback_store()

    for idx, text in enumerate(texts):
        if not text.strip():
            logger.warning(f"Skipping empty text at index {idx}")
            continue

        metadata = metadatas[idx] if metadatas and idx < len(metadatas) else {}
        if user_id:
            metadata["user_id"] = user_id

        # Try to get embedding
        embedding = get_embedding(text, api_key)

        doc_entry = {
            "id": f"{datetime.now().timestamp()}_{idx}",
            "page_content": text,
            "metadata": metadata,
            "embedding": embedding  # May be None if API fails
        }
        store.append(doc_entry)

    _save_fallback_store(store)
    logger.info(f"Added {len(texts)} documents to vector store")

def similarity_search(
    query: str,
    k: int = 3,
    api_key: str = None,
    user_id: Optional[str] = None
) -> List[Document]:
    """
    Search for documents similar to the query.
    Uses vector similarity when embeddings available, falls back to keyword search.

    Args:
        query: Search query string
        k: Number of results to return
        api_key: Optional API key for query embeddings
        user_id: Optional user ID to filter results

    Returns:
        List of Document objects with matching content
    """
    store = _get_fallback_store()

    if not store:
        logger.debug("Vector store is empty")
        return []

    # Filter by user if specified
    if user_id:
        store = [doc for doc in store if doc.get("metadata", {}).get("user_id") == user_id]

    if not store:
        logger.debug(f"No documents found for user {user_id}")
        return []

    results = []

    # Try vector similarity search
    query_embedding = get_embedding(query, api_key)

    if query_embedding:
        # Score all documents by vector similarity
        scored_docs = []
        for doc in store:
            if doc.get("embedding"):
                similarity = _cosine_similarity(query_embedding, doc["embedding"])
                scored_docs.append((similarity, doc))

        if scored_docs:
            # Sort by similarity (descending) and take top k
            scored_docs.sort(key=lambda x: x[0], reverse=True)
            results = [
                Document(doc["page_content"], doc["metadata"])
                for _, doc in scored_docs[:k]
            ]
            logger.debug(f"Vector search found {len(results)} results")
            return results

    # Fallback: keyword search
    logger.debug("Using keyword search fallback")
    query_tokens = set(query.lower().split())
    scored_docs = []

    for doc in store:
        content = doc.get("page_content", "").lower()
        # Count matching tokens
        matches = sum(1 for token in query_tokens if token in content)
        if matches > 0:
            scored_docs.append((matches, doc))

    scored_docs.sort(key=lambda x: x[0], reverse=True)
    results = [
        Document(doc["page_content"], doc["metadata"])
        for _, doc in scored_docs[:k]
    ]

    logger.info(f"Keyword search found {len(results)} results for '{query}'")
    return results

