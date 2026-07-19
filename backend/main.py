import os
import asyncio
import logging
import tempfile
import time

os.environ['OPENBLAS_NUM_THREADS'] = '4'
os.environ['OMP_NUM_THREADS'] = '4'

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("quill_ai")

from contextlib import asynccontextmanager
from functools import partial
from typing import List, Optional

from fastapi import FastAPI, UploadFile, File, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()

import uvicorn
from backend.rag import (
    process_document,
    query_rag,
    list_documents,
    delete_document,
    clear_session,
    init_db,
)

_raw_origins = os.environ.get("ALLOWED_ORIGINS", "*")
ALLOWED_ORIGINS: List[str] = [o.strip() for o in _raw_origins.split(",") if o.strip()]

# Lowered from 20MB — on a resource-constrained trial plan, large PDFs turn
# into proportionally large embedding batches. Raise this via env var once
# you're on a plan with real headroom.
MAX_UPLOAD_BYTES = int(os.environ.get("MAX_UPLOAD_BYTES", str(8 * 1024 * 1024)))
ALLOWED_EXTENSIONS = (".pdf", ".docx", ".pptx", ".txt")

# Caps how many documents a single session can hold at once. Prevents one
# user (or one runaway retry loop) from filling up shared storage alone.
MAX_DOCS_PER_SESSION = int(os.environ.get("MAX_DOCS_PER_SESSION", "8"))

# How many documents can be embedded at the same time, across ALL users.
# Embedding is CPU/RAM heavy; without this, 5 people uploading at once could
# all spike memory simultaneously. Keep this low on small Railway instances.
MAX_CONCURRENT_UPLOADS = int(os.environ.get("MAX_CONCURRENT_UPLOADS", "2"))
_upload_semaphore = asyncio.Semaphore(MAX_CONCURRENT_UPLOADS)

# ── Idle-session tracking ──────────────────────────────────────────────────────
# In-memory map of session_id -> last-seen unix timestamp. Updated on every
# request that carries a session id. A background task periodically purges
# any session that's been quiet too long — this is the real safety net for
# users who close a tab without the sendBeacon cleanup call ever landing
# (common on mobile Safari / in-app browsers like LinkedIn's).
SESSION_LAST_SEEN: dict[str, float] = {}
SESSION_IDLE_TTL_SECONDS = int(os.environ.get("SESSION_IDLE_TTL_SECONDS", str(20 * 60)))  # 20 min
SESSION_SWEEP_INTERVAL_SECONDS = int(os.environ.get("SESSION_SWEEP_INTERVAL_SECONDS", str(5 * 60)))  # 5 min


async def _idle_session_sweeper():
    """Background loop: purge any session idle longer than the TTL."""
    while True:
        try:
            await asyncio.sleep(SESSION_SWEEP_INTERVAL_SECONDS)
            now = time.time()
            stale = [
                sid for sid, last_seen in list(SESSION_LAST_SEEN.items())
                if now - last_seen > SESSION_IDLE_TTL_SECONDS
            ]
            for sid in stale:
                removed = clear_session(sid)
                SESSION_LAST_SEEN.pop(sid, None)
                if removed:
                    logger.info("Idle sweep: purged session=%s chunks_removed=%d", sid, removed)
        except Exception as exc:
            logger.error("Idle session sweeper error: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    groq_key = os.environ.get("GROQ_API_KEY", "")
    if not groq_key:
        logger.error("GROQ_API_KEY is not set. The /api/chat endpoint will fail.")
    else:
        logger.info("GROQ_API_KEY is present — startup OK.")

    try:
        init_db()
        logger.info("ChromaDB initialised successfully.")
    except Exception as exc:
        logger.error("ChromaDB failed to initialise: %s", exc)

    sweep_task = asyncio.create_task(_idle_session_sweeper())
    logger.info(
        "Idle-session sweeper started (ttl=%ds, interval=%ds).",
        SESSION_IDLE_TTL_SECONDS, SESSION_SWEEP_INTERVAL_SECONDS,
    )

    yield

    sweep_task.cancel()
    logger.info("Quill AI backend shutting down.")


app = FastAPI(
    title="Quill AI – RAG Backend",
    description="Retrieval-Augmented Generation API backed by ChromaDB + Groq.",
    version="1.0.0",
    lifespan=lifespan,
)

_credential_safe = ALLOWED_ORIGINS != ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=_credential_safe,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Session-Id"],
)


class QueryRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)


# ── Session helper ─────────────────────────────────────────────────────────────
def get_session_id(x_session_id: Optional[str] = Header(default=None)) -> str:
    session_id = x_session_id or "default"
    if session_id != "default":
        SESSION_LAST_SEEN[session_id] = time.time()
    return session_id


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
@app.get("/api/health", tags=["Health"])
async def health():
    return {"status": "ok"}


@app.get("/api/ping", tags=["Health"])
async def ping():
    return {"pong": True}


