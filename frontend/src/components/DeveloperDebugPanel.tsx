'use client';
import React, { useState, useEffect } from 'react';
import { useChatStore } from '@/store/chatStore';
import { Terminal, Shield, Activity, Cpu, X, RefreshCw, Zap } from 'lucide-react';

export function DeveloperDebugPanel() {
  const { appearanceSettings, modelSettings, activeChatId, messages, isStreaming } = useChatStore();
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [lastLatency, setLastLatency] = useState<number>(120);

  useEffect(() => {
    if (isStreaming) {
      const startTime = Date.now();
      const interval = setInterval(() => {
        setLastLatency(Date.now() - startTime);
      }, 50);
      return () => clearInterval(interval);
    }
  }, [isStreaming]);

  if (!appearanceSettings.debugMode) return null;

  const lastUserMsg = [...messages].reverse().find(m => m.sender === 'user');
  const lastBotMsg = [...messages].reverse().find(m => m.sender === 'assistant');

  return (
    <>
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-20 right-6 z-50 p-2.5 rounded-full bg-slate-900 border border-violet-500/40 text-violet-400 shadow-xl shadow-violet-950/40 hover:scale-105 transition-all flex items-center gap-2 cursor-pointer font-mono text-xs"
          title="Open Developer Debug Console"
        >
          <Terminal className="w-4 h-4 text-violet-400 animate-pulse" />
          <span className="font-bold text-[10px] hidden sm:inline">DEBUG</span>
        </button>
      )}

      {/* Debug Overlay Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-96 max-w-[90vw] bg-[#070913]/95 border border-violet-500/30 backdrop-blur-2xl rounded-2xl shadow-2xl p-4 text-slate-300 font-mono text-xs animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-violet-500/20 mb-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-violet-400" />
              <span className="font-extrabold tracking-wider text-white text-xs">DEVELOPER DEBUG PANEL</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            <div className="flex justify-between items-center bg-white/[0.03] p-2 rounded-lg border border-white/5">
              <span className="text-slate-400 text-[10px] uppercase font-bold">Model</span>
              <span className="text-cyan-400 font-bold text-xs">{modelSettings.modelName}</span>
            </div>

            <div className="flex justify-between items-center bg-white/[0.03] p-2 rounded-lg border border-white/5">
              <span className="text-slate-400 text-[10px] uppercase font-bold">Status</span>
              <span className={`font-bold text-xs flex items-center gap-1 ${isStreaming ? 'text-amber-400 animate-pulse' : 'text-emerald-400'}`}>
                <Activity className="w-3 h-3" />
                {isStreaming ? 'Streaming Token Stream...' : 'Idle / Ready'}
              </span>
            </div>

            <div className="flex justify-between items-center bg-white/[0.03] p-2 rounded-lg border border-white/5">
              <span className="text-slate-400 text-[10px] uppercase font-bold">Latency</span>
              <span className="text-violet-300 font-bold text-xs">{lastLatency} ms</span>
            </div>

            <div className="flex justify-between items-center bg-white/[0.03] p-2 rounded-lg border border-white/5">
              <span className="text-slate-400 text-[10px] uppercase font-bold">RAG Mode</span>
              <span className={`font-bold text-[10px] px-1.5 py-0.5 rounded ${modelSettings.enableRag ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
                {modelSettings.enableRag ? `ACTIVE (k=${modelSettings.ragK})` : 'DISABLED'}
              </span>
            </div>

            <div className="bg-white/[0.02] p-2 rounded-lg border border-white/5 space-y-1">
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Last Prompt Sent</span>
              <p className="text-[10px] text-slate-300 truncate italic">
                {lastUserMsg ? lastUserMsg.content : 'No prompt sent yet'}
              </p>
            </div>

            <div className="bg-white/[0.02] p-2 rounded-lg border border-white/5 space-y-1">
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Response Stream Chunk Count</span>
              <p className="text-[10px] text-emerald-400">
                {lastBotMsg ? `${lastBotMsg.content.length} characters received` : '0 bytes'}
              </p>
            </div>

            <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1">
              <span>Chat ID: {activeChatId ? activeChatId.substring(0, 8) + '...' : 'None'}</span>
              <span>Temp: {modelSettings.temperature}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
