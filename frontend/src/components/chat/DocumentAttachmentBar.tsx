'use client';
import React from 'react';
import { FileText, FileSpreadsheet, FileCode, File, X, Sparkles, Eye, Download, Layers } from 'lucide-react';
import { DocumentItem } from './DocumentDrawer';

interface DocumentAttachmentBarProps {
  documents: DocumentItem[];
  activeDocumentId: string | null;
  onSelectDocument: (id: string) => void;
  onRemoveDocument: (id: string) => void;
  onToggleDrawer: () => void;
  isDark?: boolean;
}

export function DocumentAttachmentBar({
  documents,
  activeDocumentId,
  onSelectDocument,
  onRemoveDocument,
  onToggleDrawer,
  isDark = true
}: DocumentAttachmentBarProps) {
  if (documents.length === 0) return null;

  const getFileIcon = (fileType: string) => {
    const t = fileType.toLowerCase();
    if (t.includes('pdf')) return <FileText className="w-4 h-4 text-red-400" />;
    if (t.includes('sheet') || t.includes('csv') || t.includes('excel')) return <FileSpreadsheet className="w-4 h-4 text-emerald-400" />;
    if (t.includes('code') || t.includes('json') || t.includes('md')) return <FileCode className="w-4 h-4 text-cyan-400" />;
    return <File className="w-4 h-4 text-violet-400" />;
  };

  return (
    <div className="w-full max-w-3xl mx-auto flex items-center justify-between gap-2 px-2 py-1.5 overflow-x-auto">
      <div className="flex items-center gap-2 overflow-x-auto py-1">
        {documents.map((doc) => {
          const isActive = doc.id === activeDocumentId;
          return (
            <div
              key={doc.id}
              onClick={() => onSelectDocument(doc.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold cursor-pointer transition-all shrink-0 ${
                isActive
                  ? 'border-violet-500/60 bg-violet-600/20 text-violet-300 shadow-[0_0_12px_rgba(124,58,237,0.2)]'
                  : isDark ? 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10' : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {getFileIcon(doc.type)}
              <span className="truncate max-w-[160px]">{doc.name}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveDocument(doc.id);
                }}
                className="p-0.5 rounded-full hover:bg-white/20 text-slate-400 hover:text-white"
                title="Remove attachment"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onToggleDrawer}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition-all shrink-0 cursor-pointer ${
          isDark ? 'border-violet-500/40 bg-violet-650/15 text-violet-300 hover:bg-violet-650/30' : 'border-slate-200 bg-white text-slate-700'
        }`}
        title="Open DocMind Intelligence Drawer"
      >
        <Layers className="w-3.5 h-3.5 text-violet-400" />
        <span className="hidden sm:inline">DocMind Panel</span>
      </button>
    </div>
  );
}
