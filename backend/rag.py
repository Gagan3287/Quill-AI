import os
import logging

# Must be set before any numpy/openblas import
os.environ['OPENBLAS_NUM_THREADS'] = '4'
os.environ['OMP_NUM_THREADS'] = '4'

from langchain_community.document_loaders import PyPDFium2Loader, Docx2txtLoader, TextLoader
from langchain_core.documents import Document
from pptx import Presentation
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("quill_ai.rag")

# ── ChromaDB path ─────────────────────────────────────────────────────────────---
CHROMA_PATH = os.environ.get("CHROMA_PATH", "chroma_db")

# ── L2 distance threshold for all-MiniLM-L6-v2 ───────────────────────────────
# L2 distance range for this model is roughly 0.0 (identical) – 2.0 (unrelated).
# 1.5 keeps only genuinely relevant chunks; tune downward to tighten relevance.
SIMILARITY_THRESHOLD = float(os.environ.get("SIMILARITY_THRESHOLD", "1.5"))

# ── Embeddings (loaded once at module import) ─────────────────────────────────
logger.info("Loading HuggingFace embeddings model…")
embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
logger.info("Embeddings model loaded.")

# ── ChromaDB singleton ────────────────────────────────────────────────────────
# One connection for the lifetime of the process; thread-safe for concurrent reads.
_db: Chroma | None = None


def init_db() -> Chroma:
    """Create (or return) the ChromaDB singleton. Called once at startup."""
    global _db
    if _db is None:
        logger.info("Initialising ChromaDB at path: %s", CHROMA_PATH)
        _db = Chroma(persist_directory=CHROMA_PATH, embedding_function=embeddings)
        logger.info("ChromaDB ready.")
    return _db


def get_db() -> Chroma:
    """Return the ChromaDB singleton, initialising lazily if needed."""
    global _db
    if _db is None:
        init_db()
    return _db


# ── Document processing ───────────────────────────────────────────────────────
def process_document(filepath: str, filename: str) -> None:
    """Load a document, split into chunks, and add to ChromaDB."""
    logger.info("process_document: loading '%s' from '%s'", filename, filepath)

    if filename.lower().endswith(".pdf"):
        loader = PyPDFium2Loader(filepath)
        docs = loader.load()

    elif filename.lower().endswith(".docx"):
        loader = Docx2txtLoader(filepath)
        docs = loader.load()

    elif filename.lower().endswith(".txt"):
        loader = TextLoader(filepath, encoding="utf-8")
        docs = loader.load()

    elif filename.lower().endswith(".pptx"):
        # Use python-pptx directly — more reliable than UnstructuredPowerPointLoader
        prs = Presentation(filepath)
        docs = []
        for i, slide in enumerate(prs.slides):
            slide_lines = []
            for shape in slide.shapes:
                if shape.has_text_frame:
                    for para in shape.text_frame.paragraphs:
                        text = para.text.strip()
                        if text:
                            slide_lines.append(text)
            if slide_lines:
                docs.append(
                    Document(
                        page_content="\n".join(slide_lines),
                        metadata={"source": filepath, "page": i + 1},
                    )
                )
        if not docs:
            raise ValueError(
                "No readable text found in the PowerPoint file. "
                "Ensure the slides contain text content."
            )

    else:
        raise ValueError(f"Unsupported file type: {filename}")

    if not docs:
        raise ValueError(
            "No content could be extracted from the file. "
            "The file may be empty or corrupted."
        )

    # Tag every chunk with the original filename for retrieval
    for doc in docs:
        doc.metadata["source_file"] = filename

    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    splits = splitter.split_documents(docs)
    if not splits:
        raise ValueError("No text chunks could be extracted from the file.")

    logger.info("'%s' → %d chunks; adding to ChromaDB…", filename, len(splits))
    get_db().add_documents(splits)
    logger.info("'%s' ingested successfully.", filename)


# ── RAG query ────────────────────────────────────────────────────────────────
def query_rag(query_text: str) -> dict:
    """Retrieve relevant chunks and answer the query via the LLM."""
    logger.info("query_rag: '%s'", query_text[:80])

    db = get_db()
    results = db.similarity_search_with_score(query_text, k=3)

    # Filter by L2 distance threshold
    valid_results = [(doc, score) for doc, score in results if score <= SIMILARITY_THRESHOLD]
    logger.info(
        "similarity_search: %d total, %d below threshold (%.2f)",
        len(results), len(valid_results), SIMILARITY_THRESHOLD,
    )

    if not valid_results:
        return {
            "answer": "No data regarding this query is available in the uploaded documents.",
            "sources": [],
        }

    context_text = "\n\n---\n\n".join([doc.page_content for doc, _ in valid_results])

    prompt_template = """You are an AI assistant answering questions based on the provided Context.
Use only the information in the Context. If the Context does not contain the answer, respond with:
'I don't have enough information to answer that question.'

Context:
{context}

Question: {question}
"""
    prompt = ChatPromptTemplate.from_template(prompt_template)
    model = ChatGroq(model_name="llama-3.1-8b-instant", temperature=0)
    chain = prompt | model

    try:
        response = chain.invoke({"context": context_text, "question": query_text})
        answer_text = getattr(response, "content", None) or str(response).strip()
    except Exception as exc:
        logger.error("LLM chain error: %s", exc)
        answer_text = None

    if not answer_text:
        answer_text = "No data regarding this query is available in the uploaded documents."

    # Deduplicated source snippets
    sources = []
    seen = set()
    for doc, _ in valid_results:
        snippet = doc.page_content[:200] + "..."
        if snippet not in seen:
            sources.append({
                "source": doc.metadata.get("source_file", "Unknown"),
                "page": doc.metadata.get("page", 0),
                "content": snippet,
            })
            seen.add(snippet)

    logger.info("query_rag completed. answer_len=%d sources=%d", len(answer_text), len(sources))
    return {"answer": answer_text, "sources": sources}


# ── Document management ───────────────────────────────────────────────────────
def list_documents() -> list[str]:
    """Return a list of unique source filenames stored in ChromaDB."""
    try:
        collection = get_db()._collection
        results = collection.get(include=["metadatas"])
        if not results or not results.get("metadatas"):
            return []
        unique_files = {
            meta["source_file"]
            for meta in results["metadatas"]
            if "source_file" in meta
        }
        return sorted(unique_files)
    except Exception as exc:
        logger.error("list_documents error: %s", exc)
        return []


def delete_document(filename: str) -> bool:
    """Delete all ChromaDB chunks associated with the given filename."""
    try:
        collection = get_db()._collection
        results = collection.get(where={"source_file": filename})
        if results and results.get("ids"):
            collection.delete(ids=results["ids"])
            logger.info("Deleted %d chunks for '%s'.", len(results["ids"]), filename)
            return True
        return False
    except Exception as exc:
        logger.error("delete_document error for '%s': %s", filename, exc)
        return False
