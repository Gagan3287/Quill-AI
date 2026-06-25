import os

# Set thread counts to '4' to utilize CPU cores for fast embeddings
# while keeping resource consumption balanced.
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

CHROMA_PATH = "chroma_db"

# Initialize embeddings
embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")

def get_db():
    return Chroma(persist_directory=CHROMA_PATH, embedding_function=embeddings)

def process_document(filepath: str, filename: str):
    if filename.endswith(".pdf"):
        loader = PyPDFium2Loader(filepath)
    elif filename.endswith(".docx"):
        loader = Docx2txtLoader(filepath)
    elif filename.endswith(".pptx"):
        # Use python-pptx directly — more reliable than UnstructuredPowerPointLoader
        prs = Presentation(filepath)
        slides_text = []
        for i, slide in enumerate(prs.slides):
            slide_content = []
            for shape in slide.shapes:
                if shape.has_text_frame:
                    for para in shape.text_frame.paragraphs:
                        text = para.text.strip()
                        if text:
                            slide_content.append(text)
            if slide_content:
                slides_text.append(
                    Document(
                        page_content="\n".join(slide_content),
                        metadata={"source": filepath, "page": i + 1}
                    )
                )
        if not slides_text:
            raise ValueError("No readable text found in the PowerPoint file. Ensure the slides contain text content.")
        # Add filename metadata and return early (no loader needed)
        for doc in slides_text:
            doc.metadata["source_file"] = filename
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        splits = text_splitter.split_documents(slides_text)
        if not splits:
            raise ValueError("Could not extract any text chunks from the PowerPoint file.")
        db = get_db()
        db.add_documents(splits)
        return
    elif filename.endswith(".txt"):
        loader = TextLoader(filepath)
    else:
        raise ValueError("Unsupported file type")
        
    docs = loader.load()
    
    if not docs:
        raise ValueError("No content could be extracted from the file. The file may be empty or corrupted.")
    # Add filename to metadata
    for doc in docs:
        doc.metadata["source_file"] = filename
    
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    splits = text_splitter.split_documents(docs)
    if not splits:
        raise ValueError("No text chunks could be extracted from the file.")
    
    db = get_db()
    db.add_documents(splits)

def query_rag(query_text: str):
    db = get_db()
    
    # Similarity search (returns (document, distance))
    # Note: Using distance rather than relevance_scores to avoid normalization issues
    # With Chroma/L2, smaller distance = more similar
    results = db.similarity_search_with_score(query_text, k=3)
    
    # We define a threshold for distance. 
    # For L2 with all-MiniLM-L6-v2, a distance < 1.5 is usually decent. We can tune this.
    THRESHOLD = 100
    
    valid_results = [res for res in results if res[1] <= THRESHOLD]
    
    if not valid_results:
        return {
            "answer": "No data regarding this query is available in the uploaded documents.",
            "sources": []
        }
    
    context_text = "\n\n---\n\n".join([doc.page_content for doc, _score in valid_results])
    
    prompt_template = """
    You are an AI assistant answering questions based on the provided Context.
    Use only the information in the Context. If the Context does not contain the answer, respond with 'I don't have enough information to answer that question.'
    Context:
    {context}

    Question: {question}
    """
    
    prompt = ChatPromptTemplate.from_template(prompt_template)
    
    model = ChatGroq(model_name="llama-3.1-8b-instant", temperature=0)
    
    chain = prompt | model
    
    # Invoke the LLM chain and safely extract the answer text
    try:
        response = chain.invoke({"context": context_text, "question": query_text})
    except Exception as e:
        # Log error (could be expanded) and fallback to empty response
        response = None
    # Extract answer text depending on response type
    answer_text = None
    if response is not None:
        answer_text = getattr(response, "content", None)
        if not answer_text:
            # If the response object doesn't have .content or is empty, convert to string
            answer_text = str(response).strip()
    if not answer_text:
        answer_text = "No data regarding this query is available in the uploaded documents."

    
    # Initialize sources list
    sources = []
    # Using a set to prevent duplicate snippets if they somehow overlap exactly
    seen_content = set()
    for doc, _score in valid_results:
        snippet = doc.page_content[:200] + "..."
        if snippet not in seen_content:
            sources.append({
                "source": doc.metadata.get("source_file", "Unknown"),
                "page": doc.metadata.get("page", 0),
                "content": snippet
            })
            seen_content.add(snippet)

    return {
        "answer": answer_text,
        "sources": sources
    }

def list_documents():
    db = get_db()
    collection = db._collection
    results = collection.get(include=["metadatas"])
    
    if not results or not results["metadatas"]:
        return []
        
    unique_files = set()
    for meta in results["metadatas"]:
        if "source_file" in meta:
            unique_files.add(meta["source_file"])
            
    return list(unique_files)

def delete_document(filename: str):
    db = get_db()
    collection = db._collection
    results = collection.get(where={"source_file": filename})
    if results and results["ids"]:
        collection.delete(ids=results["ids"])
        return True
    return False
