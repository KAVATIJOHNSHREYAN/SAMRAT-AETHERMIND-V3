/* eslint-disable */
import React, { useEffect, useRef, useState } from 'react';
import { apiService } from '@/services/api';
import { useChatStore } from '@/store/chatStore';
import {
  FileText,
  Upload,
  Trash2,
  Send,
  Loader2,
  Sparkles,
  Bot,
  User,
  AlertCircle
} from 'lucide-react';

interface PDFItem {
  pdf_id: number;
  filename: string;
}

interface DocMessage {
  role: 'user' | 'assistant';
  message: string;
}

interface DocumentChatProps {
  externalPdfs?: PDFItem[];
  externalSelectedPdf?: PDFItem | null;
  onPdfsChange?: (pdfs: PDFItem[]) => void;
  onSelectedPdfChange?: (pdf: PDFItem | null) => void;
}

export function DocumentChat({ externalPdfs, externalSelectedPdf, onPdfsChange, onSelectedPdfChange }: DocumentChatProps = {}) {
  const { token, modelSettings, theme } = useChatStore();
  const isDark = theme === 'dark';
  const [internalPdfs, setInternalPdfs] = useState<PDFItem[]>([]);
  const [internalSelectedPdf, setInternalSelectedPdf] = useState<PDFItem | null>(null);
  const [messages, setMessages] = useState<DocMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Use external state if provided, otherwise use internal
  const pdfs = externalPdfs !== undefined ? externalPdfs : internalPdfs;
  const selectedPdf = externalSelectedPdf !== undefined ? externalSelectedPdf : internalSelectedPdf;

  const setPdfs = (newPdfs: PDFItem[]) => {
    if (onPdfsChange) onPdfsChange(newPdfs);
    else setInternalPdfs(newPdfs);
  };

  const setSelectedPdf = (pdf: PDFItem | null) => {
    if (onSelectedPdfChange) onSelectedPdfChange(pdf);
    else setInternalSelectedPdf(pdf);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (token) {
      fetchPDFs();
    }
  }, [token]);

  useEffect(() => {
    if (selectedPdf && token) {
      loadChatHistory(selectedPdf.pdf_id);
    } else {
      setMessages([]);
    }
  }, [selectedPdf, token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function fetchPDFs() {
    try {
      setErrorMsg(null);
      const data = await apiService.getDocPdfs(token!);
      setPdfs(data);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Failed to load documents.');
    }
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !token) return;

    setUploading(true);
    setErrorMsg(null);

    try {
      const response = await apiService.uploadDocPdf(token, file, modelSettings);
      await fetchPDFs();

      if (response.pdf_id) {
        setSelectedPdf({
          pdf_id: response.pdf_id,
          filename: response.filename || file.name,
        });
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Upload failed. Ensure backend is running.');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(pdfId: number, event: React.MouseEvent) {
    event.stopPropagation();
    const confirmDelete = window.confirm('Are you sure you want to delete this PDF?');
    if (!confirmDelete || !token) return;

    try {
      await apiService.deleteDocPdf(token, pdfId);
      await fetchPDFs();
      if (selectedPdf?.pdf_id === pdfId) {
        setSelectedPdf(null);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to delete document.');
    }
  }

  async function handleSend(customText?: string) {
    const textToSend = customText || question;
    if (!textToSend.trim() || !selectedPdf || !token) return;

    setLoading(true);
    setErrorMsg(null);
    if (!customText) setQuestion('');

    // Optimistically add user message
    setMessages((prev) => [...prev, { role: 'user', message: textToSend }]);

    try {
      const response = await apiService.sendDocChatMessage(token, selectedPdf.pdf_id, textToSend, modelSettings);
      setMessages((prev) => [...prev, { role: 'assistant', message: response.answer }]);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to fetch response.');
    } finally {
      setLoading(false);
    }
  }

  async function loadChatHistory(pdfId: number) {
    try {
      const data = await apiService.getDocChatHistory(token!, pdfId);
      setMessages(data);
    } catch (err) {
      console.error(err);
      setMessages([]);
    }
  }

  async function handleConvert(format: 'markdown' | 'word') {
    if (!selectedPdf || !token) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
      const res = await fetch(`${BASE_URL}/doc-chat/convert/${selectedPdf.pdf_id}?format=${format}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Failed to convert document');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedPdf.filename.split('.')[0]}.${format === 'markdown' ? 'md' : 'docx'}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Failed to convert and download document.');
    } finally {
      setLoading(false);
    }
  }

  const suggestions = [
    { label: "Summarize Document", prompt: "Provide a comprehensive summary of this document, including key takeaways and an executive overview." },
    { label: "Create Quiz", prompt: "Create a 5-question multiple choice quiz based on this document. Format it with questions, choices, and answers at the bottom." },
    { label: "Create Flashcards", prompt: "Create 5 study flashcards from this document. Format each card with a Front (concept/question) and a Back (definition/answer)." },
    { label: "Extract Tables", prompt: "Identify, extract and format all tables present in this document into clean Markdown tables." }
  ];

  return (
    <div className="flex flex-col h-full w-full bg-transparent overflow-hidden">
      {/* Top Header of Chat Area */}
      <div className={`p-4 border-b ${isDark ? 'bg-black border-slate-900 shadow-none' : 'bg-white border-slate-200 shadow-sm'} flex items-center justify-between rounded-2xl mb-4`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl ${isDark ? 'bg-slate-900 text-[#38BDF8]' : 'bg-[#0EA5E9]/10 text-[#0EA5E9]'} flex items-center justify-center text-xl`}>
            📄
          </div>
          <div>
            <h2 className={`text-sm font-extrabold ${isDark ? 'text-white' : 'text-slate-800'} truncate max-w-[280px] sm:max-w-md`}>
              {selectedPdf ? selectedPdf.filename : 'DocMind AI'}
            </h2>
            <p className={`text-[10px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-450'}`}>
              {selectedPdf ? 'Ask questions targeting the contents of this document.' : 'Upload or select a PDF to begin.'}
            </p>
          </div>
        </div>

        {/* Upload & Delete in Header */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0EA5E9] hover:bg-[#0066CC] disabled:bg-slate-350 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            {uploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            <span>Upload PDF</span>
          </button>

          {selectedPdf && (
            <button
              onClick={(e) => handleDelete(selectedPdf.pdf_id, e)}
              className={`p-2 border ${isDark ? 'border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-red-400' : 'border-slate-250 hover:bg-red-50 hover:border-red-200 text-slate-500 hover:text-red-500'} rounded-xl transition-all`}
              title="Delete Current Document"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          <input
            type="file"
            accept=".pdf"
            ref={fileInputRef}
            onChange={handleUpload}
            className="hidden"
          />
        </div>
      </div>

      {errorMsg && (
        <div className={`mx-1 my-2 p-3.5 border ${isDark ? 'bg-red-950/20 border-red-900/30 text-red-300' : 'bg-red-50 border-red-200 text-red-700'} rounded-2xl flex items-center gap-2.5 text-xs`}>
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Messages & Content Area */}
      <div className={`flex-1 flex flex-col justify-between ${isDark ? 'bg-black border-slate-900 text-white' : 'bg-white border-slate-200'} border rounded-[24px] overflow-hidden shadow-sm relative`}>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!selectedPdf && messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto p-4 py-8">
              <div className={`w-16 h-16 rounded-[20px] ${isDark ? 'bg-slate-900 text-[#38BDF8]' : 'bg-[#0EA5E9]/10 text-[#0EA5E9]'} flex items-center justify-center text-3xl mb-4`}>📄</div>
              <h1 className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-800'} mb-1`}>DocMind AI</h1>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} mb-6 max-w-sm`}>
                Upload a document using the top-right button, and query its contents. DocMind AI extracts context blocks and replies using only verified document context.
              </p>

              {/* Feature Grid */}
              <div className="grid grid-cols-2 gap-3 w-full text-left">
                <div className={`p-3.5 border ${isDark ? 'bg-[#0a0a0a] border-slate-900' : 'bg-slate-50 border-slate-150'} rounded-2xl`}>
                  <div className="text-[#0EA5E9] font-extrabold text-xs mb-1">💬 Chat with PDFs</div>
                  <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'} font-medium`}>Ask questions and search context instantly.</div>
                </div>
                <div className={`p-3.5 border ${isDark ? 'bg-[#0a0a0a] border-slate-900' : 'bg-slate-50 border-slate-150'} rounded-2xl`}>
                  <div className="text-[#0EA5E9] font-extrabold text-xs mb-1">📝 Summarize documents</div>
                  <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'} font-medium`}>Get comprehensive reviews and takeaways.</div>
                </div>
                <div className={`p-3.5 border ${isDark ? 'bg-[#0a0a0a] border-slate-900' : 'bg-slate-50 border-slate-150'} rounded-2xl`}>
                  <div className="text-[#0EA5E9] font-extrabold text-xs mb-1">❓ Create quizzes</div>
                  <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'} font-medium`}>Generate studies & test prep assessments.</div>
                </div>
                <div className={`p-3.5 border ${isDark ? 'bg-[#0a0a0a] border-slate-900' : 'bg-slate-50 border-slate-150'} rounded-2xl`}>
                  <div className="text-[#0EA5E9] font-extrabold text-xs mb-1">🎴 Flashcards</div>
                  <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'} font-medium`}>Study key terms, definitions, and concepts.</div>
                </div>
                <div className={`p-3.5 border ${isDark ? 'bg-[#0a0a0a] border-slate-900' : 'bg-slate-50 border-slate-150'} rounded-2xl`}>
                  <div className="text-[#0EA5E9] font-extrabold text-xs mb-1">📊 Extract tables</div>
                  <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'} font-medium`}>Isolate tabular datasets into Markdown sheets.</div>
                </div>
                <div className={`p-3.5 border ${isDark ? 'bg-[#0a0a0a] border-slate-900' : 'bg-slate-50 border-slate-150'} rounded-2xl`}>
                  <div className="text-[#0EA5E9] font-extrabold text-xs mb-1">🔄 Convert PDF</div>
                  <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'} font-medium`}>Export documents to clean Markdown or Word formats.</div>
                </div>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto py-8">
              <div className="text-3xl mb-2">💬</div>
              <h3 className={`text-base font-extrabold ${isDark ? 'text-white' : 'text-slate-800'} mb-1`}>No Chat History</h3>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} mb-6`}>Ask a question or select one of the templates below:</p>

              <div className="grid gap-2.5 w-full">
                {suggestions.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(s.prompt)}
                    className={`w-full text-left p-3.5 border rounded-xl text-xs font-bold transition-all hover:scale-[1.01] ${isDark ? 'bg-[#0a0a0a] hover:bg-slate-900 border-slate-800 text-slate-200' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'}`}
                  >
                    💡 {s.label}
                  </button>
                ))}
                <div className="grid grid-cols-2 gap-2 w-full mt-2">
                  <button
                    onClick={() => handleConvert('markdown')}
                    className={`p-2.5 border rounded-xl text-xs font-bold transition-all ${isDark ? 'bg-emerald-950/20 hover:bg-emerald-900/35 border-emerald-900 text-emerald-300' : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700'}`}
                  >
                    🔄 Export to MD
                  </button>
                  <button
                    onClick={() => handleConvert('word')}
                    className={`p-2.5 border rounded-xl text-xs font-bold transition-all ${isDark ? 'bg-blue-950/20 hover:bg-blue-900/35 border-blue-900 text-blue-300' : 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-[#0EA5E9]'}`}
                  >
                    📝 Export to Word
                  </button>
                </div>
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-3.5 max-w-2xl ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  msg.role === 'user'
                    ? isDark ? 'bg-[#38BDF8]/20 text-[#38BDF8]' : 'bg-[#0EA5E9]/10 text-[#0EA5E9]'
                    : isDark ? 'bg-slate-800 text-slate-350' : 'bg-slate-100 text-slate-655'
                }`}>
                  {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div className={`p-4 rounded-2xl text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? isDark ? 'bg-[#0EA5E9]/20 text-slate-100 border border-[#38BDF8]/30 rounded-tr-none' : 'bg-[#0EA5E9]/8 text-slate-800 border border-[#38BDF8]/20 rounded-tr-none'
                    : isDark ? 'bg-[#0a0a0a] text-slate-200 border border-slate-900 rounded-tl-none' : 'bg-slate-50 text-slate-800 border border-slate-150 rounded-tl-none'
                }`}>
                  {msg.message}
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex gap-3.5 max-w-2xl">
              <div className={`w-8 h-8 rounded-full ${isDark ? 'bg-slate-850 text-slate-300' : 'bg-slate-150 text-slate-600'} flex items-center justify-center shrink-0`}>
                <Bot className="w-4 h-4" />
              </div>
              <div className={`p-4 border rounded-2xl rounded-tl-none text-xs flex items-center gap-2 ${isDark ? 'bg-[#0a0a0a] border-slate-900 text-slate-400' : 'bg-slate-50 border-slate-150 text-slate-500'}`}>
                <Loader2 className="w-4 h-4 animate-spin text-[#0EA5E9]" />
                <span className="font-bold">DocMind is analyzing the document...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className={`p-4 border-t ${isDark ? 'bg-[#0a0a0a] border-slate-900' : 'bg-slate-50 border-slate-150'} space-y-3`}>
          {selectedPdf && !loading && (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {[
                { label: 'Summarize', icon: '📝', prompt: 'Provide a comprehensive summary of this document, including key takeaways and an executive overview.' },
                { label: 'Create Quiz', icon: '❓', prompt: 'Create a 5-question multiple choice quiz based on this document. Format it with questions, choices, and answers at the bottom.' },
                { label: 'Flashcards', icon: '🎴', prompt: 'Create 5 study flashcards from this document. Format each card with a Front (concept/question) and a Back (definition/answer).' },
                { label: 'Extract Tables', icon: '📊', prompt: 'Identify, extract and format all tables present in this document into clean Markdown tables.' }
              ].map((act, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSend(act.prompt)}
                  className={`flex-shrink-0 flex items-center gap-1.5 py-1.5 px-3 border rounded-full text-[10px] font-bold transition-all active:scale-[0.97] ${isDark ? 'bg-slate-850 hover:bg-slate-700 border-slate-700 text-slate-300' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'}`}
                >
                  <span>{act.icon}</span>
                  <span>{act.label}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleConvert('markdown')}
                className={`flex-shrink-0 flex items-center gap-1.5 py-1.5 px-3 border rounded-full text-[10px] font-bold transition-all active:scale-[0.97] ${isDark ? 'bg-emerald-950/20 hover:bg-emerald-900/35 border-emerald-900 text-emerald-300' : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700'}`}
              >
                <span>🔄</span>
                <span>Export MD</span>
              </button>
              <button
                type="button"
                onClick={() => handleConvert('word')}
                className={`flex-shrink-0 flex items-center gap-1.5 py-1.5 px-3 border rounded-full text-[10px] font-bold transition-all active:scale-[0.97] ${isDark ? 'bg-blue-950/20 hover:bg-blue-900/35 border-blue-900 text-blue-300' : 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-[#0EA5E9]'}`}
              >
                <span>📝</span>
                <span>Export Word</span>
              </button>
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex gap-3"
          >
            <input
              type="text"
              disabled={!selectedPdf || loading}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={selectedPdf ? 'Ask anything about your document...' : 'Upload or select a PDF first...'}
              className={`flex-1 p-3.5 focus:outline-none rounded-xl text-xs transition-colors shadow-sm ${isDark ? 'bg-black border border-slate-800 text-white placeholder-slate-500 focus:border-[#38BDF8]/65' : 'bg-white border border-slate-250 text-slate-800 placeholder-slate-450 focus:border-[#38BDF8]/60'}`}
            />
            <button
              type="submit"
              disabled={!selectedPdf || loading || !question.trim()}
              className="px-5 bg-[#0EA5E9] hover:bg-[#0066CC] disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl font-bold flex items-center justify-center transition-all shadow-sm"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

