import os
import asyncio
import logging
import tempfile

# Must be set before any numpy/openblas import
os.environ['OPENBLAS_NUM_THREADS'] = '4'
os.environ['OMP_NUM_THREADS'] = '4'

# ── Structured logging ────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("quill_ai")

from contextlib import asynccontextmanager
from functools import partial
from typing import List

from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()

import uvicorn
from rag import process_document, query_rag, list_documents, delete_document, init_db

# ── Configuration from environment ───────────────────────────────────────────
# Comma-separated list of allowed origins, e.g.:
#   ALLOWED_ORIGINS=https://my-app.vercel.app,https://localhost:5173
# Defaults to "*" for local dev only — set a real value in production.
_raw_origins = os.environ.get("ALLOWED_ORIGINS", "*")
ALLOWED_ORIGINS: List[str] = [o.strip() for o in _raw_origins.split(",") if o.strip()]

# Max upload size in bytes (default 20 MB)
MAX_UPLOAD_BYTES = int(os.environ.get("MAX_UPLOAD_BYTES", str(20 * 1024 * 1024)))

ALLOWED_EXTENSIONS = (".pdf", ".docx", ".pptx", ".txt")


# ── Startup / shutdown lifespan ───────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Validate critical config and warm up ChromaDB on startup."""
    groq_key = os.environ.get("GROQ_API_KEY", "")
    if not groq_key:
        logger.error(
            "GROQ_API_KEY is not set. The /api/chat endpoint will fail. "
            "Set this environment variable before starting the server."
        )
    else:
        logger.info("GROQ_API_KEY is present — startup OK.")

    # Eagerly initialise the ChromaDB singleton so the first request isn't slow
    try:
        init_db()
        logger.info("ChromaDB initialised successfully.")
    except Exception as exc:
        logger.error("ChromaDB failed to initialise: %s", exc)

    yield  # ← server runs here

    logger.info("Quill AI backend shutting down.")


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Quill AI – RAG Backend",
    description="Retrieval-Augmented Generation API backed by ChromaDB + Groq.",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ─────────────────────────────────────────────────────────────────────
# allow_credentials=True requires an explicit origin list, never "*".
# For local dev (ALLOWED_ORIGINS="*") we disable credentials to stay spec-compliant.
_credential_safe = ALLOWED_ORIGINS != ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=_credential_safe,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)


# ── Pydantic models ───────────────────────────────────────────────────────────
class QueryRequest(BaseModel):
    query: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="The question to answer from uploaded documents.",
    )


# ── Health / liveness endpoints ───────────────────────────────────────────────
@app.get("/health", tags=["Health"])
@app.get("/api/health", tags=["Health"])
async def health():
    """Liveness probe — returns 200 immediately. Use this for uptime monitors."""
    return {"status": "ok"}


@app.get("/api/ping", tags=["Health"])
async def ping():
    """Lightweight ping — useful for keeping the backend warm."""
    return {"pong": True}


# ── Upload ────────────────────────────────────────────────────────────────────
@app.post("/api/upload", tags=["Documents"])
async def upload_files(files: List[UploadFile] = File(...)):
    results = []
    loop = asyncio.get_running_loop()  # get_event_loop() is deprecated in 3.10+

    for file in files:
        filename = file.filename or ""

        # Extension check
        if not filename.lower().endswith(ALLOWED_EXTENSIONS):
            logger.warning("Rejected unsupported file type: %s", filename)
            results.append({
                "filename": filename,
                "status": "error",
                "message": f"Unsupported file type. Allowed: {ALLOWED_EXTENSIONS}",
            })
            continue

        # Read content once — enforce size limit before hitting disk
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

        # Write to a proper temp file (auto-cleaned by OS; suffix preserves extension for loaders)
        ext = os.path.splitext(filename)[1].lower()
        try:
            with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
                tmp.write(content)
                temp_path = tmp.name

            logger.info("Processing %s (%d bytes) via temp file %s", filename, len(content), temp_path)
            # Run CPU-heavy processing off the event loop thread
            await loop.run_in_executor(None, partial(process_document, temp_path, filename))
            results.append({"filename": filename, "status": "success"})
            logger.info("Successfully ingested: %s", filename)
        except Exception as exc:
            logger.error("Error processing %s: %s", filename, exc)
            results.append({"filename": filename, "status": "error", "message": str(exc)})
        finally:
            # Always clean up the temp file
            try:
                if os.path.exists(temp_path):
                    os.remove(temp_path)
            except Exception:
                pass

    return {"results": results}


# ── Chat ──────────────────────────────────────────────────────────────────────
@app.post("/api/chat", tags=["Chat"])
async def chat(request: QueryRequest):
    logger.info("Chat query received (len=%d)", len(request.query))
    try:
        loop = asyncio.get_running_loop()
        response = await loop.run_in_executor(None, partial(query_rag, request.query))
        return response
    except Exception as exc:
        logger.error("Chat endpoint error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


# ── Documents ─────────────────────────────────────────────────────────────────
@app.get("/api/documents", tags=["Documents"])
async def get_documents():
    docs = list_documents()
    return {"documents": docs}


@app.delete("/api/documents/{filename}", tags=["Documents"])
async def remove_document(filename: str):
    if not filename or not filename.strip():
        raise HTTPException(status_code=400, detail="Filename is required.")
    logger.info("Delete request for document: %s", filename)
    success = delete_document(filename)
    if success:
        logger.info("Deleted document: %s", filename)
        return {"status": "success", "message": f"Deleted {filename}"}
    raise HTTPException(status_code=404, detail="Document not found.")


# ── Dev entrypoint ────────────────────────────────────────────────────────────
if __name__ == "__main__":
    # reload=False avoids multiprocessing.spawn losing env vars (OpenBLAS WinError 1455)
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
