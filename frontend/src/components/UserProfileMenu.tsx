/* eslint-disable */
'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  User,
  Shield,
  Settings,
  CreditCard,
  Zap,
  Key,
  Smartphone,
  Keyboard,
  HelpCircle,
  MessageSquarePlus,
  Info,
  LogOut,
  ChevronDown,
  UserCheck,
  Globe,
  Sliders,
  Sparkles,
  Lock,
  Radio
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { apiService } from '@/services/api';
import { useChatStore } from '@/store/chatStore';

interface UserProfileMenuProps {
  onOpenSettingsTab: (tab: string) => void;
  onOpenShortcutsModal: () => void;
  onOpenAboutModal: () => void;
  onOpenFeedbackModal: () => void;
  isDark?: boolean;
}

export function UserProfileMenu({
  onOpenSettingsTab,
  onOpenShortcutsModal,
  onOpenAboutModal,
  onOpenFeedbackModal,
  isDark = true
}: UserProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { email, userId, logout } = useAuth();
  const { profileSettings, setAuth, setActiveChatId, setMessages, setChats } = useChatStore();
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayName = (profileSettings.username || email || 'Authorized User').replace(/<[^>]*>/g, '');
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const handlePerformLogout = async (allDevices = false) => {
    setIsOpen(false);
    try {
      if (allDevices) {
        const token = localStorage.getItem('auth_token') || localStorage.getItem('aether_token');
        if (token) {
          await apiService.logoutAllDevices(token).catch(() => {});
        }
      } else {
        await apiService.logout().catch(() => {});
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      // Complete state invalidation
      logout();
      setAuth(null, null);
      setActiveChatId(null);
      setMessages([]);
      setChats([]);
      localStorage.clear();
      sessionStorage.clear();
      document.cookie.split(';').forEach((c) => {
        document.cookie = c
          .replace(/^ +/, '')
          .replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/');
      });
      window.location.reload();
    }
  };

  const handleSelectMenuItem = (action: () => void) => {
    setIsOpen(false);
    action();
  };

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      {/* Profile Avatar Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 p-1.5 rounded-xl border transition-all cursor-pointer ${
          isOpen
            ? 'border-violet-500 bg-violet-600/20 text-white shadow-[0_0_15px_rgba(124,58,237,0.3)]'
            : isDark
            ? 'border-white/10 bg-white/[0.02] text-slate-300 hover:bg-white/[0.06] hover:text-white'
            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
        }`}
        title="User Account Menu"
      >
        <div className="relative">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-violet-600 to-cyan-500 flex items-center justify-center font-bold text-white text-[11px] shadow-sm">
            {initials || <User className="w-4 h-4" />}
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-slate-950 animate-pulse" />
        </div>
        <span className="text-xs font-semibold max-w-[120px] truncate hidden md:inline-block">
          {displayName}
        </span>
        <ChevronDown className="w-3.5 h-3.5 opacity-60" />
      </button>

      {/* Glassmorphism Profile Menu Dropdown */}
      {isOpen && (
        <div
          className={`absolute right-0 mt-2 w-72 rounded-2xl border shadow-2xl z-50 overflow-hidden backdrop-blur-xl animate-in fade-in zoom-in-95 ${
            isDark
              ? 'bg-slate-950/95 border-violet-500/20 text-white shadow-violet-950/50'
              : 'bg-white/95 border-slate-200 text-slate-800 shadow-slate-300/50'
          }`}
        >
          {/* Account Profile Header */}
          <div className="p-4 border-b border-white/10 bg-gradient-to-r from-violet-950/30 to-slate-900/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white font-extrabold text-sm shadow-md">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-xs font-black tracking-tight block truncate text-white">{displayName}</span>
                <span className="text-[10px] font-mono text-slate-400 block truncate">{email || 'google_user@samrat.ai'}</span>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[9px] font-extrabold uppercase tracking-wider">
                    PRO SUBSCRIBER
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="max-h-[380px] overflow-y-auto p-1.5 space-y-0.5 scrollbar-thin">
            {/* Group 1: Profile & Core Account */}
            <MenuItem icon={User} label="Profile" onClick={() => handleSelectMenuItem(() => onOpenSettingsTab('profile'))} isDark={isDark} />
            <MenuItem icon={UserCheck} label="Account" onClick={() => handleSelectMenuItem(() => onOpenSettingsTab('account'))} isDark={isDark} />
            <MenuItem icon={Shield} label="Security" badge="WebAuthn" onClick={() => handleSelectMenuItem(() => onOpenSettingsTab('security'))} isDark={isDark} />
            <MenuItem icon={Settings} label="Settings" onClick={() => handleSelectMenuItem(() => onOpenSettingsTab('general'))} isDark={isDark} />

            <div className="h-px bg-white/10 my-1" />

            {/* Group 2: Subscription & AI Providers */}
            <MenuItem icon={Sparkles} label="Subscription" badge="Pro Tier" onClick={() => handleSelectMenuItem(() => onOpenSettingsTab('subscription'))} isDark={isDark} />
            <MenuItem icon={CreditCard} label="Billing" onClick={() => handleSelectMenuItem(() => onOpenSettingsTab('billing'))} isDark={isDark} />
            <MenuItem icon={Zap} label="Connected Providers" badge="11 Active" onClick={() => handleSelectMenuItem(() => onOpenSettingsTab('providers'))} isDark={isDark} />
            <MenuItem icon={Smartphone} label="Trusted Devices" onClick={() => handleSelectMenuItem(() => onOpenSettingsTab('security'))} isDark={isDark} />

            <div className="h-px bg-white/10 my-1" />

            {/* Group 3: App Controls & Support */}
            <MenuItem icon={Keyboard} label="Keyboard Shortcuts" shortcut="⌘K" onClick={() => handleSelectMenuItem(onOpenShortcutsModal)} isDark={isDark} />
            <MenuItem icon={HelpCircle} label="Help & Documentation" onClick={() => handleSelectMenuItem(() => window.open('https://github.com/KAVATIJOHNSHREYAN/SAMRAT-AETHERMIND-V3', '_blank'))} isDark={isDark} />
            <MenuItem icon={MessageSquarePlus} label="Feedback" onClick={() => handleSelectMenuItem(onOpenFeedbackModal)} isDark={isDark} />
            <MenuItem icon={Info} label="About SAMRAT AI" onClick={() => handleSelectMenuItem(onOpenAboutModal)} isDark={isDark} />

            <div className="h-px bg-white/10 my-1" />

            {/* Group 4: Sign Out Commands */}
            <button
              onClick={() => handlePerformLogout(false)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-red-400 hover:bg-red-950/40 hover:text-red-300 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <LogOut className="w-4 h-4 text-red-400" />
                <span>Sign Out</span>
              </div>
            </button>

            <button
              onClick={() => handlePerformLogout(true)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-extrabold text-red-500 bg-red-950/20 border border-red-500/20 hover:bg-red-900/40 hover:border-red-500/40 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Lock className="w-4 h-4 text-red-400" />
                <span>Sign Out All Devices</span>
              </div>
              <span className="text-[9px] uppercase font-bold text-red-400">Global</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface MenuItemProps {
  icon: React.ElementType;
  label: string;
  badge?: string;
  shortcut?: string;
  onClick: () => void;
  isDark?: boolean;
}

function MenuItem({ icon: Icon, label, badge, shortcut, onClick, isDark }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
        isDark
          ? 'text-slate-300 hover:bg-white/[0.04] hover:text-white'
          : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <Icon className="w-4 h-4 text-slate-400" />
        <span>{label}</span>
      </div>
      {badge && (
        <span className="px-1.5 py-0.5 rounded bg-violet-600/20 text-violet-300 border border-violet-500/30 text-[9px] font-bold">
          {badge}
        </span>
      )}
      {shortcut && <span className="text-[10px] font-mono text-slate-500 font-bold">{shortcut}</span>}
    </button>
  );
}
