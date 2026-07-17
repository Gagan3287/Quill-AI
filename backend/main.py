import os
import asyncio
import logging
import tempfile

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

MAX_UPLOAD_BYTES = int(os.environ.get("MAX_UPLOAD_BYTES", str(20 * 1024 * 1024)))
ALLOWED_EXTENSIONS = (".pdf", ".docx", ".pptx", ".txt")


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

    yield

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
# Every request that touches documents must carry X-Session-Id (set by the
# frontend once per browser tab, see api.js). Falling back to "default" keeps
# old clients working, but every NEW client always sends a real id.
def get_session_id(x_session_id: Optional[str] = Header(default=None)) -> str:
    return x_session_id or "default"


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

    for file in files:
        filename = file.filename or ""

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
    return {"documents": docs}


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
# Called on sign-out (and via sendBeacon on tab close for guests) to free
# ChromaDB/RAM immediately instead of leaking documents forever.
@app.delete("/api/session", tags=["Session"])
async def clear_session_endpoint(x_session_id: Optional[str] = Header(default=None)):
    session_id = get_session_id(x_session_id)
    if session_id == "default":
        # Refuse to nuke the shared fallback bucket via this route.
        raise HTTPException(status_code=400, detail="No session id provided.")
    removed = clear_session(session_id)
    logger.info("Session cleared: session=%s chunks_removed=%d", session_id, removed)
    return {"status": "success", "chunks_removed": removed}


# ── Beacon-based cleanup for tab-close (no custom headers allowed here) ───────
# navigator.sendBeacon can only POST and can't set X-Session-Id, so the
# session id travels in the JSON body instead for this one route.
class SessionBeaconRequest(BaseModel):
    session_id: str = Field(..., min_length=1)


@app.post("/api/session/beacon-clear", tags=["Session"])
async def clear_session_beacon(request: SessionBeaconRequest):
    removed = clear_session(request.session_id)
    logger.info("Session cleared via beacon: session=%s chunks_removed=%d", request.session_id, removed)
    return {"status": "success", "chunks_removed": removed}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)


