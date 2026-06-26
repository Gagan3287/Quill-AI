import React, { useState, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { Send, Upload, FileText, Trash2, Loader2, AlertCircle, PanelLeftClose, PanelLeftOpen, Globe } from 'lucide-react';
import { uploadPdf, chatWithRag, getDocuments, deleteDocument, getApiUrl, updateApiUrl, initializeApiUrl } from './api';
import MessageRenderer from './components/MarkdownRenderer';
import Landing from './Landing';

function App() {
  const darkMode = true; // Forced dark mode
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [documents, setDocuments] = useState([]);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState(null);
  const [showApp, setShowApp] = useState(window.location.hash === '#/chat');
  const [customApiUrl, setCustomApiUrl] = useState(getApiUrl());

  const goToChat = () => {
    window.location.hash = '#/chat';
  };

  const messagesEndRef = useRef(null);

  useEffect(() => {
    const handleHashChange = () => {
      setShowApp(window.location.hash === '#/chat');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const url = await initializeApiUrl();
        setCustomApiUrl(url);
      } catch (err) {
        console.error("Failed to initialize API URL", err);
      }
      fetchDocuments();
    };
    init();
  }, []);

  const fetchDocuments = async () => {
    try {
      const data = await getDocuments();
      setDocuments(data.documents || []);
    } catch (err) {
      console.error("Failed to fetch documents", err);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const onDrop = async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;
    setIsUploading(true);
    setError(null);

    // Safety timeout: force-reset uploading state after 60s no matter what
    const safetyTimer = setTimeout(() => {
      setIsUploading(false);
      setError('Upload timed out. Please try again.');
    }, 60000);

    try {
      const data = await uploadPdf(acceptedFiles);
      clearTimeout(safetyTimer);

      const errors = data.results.filter(r => r.status === 'error');
      const successes = data.results.filter(r => r.status === 'success');

      if (errors.length > 0) {
        const errorMessages = errors.map(e => `${e.filename}: ${e.message || 'Unknown error'}`).join('\n');
        setError(errorMessages);
      }

      // Refresh document list separately — don't let this block completion
      if (successes.length > 0) {
        try {
          await fetchDocuments();
        } catch (_fetchErr) {
          console.warn('Could not refresh document list after upload:', _fetchErr);
        }
      }
    } catch (err) {
      clearTimeout(safetyTimer);
      if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
        setError('Cannot connect to the backend server. Please make sure the Python backend is running on port 8000.');
      } else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        setError('Upload timed out. The file may be too large or the server is busy. Please try again.');
      } else {
        setError(`Upload failed: ${err.response?.data?.detail || err.message || 'Unknown error'}`);
      }
    } finally {
      clearTimeout(safetyTimer);
      setIsUploading(false);
    }
  };



  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'text/plain': ['.txt']
    }
  });

  const handleDelete = async (filename) => {
    try {
      await deleteDocument(filename);
      await fetchDocuments();
    } catch (err) {
      console.error("Failed to delete document", err);
    }
  };

  const handleSaveApiUrl = (e) => {
    e?.preventDefault();
    const updated = updateApiUrl(customApiUrl);
    setCustomApiUrl(updated);
    setError(null);
    fetchDocuments();
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const userMsg = { role: 'user', content: inputMessage };
    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsTyping(true);

    try {
      const response = await chatWithRag(userMsg.content);
      const botMsg = {
        role: 'bot',
        content: response.answer,
        sources: response.sources
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      const botMsg = {
        role: 'bot',
        content: "Sorry, an error occurred while processing your request.",
        isError: true
      };
      setMessages(prev => [...prev, botMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  if (!showApp) {
    return <Landing onGetStarted={goToChat} />;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-brand-surface dark:bg-brand-dark transition-colors duration-200">

      {/* ── Sidebar ── */}
      <div
        className={`
          flex-shrink-0 flex flex-col
          bg-brand-surface-light dark:bg-brand-dark
          border-r border-[#00000014] dark:border-[#ffffff14]
          transition-all duration-300 ease-in-out overflow-hidden
          ${sidebarOpen ? 'w-72' : 'w-0'}
        `}
      >
        {/* Sidebar header: logo left, toggle + theme right */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2 min-w-[288px]">
          <img
            src={darkMode ? '/logo-dark.png' : '/logo-light.png'}
            alt="Quill AI"
            className="h-14 w-auto object-contain transition-opacity duration-200"
          />
          <div className="flex items-center gap-1">
            {/* Close sidebar */}
            <button
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
              title="Close sidebar"
              className="p-2 rounded-full hover:bg-gray-200/50 dark:hover:bg-white/10 transition-colors text-gray-500 dark:text-gray-400"
            >
              <PanelLeftClose size={18} />
            </button>
          </div>
        </div>

        <div className="border-b border-[#00000014] dark:border-[#ffffff14] min-w-[288px]" />

        {/* Sidebar body */}
        <div className="p-4 flex-1 overflow-y-auto min-w-[288px]">
          <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">
            Documents
          </h2>

          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors
              ${isDragActive
                ? 'border-brand-secondary bg-brand-secondary/10 dark:bg-brand-secondary/20'
                : 'border-gray-300 dark:border-[#ffffff14] hover:bg-[#f4f4f6] dark:hover:bg-[#1a1a24]'}`}
          >
            <input {...getInputProps()} aria-label="Upload documents (PDF, Word, PPT, TXT)" />
            {isUploading ? (
              <div>
                <Loader2 size={28} className="animate-spin mx-auto text-brand-primary mb-2" />
                <p className="text-sm font-semibold text-brand-primary dark:text-brand-secondary">Processing...</p>
              </div>
            ) : (
              <div>
                <Upload size={28} className="mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {isDragActive ? "Drop file here" : "Drag & drop PDF, Word, PPT, TXT"}
                </p>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-3 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg flex items-start text-sm">
              <AlertCircle size={15} className="mr-2 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-4 space-y-2">
            {documents.length === 0 ? (
              <p className="text-sm text-gray-400 text-center italic">No documents uploaded</p>
            ) : (
              documents.map((doc) => (
                <div key={doc} className="flex items-center justify-between p-3 bg-[#f4f4f6] dark:bg-[#1a1a24] rounded-lg group">
                  <div className="flex items-center space-x-2 overflow-hidden">
                    <FileText size={16} className="text-brand-secondary dark:text-brand-primary flex-shrink-0" />
                    <span className="text-sm truncate text-gray-700 dark:text-gray-300" title={doc}>
                      {doc}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDelete(doc)}
                    aria-label={`Delete document: ${doc}`}
                    title={`Delete ${doc}`}
                    className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex-shrink-0"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Main Chat Area ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar — shown only when sidebar is closed */}
        {!sidebarOpen && (
          <div className="flex items-center gap-3 px-4 py-3 bg-[#fdfdfd] dark:bg-[#111118] border-b border-[#00000014] dark:border-[#ffffff14]">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
              title="Open sidebar"
              className="p-2 rounded-full hover:bg-gray-200/50 dark:hover:bg-white/10 transition-colors text-gray-500 dark:text-gray-400"
            >
              <PanelLeftOpen size={20} />
            </button>
            <img src={darkMode ? '/logo-dark.png' : '/logo-light.png'} alt="Quill AI" className="h-8 w-auto object-contain transition-opacity duration-200" />

          </div>
        )}

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <div className="w-16 h-16 bg-brand-secondary/10 dark:bg-brand-secondary/20 rounded-full flex items-center justify-center mb-4">
                <FileText size={32} className="text-brand-secondary dark:text-brand-primary" />
              </div>
              <h2 className="text-xl font-semibold text-gray-600 dark:text-gray-300 mb-2">Welcome to Quill AI</h2>
              <p className="text-center max-w-md">Upload documents (PDF, Word, PPT, Text) from the sidebar and start asking questions based strictly on their content.</p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl p-4 shadow-sm ${msg.role === 'user'
                  ? 'bg-gradient-to-r from-brand-primary to-brand-secondary text-black font-semibold rounded-br-none'
                  : 'bg-brand-surface dark:bg-brand-dark border border-[#00000014] dark:border-[#ffffff14] rounded-bl-none'
                  }`}>
                  {msg.role === 'user' ? (
                    <p className={`whitespace-pre-wrap ${msg.isError ? 'text-red-300' : ''}`}>
                      {msg.content}
                    </p>
                  ) : (
                    <div className={msg.isError ? 'text-red-500' : 'text-gray-800 dark:text-gray-200'}>
                      <MessageRenderer content={msg.content} />
                    </div>
                  )}

                  {/* Sources */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-[#00000014] dark:border-[#ffffff14]">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">Sources</p>
                      <div className="space-y-2">
                        {msg.sources.map((src, i) => (
                          <div key={i} className="bg-[#f4f4f6] dark:bg-[#0a0a0f] rounded p-2 text-xs">
                            <div className="flex justify-between items-center mb-1 text-gray-600 dark:text-gray-400 font-medium">
                              <span className="truncate mr-2">{src.source}</span>
                              <span className="flex-shrink-0">Page {src.page}</span>
                            </div>
                            <p className="text-gray-500 dark:text-gray-500 italic line-clamp-2">"{src.content}"</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-brand-surface dark:bg-brand-dark border border-[#00000014] dark:border-[#ffffff14] rounded-2xl rounded-bl-none p-4 shadow-sm flex space-x-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-[#fdfdfd] dark:bg-[#111118] border-t border-[#00000014] dark:border-[#ffffff14]">
          <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto relative">
            <input
              type="text"
              id="chat-input"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={documents.length > 0 ? "Ask a question about your documents..." : "Please upload a document first..."}
              aria-label="Ask a question about your uploaded documents"
              title="Ask a question about your uploaded documents"
              disabled={documents.length === 0}
              className="w-full bg-brand-surface dark:bg-brand-dark border border-gray-300 dark:border-[#ffffff14] rounded-full py-4 pl-6 pr-14 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent disabled:opacity-50 transition-colors text-gray-900 dark:text-gray-100"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || documents.length === 0}
              aria-label="Send message"
              title="Send message"
              className="absolute right-2 top-2 p-2 bg-gradient-to-r from-brand-primary to-brand-secondary hover:opacity-90 text-black rounded-full disabled:opacity-50 transition-all"
            >
              <Send size={20} className="ml-1 mt-1 mb-1 mr-1" />
            </button>
          </form>
          <div className="text-center mt-2">
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Responses are generated strictly from uploaded context.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
