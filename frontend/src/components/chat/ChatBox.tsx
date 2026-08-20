'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useChatStore } from '@/store/chatStore';
import { Send, Sparkles, Bot, User, Loader2 } from 'lucide-react';

interface ChatBoxProps {
  onSendMessage: (text: string) => void;
}

export const ChatBox: React.FC<ChatBoxProps> = ({ onSendMessage }) => {
  const { messages, isLoadingMessages, isStreaming } = useChatStore();
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isStreaming) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="py-4 px-6 border-b border-slate-900 bg-slate-900/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Aether Engine V1</h2>
            <p className="text-xs text-slate-500">FastAPI & Sentence-Transformers Pipeline</p>
          </div>
        </div>
      </div>

      {/* Messages Window */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-800">
        {isLoadingMessages ? (
          <div className="h-full flex items-center justify-center flex-col gap-3">
            <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
            <p className="text-sm text-slate-500">Decrypting communication logs...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-900/40 mb-5">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-bold text-slate-200 mb-2">Welcome to AetherChat</h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              This sandbox is powered by Next.js, FastAPI, and SQLAlchemy. Ask any question below to test the Server-Sent Events (SSE) streaming capabilities of Phase 1.
            </p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            {messages.map((msg) => {
              const isAssistant = msg.sender === 'assistant';
              return (
                <div
                  key={msg.id}
                  className={`flex gap-4 ${isAssistant ? 'justify-start' : 'justify-end'}`}
                >
                  {isAssistant && (
                    <div className="w-8 h-8 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400 flex-shrink-0">
                      <Bot className="w-4.5 h-4.5" />
                    </div>
                  )}

                  <div
                    className={`max-w-[80%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed shadow-md ${
                      isAssistant
                        ? 'bg-slate-900 border border-slate-850 text-slate-255'
                        : 'bg-gradient-to-tr from-violet-600 to-indigo-600 text-white'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>

                  {!isAssistant && (
                    <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 flex-shrink-0">
                      <User className="w-4.5 h-4.5" />
                    </div>
                  )}
                </div>
              );
            })}

            {isStreaming && messages[messages.length - 1]?.sender === 'user' && (
              <div className="flex gap-4 justify-start">
                <div className="w-8 h-8 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400 flex-shrink-0">
                  <Bot className="w-4.5 h-4.5" />
                </div>
                <div className="bg-slate-900 border border-slate-850 rounded-2xl px-5 py-3.5 shadow-md flex items-center gap-1">
                  <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Form Footer */}
      <div className="p-4 border-t border-slate-900 bg-slate-950">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto relative flex items-center">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={isStreaming ? 'Synthesizing network packet stream...' : 'Inquire here...'}
            disabled={isStreaming}
            className="w-full pl-5 pr-14 py-4 rounded-2xl bg-slate-900 border border-slate-800 focus:border-violet-600 focus:outline-none text-slate-100 placeholder-slate-550 transition-all duration-200 text-sm"
          />
          <button
            type="submit"
            disabled={isStreaming || !inputText.trim()}
            className="absolute right-2.5 p-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-slate-800 text-white disabled:text-slate-600 transition-all duration-200 shadow-md shadow-violet-950/20"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};

