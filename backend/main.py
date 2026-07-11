import os
import asyncio
import uuid
from functools import partial

# Set thread counts to '4' to utilize CPU cores for fast embeddings
# while keeping resource consumption balanced.
os.environ['OPENBLAS_NUM_THREADS'] = '4'
os.environ['OMP_NUM_THREADS'] = '4'
# while keeping resource consumption balanced.
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
load_dotenv()
from typing import List
import uvicorn

from rag import process_document, query_rag, list_documents, delete_document

app = FastAPI(title="RAG Web Application")

# Allow all for now during dev companion
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class QueryRequest(BaseModel):
    query: str

@app.post("/api/upload")
async def upload_files(files: List[UploadFile] = File(...)):
    results = []
    allowed_extensions = (".pdf", ".docx", ".pptx", ".txt")
    loop = asyncio.get_event_loop()

    for file in files:
        if not file.filename.lower().endswith(allowed_extensions):
            results.append({"filename": file.filename, "status": "error", "message": f"Unsupported file type. Allowed: {allowed_extensions}"})
            continue
        
        # Use a unique temp filename to avoid collisions
        unique_id = uuid.uuid4().hex[:8]
        temp_path = f"temp_{unique_id}_{file.filename}"
        try:
            content = await file.read()
            with open(temp_path, "wb") as f:
                f.write(content)
            
            # Run CPU-heavy process_document in a thread pool so we don't block the event loop
            await loop.run_in_executor(None, partial(process_document, temp_path, file.filename))
            results.append({"filename": file.filename, "status": "success"})
        except Exception as e:
            results.append({"filename": file.filename, "status": "error", "message": str(e)})
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)
    
    return {"results": results}

@app.post("/api/chat")
async def chat(request: QueryRequest):
    try:
        loop = asyncio.get_event_loop()
        # Also run query_rag in thread pool
        #— it's CPU-heavy too
        response = await loop.run_in_executor(None, partial(query_rag, request.query))
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/documents")
async def get_documents():
    docs = list_documents()
    return {"documents": docs}


@app.delete("/api/documents/{filename}")
async def remove_document(filename: str):
    if not filename:
        raise HTTPException(status_code=400, detail="Filename required")
    success = delete_document(filename)
    if success:
        return {"status": "success", "message": f"Deleted {filename}"}
    raise HTTPException(status_code=404, detail="Document not found")

if __name__ == "__main__":
    # reload=False avoids multiprocessing.spawn forking a subprocess that
    # loses the env vars above and crashes with OpenBLAS WinError 1455
    #clear response
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
