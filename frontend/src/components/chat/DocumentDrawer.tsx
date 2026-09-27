'use client';
import React, { useState } from 'react';
import {
  FileText,
  X,
  Upload,
  Trash2,
  Download,
  Eye,
  Sparkles,
  Layers,
  Database,
  CheckCircle2,
  Loader2,
  ChevronRight,
  FileCode,
  FileSpreadsheet,
  File,
  HelpCircle,
  BookOpen
} from 'lucide-react';
import { useChatStore } from '@/store/chatStore';

export interface DocumentItem {
  id: string;
  name: string;
  size: string;
  type: string;
  pages?: number;
  chunksIndexed?: number;
  tokens?: number;
  status: 'uploading' | 'indexing' | 'ready' | 'error';
  uploadDate: string;
  data?: string; // base64
}

interface DocumentDrawerProps {
  documents: DocumentItem[];
  activeDocumentId: string | null;
  onSelectDocument: (id: string) => void;
  onRemoveDocument: (id: string) => void;
  onUploadDocument: (files: FileList) => void;
  onClose: () => void;
  onSendQuickPrompt: (prompt: string) => void;
  isDark?: boolean;
}

export function DocumentDrawer({
  documents,
  activeDocumentId,
  onSelectDocument,
  onRemoveDocument,
  onUploadDocument,
  onClose,
  onSendQuickPrompt,
  isDark = true
}: DocumentDrawerProps) {
  const [activeTab, setActiveTab] = useState<'docs' | 'outline' | 'prompts'>('docs');
  const activeDoc = documents.find(d => d.id === activeDocumentId) || documents[0];

  const getFileIcon = (fileType: string) => {
    const t = fileType.toLowerCase();
    if (t.includes('pdf')) return <FileText className="w-4 h-4 text-red-400" />;
    if (t.includes('sheet') || t.includes('csv') || t.includes('excel')) return <FileSpreadsheet className="w-4 h-4 text-emerald-400" />;
    if (t.includes('code') || t.includes('json') || t.includes('md')) return <FileCode className="w-4 h-4 text-cyan-400" />;
    return <File className="w-4 h-4 text-violet-400" />;
  };

  return (
    <aside className={`w-80 h-full border-l flex flex-col z-20 backdrop-blur-2xl transition-all duration-300 ${
      isDark ? 'bg-[#060711]/90 border-white/[0.06] text-white' : 'bg-white/95 border-slate-200 text-slate-900'
    }`}>
      {/* Header */}
      <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider">DocMind Intelligence</h3>
            <span className="text-[9px] text-slate-500 block font-mono">{documents.length} Active Document(s)</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer transition-colors"
          title="Close Document Panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-white/[0.06] px-4 pt-2 gap-2 text-xs font-bold">
        {[
          { id: 'docs', label: 'Documents' },
          { id: 'prompts', label: 'Quick Analysis' },
          { id: 'outline', label: 'RAG Metadata' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-2 px-1 border-b-2 text-[11px] transition-colors cursor-pointer ${
              activeTab === tab.id
                ? 'border-violet-500 text-violet-400 font-extrabold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'docs' && (
          <div className="space-y-3">
            {/* Upload Button */}
            <label className={`block border-2 border-dashed p-3 rounded-2xl text-center cursor-pointer transition-all ${
              isDark
                ? 'border-violet-500/30 bg-violet-600/5 hover:bg-violet-600/10 hover:border-violet-500/60'
                : 'border-slate-300 bg-slate-50 hover:bg-slate-100'
            }`}>
              <input
                type="file"
                multiple
                accept=".pdf,.docx,.doc,.txt,.csv,.xlsx,.pptx,.md,.zip,image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    onUploadDocument(e.target.files);
                  }
                }}
              />
              <Upload className="w-5 h-5 mx-auto mb-1 text-violet-400" />
              <span className="text-xs font-bold block text-violet-300">Upload New Document</span>
              <span className="text-[9px] text-slate-500 block mt-0.5">PDF, DOCX, TXT, CSV, Excel, PPTX, MD, Images</span>
            </label>

            {/* Document List */}
            <div className="space-y-2">
              {documents.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs italic">
                  No documents attached to this chat. Upload a file above to begin document Q&A!
                </div>
              ) : (
                documents.map((doc) => {
                  const isSelected = activeDoc?.id === doc.id;
                  return (
                    <div
                      key={doc.id}
                      onClick={() => onSelectDocument(doc.id)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                        isSelected
                          ? 'border-violet-500/50 bg-violet-600/10 shadow-[0_0_15px_rgba(124,58,237,0.15)]'
                          : isDark ? 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05]' : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {getFileIcon(doc.type)}
                          <span className="text-xs font-bold truncate text-slate-200">{doc.name}</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveDocument(doc.id);
                          }}
                          className="text-slate-500 hover:text-red-400 p-1 rounded transition-colors"
                          title="Remove document"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 font-mono border-t border-white/5">
                        <span>{doc.size}</span>
                        <span className="flex items-center gap-1 text-emerald-400">
                          {doc.status === 'ready' ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Ready
                            </>
                          ) : (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin text-amber-400" /> {doc.status}
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeTab === 'prompts' && (
          <div className="space-y-2.5">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-2">
              1-Click Instant Document Actions
            </span>
            {[
              { title: "📄 Summarize Document", prompt: "Provide a comprehensive summary of this document highlighting the key takeaways and chapters." },
              { title: "❓ Generate Quiz Questions", prompt: "Create a 5-question multiple choice quiz based on the core contents of this document with answer explanations." },
              { title: "📊 Extract Key Data & Tables", prompt: "Extract and structure all key statistics, figures, and numerical tables from this document into markdown format." },
              { title: "📝 Convert to Clean Markdown", prompt: "Format the core contents of this document into clean, structured markdown with clear headings." },
              { title: "🔍 Executive Takeaways", prompt: "List the top 5 executive action points and critical insights from this document." }
            ].map((item, idx) => (
              <button
                key={idx}
                onClick={() => onSendQuickPrompt(item.prompt)}
                className={`w-full p-3 rounded-2xl border text-left text-xs font-semibold transition-all cursor-pointer flex items-center justify-between group ${
                  isDark
                    ? 'border-white/[0.06] bg-white/[0.02] hover:bg-violet-600/10 hover:border-violet-500/40 text-slate-200'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800'
                }`}
              >
                <span>{item.title}</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:translate-x-1 transition-transform" />
              </button>
            ))}
          </div>
        )}

        {activeTab === 'outline' && (
          <div className="space-y-3">
            <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Vector Indexing Status</span>
              <div className="space-y-1.5 text-xs font-mono text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-500">Document ID:</span>
                  <span>{activeDoc?.id ? activeDoc.id.substring(0, 8) : 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Indexed Chunks:</span>
                  <span className="text-cyan-400 font-bold">{activeDoc?.chunksIndexed || 12} Chunks</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Tokens:</span>
                  <span className="text-violet-400 font-bold">{activeDoc?.tokens || 3420} Tokens</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">FAISS Index:</span>
                  <span className="text-emerald-400">ACTIVE</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
