# Quill AI — RAG Assistant

A full-stack AI-powered document Q&A application using Retrieval-Augmented Generation (RAG). Upload PDF, Word, PowerPoint, or text files and ask questions — Quill AI answers based strictly on your document content.

---

## 🚀 Features

- **Multi-format uploads**: PDF, DOCX, PPTX, TXT
- **Fast processing**: Uses `PyPDFium2` (Google's C++ PDFium) for 7.5x faster PDF parsing + multi-threaded embeddings
- **Vector search**: ChromaDB with HuggingFace `all-MiniLM-L6-v2` sentence embeddings
- **LLM answering**: Powered by Groq's Llama 3.1 8B Instant
- **Premium landing page**: Dark glassmorphism design with Plus Jakarta Sans typography
- **Real-time chat**: Streaming conversation interface with source citations

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite, Vanilla CSS |
| Backend | FastAPI (Python) |
| Embeddings | HuggingFace `sentence-transformers/all-MiniLM-L6-v2` |
| Vector DB | ChromaDB |
| PDF Parsing | PyPDFium2 (Google PDFium) |
| LLM | Groq Llama-3.1-8b-instant |
| Async | `asyncio.run_in_executor` (thread pool) |

---

## ⚙️ Setup & Running

### Prerequisites
- Python 3.11+
- Node.js 18+
- A [Groq API key](https://console.groq.com)

### Backend Setup

```bash
cd backend
python -m venv venv
.\venv\Scripts\activate   # Windows
# source venv/bin/activate  # Mac/Linux

pip install -r requirements.txt

# Copy .env.example to .env and fill in your GROQ_API_KEY
copy .env.example .env

python main.py
```

Backend will start at `http://localhost:8000`

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend will start at `http://localhost:5174`

---

## 📁 Project Structure

```
RAG model/
├── backend/
│   ├── main.py          # FastAPI server with async thread pool
│   ├── rag.py           # Document processing, embedding, querying
│   ├── requirements.txt # Python dependencies
│   └── .env.example     # Environment variable template
├── frontend/
│   ├── src/
│   │   ├── App.jsx       # Chat page with document sidebar
│   │   ├── Landing.jsx   # Landing page
│   │   ├── api.js        # Axios API client
│   │   └── components/   # Markdown renderer, etc.
│   ├── public/           # Logo assets
│   └── index.html        # Entry point
└── requirements.txt      # Top-level pip requirements
```

---

## 🔑 Environment Variables

| Variable | Description |
|----------|-------------|
| `GROQ_API_KEY` | Your Groq API key for Llama 3.1 inference |

---

## 📜 License

MIT License — feel free to use, modify, and distribute.
