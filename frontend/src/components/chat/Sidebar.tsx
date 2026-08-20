/* eslint-disable */
'use client';

import React from 'react';
import { useChatStore, ChatRoom } from '@/store/chatStore';
import { MessageSquare, Plus, Trash2, LogOut, Sun, Moon, Sparkles } from 'lucide-react';

interface SidebarProps {
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onNewChat, onSelectChat, onLogout }) => {
  const { chats, activeChatId, theme, toggleTheme, user } = useChatStore();

  return (
    <aside className="w-80 h-full flex flex-col bg-slate-900 border-r border-slate-800 text-slate-100 select-none">
      {/* Sidebar Header / Logo */}
      <div className="p-5 flex items-center justify-between border-b border-slate-850">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-md">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-indigo-200">
              AetherChat
            </h1>
            <span className="text-xs text-slate-500 font-medium">Enterprise AI Engine</span>
          </div>
        </div>

        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
          title="Toggle Theme"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      {/* New Chat Button */}
      <div className="p-4">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium text-sm transition-all duration-200 shadow-lg shadow-indigo-900/30 hover:shadow-indigo-850/40"
        >
          <Plus className="w-4 h-4" />
          New Conversation
        </button>
      </div>

      {/* Chat History List */}
      <div className="flex-1 overflow-y-auto px-3 space-y-1 scrollbar-thin scrollbar-thumb-slate-800">
        <div className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Recent Dialogues
        </div>

        {chats.length === 0 ? (
          <div className="text-center py-8 text-sm text-slate-500">
            No active conversations
          </div>
        ) : (
          chats.map((chat) => {
            const isActive = chat.id === activeChatId;
            return (
              <button
                key={chat.id}
                onClick={() => onSelectChat(chat.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm transition-all duration-150 ${
                  isActive
                    ? 'bg-slate-800 text-slate-100 font-semibold border-l-4 border-violet-500'
                    : 'text-slate-400 hover:bg-slate-850 hover:text-slate-200'
                }`}
              >
                <MessageSquare className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-violet-400' : 'text-slate-500'}`} />
                <span className="truncate flex-1">{chat.title}</span>
              </button>
            );
          })
        )}
      </div>

      {/* Sidebar Footer User Info */}
      <div className="p-4 border-t border-slate-850 bg-slate-950 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center font-bold text-violet-400 border border-slate-700">
            {user?.email?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate text-slate-200">
              {user?.email || 'Guest User'}
            </p>
            <p className="text-xs text-violet-400 font-medium capitalize">
              {user?.subscription_status || 'Free Tier'}
            </p>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-red-950/40 hover:border-red-900/40 text-slate-400 hover:text-red-400 text-xs font-semibold transition-colors duration-200"
        >
          <LogOut className="w-3.5 h-3.5" />
          Terminate Session
        </button>
      </div>
    </aside>
  );
};