# ── Upload ────────────────────────────────────────────────────────────────────
@app.post("/api/upload", tags=["Documents"])
async def upload_files(
    files: List[UploadFile] = File(...),
    x_session_id: Optional[str] = Header(default=None),
):
    session_id = get_session_id(x_session_id)
    results = []
    loop = asyncio.get_running_loop()

    # Enforce per-session document cap before doing any heavy work.
    existing_docs = list_documents(session_id)
    slots_left = max(0, MAX_DOCS_PER_SESSION - len(existing_docs))

    for i, file in enumerate(files):
        filename = file.filename or ""

        if i >= slots_left:
            logger.warning(
                "Rejected %s — session %s already at document cap (%d).",
                filename, session_id, MAX_DOCS_PER_SESSION,
            )
            results.append({
                "filename": filename,
                "status": "error",
                "message": (
                    f"You've reached the limit of {MAX_DOCS_PER_SESSION} documents per "
                    f"session. Delete an existing document before uploading more."
                ),
            })
            continue

        if not filename.lower().endswith(ALLOWED_EXTENSIONS):
            logger.warning("Rejected unsupported file type: %s", filename)
            results.append({
                "filename": filename,
                "status": "error",
                "message": f"Unsupported file type. Allowed: {ALLOWED_EXTENSIONS}",
            })
            continue

        try:
            content = await file.read()
        except Exception as exc:
            logger.error("Failed to read uploaded file %s: %s", filename, exc)
            results.append({"filename": filename, "status": "error", "message": "Failed to read file."})
            continue

        if len(content) > MAX_UPLOAD_BYTES:
            max_mb = MAX_UPLOAD_BYTES / (1024 * 1024)
            logger.warning("Rejected oversized file %s (%d bytes)", filename, len(content))
            results.append({
                "filename": filename,
                "status": "error",
                "message": f"File exceeds maximum allowed size of {max_mb:.0f} MB.",
            })
            continue

        ext = os.path.splitext(filename)[1].lower()
        temp_path = None
        try:
            with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
                tmp.write(content)
                temp_path = tmp.name

            logger.info("Processing %s (%d bytes) via temp file %s", filename, len(content), temp_path)

            # Bound how many documents are being embedded at once, across
            # every user hitting this backend concurrently.
            async with _upload_semaphore:
                await loop.run_in_executor(
                    None, partial(process_document, temp_path, filename, session_id)
                )
            results.append({"filename": filename, "status": "success"})
            logger.info("Successfully ingested: %s", filename)
        except Exception as exc:
            logger.error("Error processing %s: %s", filename, exc)
            results.append({"filename": filename, "status": "error", "message": str(exc)})
        finally:
            try:
                if temp_path and os.path.exists(temp_path):
                    os.remove(temp_path)
            except Exception:
                pass

    return {"results": results}


# ── Chat ──────────────────────────────────────────────────────────────────────
@app.post("/api/chat", tags=["Chat"])
async def chat(request: QueryRequest, x_session_id: Optional[str] = Header(default=None)):
    session_id = get_session_id(x_session_id)
    logger.info("Chat query received (len=%d, session=%s)", len(request.query), session_id)
    try:
        loop = asyncio.get_running_loop()
        response = await loop.run_in_executor(None, partial(query_rag, request.query, session_id))
        return response
    except Exception as exc:
        logger.error("Chat endpoint error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


# ── Documents ─────────────────────────────────────────────────────────────────
@app.get("/api/documents", tags=["Documents"])
async def get_documents(x_session_id: Optional[str] = Header(default=None)):
    session_id = get_session_id(x_session_id)
    docs = list_documents(session_id)
    return {"documents": docs, "limit": MAX_DOCS_PER_SESSION}


@app.delete("/api/documents/{filename}", tags=["Documents"])
async def remove_document(filename: str, x_session_id: Optional[str] = Header(default=None)):
    session_id = get_session_id(x_session_id)
    if not filename or not filename.strip():
        raise HTTPException(status_code=400, detail="Filename is required.")
    logger.info("Delete request for document: %s (session=%s)", filename, session_id)
    success = delete_document(filename, session_id)
    if success:
        logger.info("Deleted document: %s", filename)
        return {"status": "success", "message": f"Deleted {filename}"}
    raise HTTPException(status_code=404, detail="Document not found.")


# ── Session cleanup ───────────────────────────────────────────────────────────
@app.delete("/api/session", tags=["Session"])
async def clear_session_endpoint(x_session_id: Optional[str] = Header(default=None)):
    session_id = get_session_id(x_session_id)
    if session_id == "default":
        raise HTTPException(status_code=400, detail="No session id provided.")
    removed = clear_session(session_id)
    SESSION_LAST_SEEN.pop(session_id, None)
    logger.info("Session cleared: session=%s chunks_removed=%d", session_id, removed)
    return {"status": "success", "chunks_removed": removed}


# ── Beacon-based cleanup for tab-close ─────────────────────────────────────────
class SessionBeaconRequest(BaseModel):
    session_id: str = Field(..., min_length=1)


@app.post("/api/session/beacon-clear", tags=["Session"])
async def clear_session_beacon(request: SessionBeaconRequest):
    removed = clear_session(request.session_id)
    SESSION_LAST_SEEN.pop(request.session_id, None)
    logger.info("Session cleared via beacon: session=%s chunks_removed=%d", request.session_id, removed)
    return {"status": "success", "chunks_removed": removed}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
