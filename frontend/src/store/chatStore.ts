/* eslint-disable */
import { create } from 'zustand';

export interface ChatRoom {
  id: string;
  title: string;
  mode: string;
  is_pinned?: boolean;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  chat_id: string;
  sender: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export interface ToastMessage {
  id: number;
  message: string;
  type: 'error' | 'success' | 'info';
}

export interface ModelSettings {
  modelName: string;
  temperature: number;
  systemPrompt: string;
  enableRag: boolean;
  ragK: number;
  geminiApiKey: string;
  openaiApiKey: string;
  cohereApiKey: string;
  replicateApiKey: string;
  anthropicApiKey: string;
  deepseekApiKey: string;
}

export interface ProfileSettings {
  username: string;
  profilePictureUrl: string;
}

export interface AppearanceSettings {
  theme: 'light' | 'dark';
  interfaceStyle: 'Cyberpunk' | 'Minimal' | 'Glassmorphism' | 'Classic' | 'Hacker';
  debugMode: boolean;
}

export interface LanguageSettings {
  textLanguage: string;
  voiceLanguage: string;
}

export interface VoiceSettings {
  accent: string;
  personality: string;
  speed: number;
  pitch: number;
  continuousMode: boolean;
  wakeWord: string;
  wakeWordSensitivity: number;
  activationSoundEnabled: boolean;
  wakeWordEnabled: boolean;
}

interface ChatStoreState {
  chats: ChatRoom[];
  activeChatId: string | null;
  messages: ChatMessage[];
  isLoadingChats: boolean;
  isLoadingMessages: boolean;
  isStreaming: boolean;
  theme: 'light' | 'dark';
  token: string | null;
  user: any | null;
  modelSettings: ModelSettings;
  profileSettings: ProfileSettings;
  appearanceSettings: AppearanceSettings;
  languageSettings: LanguageSettings;
  voiceSettings: VoiceSettings;
  hiddenChatIds: string[];
  lockChats: boolean;
  toasts: ToastMessage[];

  setChats: (chats: ChatRoom[]) => void;
  setLockChats: (val: boolean) => void;
  setActiveChatId: (id: string | null) => void;
  setMessages: (messages: ChatMessage[]) => void;
  setIsLoadingChats: (val: boolean) => void;
  setIsLoadingMessages: (val: boolean) => void;
  setIsStreaming: (val: boolean) => void;
  toggleTheme: () => void;
  setAuth: (token: string | null, user: any | null) => void;
  addMessage: (msg: ChatMessage) => void;
  updateLastMessageChunk: (chunk: string) => void;
  resetChat: () => void;
  setModelSettings: (settings: Partial<ModelSettings>) => void;
  setProfileSettings: (settings: Partial<ProfileSettings>) => void;
  setAppearanceSettings: (settings: Partial<AppearanceSettings>) => void;
  setLanguageSettings: (settings: Partial<LanguageSettings>) => void;
  setVoiceSettings: (settings: Partial<VoiceSettings>) => void;
  hideChat: (chatId: string) => void;
  unhideChat: (chatId: string) => void;
  isSidebarOpen: boolean;
  setSidebarOpen: (val: boolean) => void;
  activeMode: string;
  setActiveMode: (mode: string) => void;
  addToast: (message: string, type?: 'error' | 'success' | 'info') => void;
  removeToast: (id: number) => void;
}

export const useChatStore = create<ChatStoreState>((set) => ({
  chats: [],
  activeChatId: null,
  messages: [],
  toasts: [],
  isLoadingChats: false,
  isLoadingMessages: false,
  isStreaming: false,
  theme: 'dark',
  token: typeof window !== 'undefined' ? (localStorage.getItem('aether_token') || localStorage.getItem('auth_token')) : null,
  user: typeof window !== 'undefined' ? (JSON.parse(localStorage.getItem('aether_user') || 'null') || (localStorage.getItem('user_email') ? { email: localStorage.getItem('user_email'), id: localStorage.getItem('user_id') } : null)) : null,
  modelSettings: {
    modelName:
      typeof window !== 'undefined'
        ? localStorage.getItem('aether_model_name') || 'auto'
        : 'auto',

    temperature:
      typeof window !== 'undefined'
        ? parseFloat(localStorage.getItem('aether_temperature') || '0.7')
        : 0.7,

    systemPrompt:
      typeof window !== 'undefined'
        ? localStorage.getItem('aether_system_prompt') || ''
        : '',

    enableRag:
      typeof window !== 'undefined'
        ? localStorage.getItem('aether_enable_rag') !== 'false'
        : true,

    ragK:
      typeof window !== 'undefined'
        ? parseInt(localStorage.getItem('aether_rag_k') || '3')
        : 3,

    geminiApiKey:
      typeof window !== 'undefined'
        ? localStorage.getItem('aether_gemini_api_key') || ''
        : '',

    openaiApiKey:
      typeof window !== 'undefined'
        ? localStorage.getItem('aether_openai_api_key') || ''
        : '',

    cohereApiKey:
      typeof window !== 'undefined'
        ? localStorage.getItem('aether_cohere_api_key') || ''
        : '',

    replicateApiKey:
      typeof window !== 'undefined'
        ? localStorage.getItem('aether_replicate_api_key') || ''
        : '',
    anthropicApiKey:
      typeof window !== 'undefined'
        ? localStorage.getItem('aether_anthropic_api_key') || ''
        : '',
    deepseekApiKey:
      typeof window !== 'undefined'
        ? localStorage.getItem('aether_deepseek_api_key') || ''
        : '',
  },
  profileSettings: {
    username: typeof window !== 'undefined' ? localStorage.getItem('aether_username') || '' : '',
    profilePictureUrl: typeof window !== 'undefined' ? localStorage.getItem('aether_profile_pic') || '' : '',
  },
  appearanceSettings: {
    theme: typeof window !== 'undefined' ? (localStorage.getItem('theme') as 'light' | 'dark') || 'dark' : 'dark',
    interfaceStyle: typeof window !== 'undefined' ? (localStorage.getItem('aether_interface_style') as 'Cyberpunk' | 'Minimal' | 'Glassmorphism' | 'Classic' | 'Hacker') || 'Classic' : 'Classic',
    debugMode: typeof window !== 'undefined' ? localStorage.getItem('aether_debug_mode') === 'true' : false,
  },
  languageSettings: {
    textLanguage: typeof window !== 'undefined' ? localStorage.getItem('aether_text_language') || 'English' : 'English',
    voiceLanguage: typeof window !== 'undefined' ? localStorage.getItem('aether_voice_language') || 'English' : 'English',
  },
  voiceSettings: {
    accent: typeof window !== 'undefined' ? localStorage.getItem('aether_voice_accent') || 'American' : 'American',
    personality: typeof window !== 'undefined' ? localStorage.getItem('aether_voice_personality') || 'Friendly' : 'Friendly',
    speed: typeof window !== 'undefined' ? parseFloat(localStorage.getItem('aether_voice_speed') || '1.0') : 1.0,
    pitch: typeof window !== 'undefined' ? parseFloat(localStorage.getItem('aether_voice_pitch') || '1.0') : 1.0,
    continuousMode: typeof window !== 'undefined' ? localStorage.getItem('aether_continuous_mode') === 'true' : false,
    wakeWord: typeof window !== 'undefined' ? localStorage.getItem('aether_wake_word') || 'Samrat' : 'Samrat',
    wakeWordSensitivity: typeof window !== 'undefined' ? parseFloat(localStorage.getItem('aether_voice_sensitivity') || '0.5') : 0.5,
    activationSoundEnabled: typeof window !== 'undefined' ? localStorage.getItem('aether_voice_activation_sound') !== 'false' : true,
    wakeWordEnabled: typeof window !== 'undefined' ? localStorage.getItem('aether_wake_word_enabled') !== 'false' : true,
  },
  hiddenChatIds: typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('aether_hidden_chats') || '[]') : [],
  lockChats: typeof window !== 'undefined' ? localStorage.getItem('aether_lock_chats') !== 'false' : true,

  setChats: (chats) => set({ chats }),
  setActiveChatId: (id) => set({ activeChatId: id }),
  setMessages: (messages) => set({ messages }),
  setIsLoadingChats: (val) => set({ isLoadingChats: val }),
  setIsLoadingMessages: (val) => set({ isLoadingMessages: val }),
  setIsStreaming: (val) => set({ isStreaming: val }),
  toggleTheme: () => set((state) => {
    const nextTheme = state.theme === 'light' ? 'dark' : 'light';
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', nextTheme);
      document.documentElement.classList.toggle('dark', nextTheme === 'dark');
    }
    return { theme: nextTheme };
  }),
  setAuth: (token, user) => {
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('aether_token', token);
        localStorage.setItem('aether_user', JSON.stringify(user));
        localStorage.setItem('auth_token', token);
        localStorage.setItem('user_email', user?.email || '');
        localStorage.setItem('user_id', user?.id || '');
      } else {
        localStorage.removeItem('aether_token');
        localStorage.removeItem('aether_user');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_email');
        localStorage.removeItem('user_id');
      }
    }
    set({ token, user });
  },
  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
  updateLastMessageChunk: (chunk) => set((state) => {
    const nextMessages = [...state.messages];
    const lastMsgIndex = nextMessages.length - 1;
    if (lastMsgIndex >= 0 && nextMessages[lastMsgIndex].sender === 'assistant') {
      nextMessages[lastMsgIndex] = {
        ...nextMessages[lastMsgIndex],
        content: nextMessages[lastMsgIndex].content + chunk
      };
    }
    return { messages: nextMessages };
  }),
  resetChat: () => set({ messages: [], activeChatId: null }),
  setModelSettings: (settings) => set((state) => {
    const nextSettings = { ...state.modelSettings, ...settings };
    if (typeof window !== 'undefined') {
      localStorage.setItem('aether_model_name', nextSettings.modelName);
      localStorage.setItem('aether_temperature', nextSettings.temperature.toString());
      localStorage.setItem('aether_system_prompt', nextSettings.systemPrompt);
      localStorage.setItem('aether_enable_rag', nextSettings.enableRag.toString());
      localStorage.setItem('aether_rag_k', nextSettings.ragK.toString());
      localStorage.setItem('aether_gemini_api_key', nextSettings.geminiApiKey);
      localStorage.setItem('aether_openai_api_key', nextSettings.openaiApiKey);
      localStorage.setItem('aether_cohere_api_key', nextSettings.cohereApiKey);
      localStorage.setItem('aether_replicate_api_key', nextSettings.replicateApiKey);
      localStorage.setItem('aether_anthropic_api_key', nextSettings.anthropicApiKey);
      localStorage.setItem('aether_deepseek_api_key', nextSettings.deepseekApiKey);
    }
    return { modelSettings: nextSettings };
  }),
  setProfileSettings: (settings) => set((state) => {
    const nextSettings = { ...state.profileSettings, ...settings };
    if (typeof window !== 'undefined') {
      localStorage.setItem('aether_username', nextSettings.username);
      localStorage.setItem('aether_profile_pic', nextSettings.profilePictureUrl);
    }
    return { profileSettings: nextSettings };
  }),
  setAppearanceSettings: (settings) => set((state) => {
    const nextSettings = { ...state.appearanceSettings, ...settings };
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', nextSettings.theme);
      localStorage.setItem('aether_interface_style', nextSettings.interfaceStyle);
      localStorage.setItem('aether_debug_mode', nextSettings.debugMode.toString());
      document.documentElement.classList.toggle('dark', nextSettings.theme === 'dark');
      document.documentElement.setAttribute('data-theme', nextSettings.interfaceStyle.toLowerCase());
    }
    return { appearanceSettings: nextSettings };
  }),
  setLanguageSettings: (settings) => set((state) => {
    const nextSettings = { ...state.languageSettings, ...settings };
    if (typeof window !== 'undefined') {
      localStorage.setItem('aether_text_language', nextSettings.textLanguage);
      localStorage.setItem('aether_voice_language', nextSettings.voiceLanguage);
    }
    return { languageSettings: nextSettings };
  }),
  setVoiceSettings: (settings) => set((state) => {
    const nextSettings = { ...state.voiceSettings, ...settings };
    if (typeof window !== 'undefined') {
      localStorage.setItem('aether_voice_accent', nextSettings.accent);
      localStorage.setItem('aether_voice_personality', nextSettings.personality);
      localStorage.setItem('aether_voice_speed', nextSettings.speed.toString());
      localStorage.setItem('aether_voice_pitch', nextSettings.pitch.toString());
      localStorage.setItem('aether_continuous_mode', nextSettings.continuousMode.toString());
      localStorage.setItem('aether_wake_word', nextSettings.wakeWord);
      localStorage.setItem('aether_voice_sensitivity', nextSettings.wakeWordSensitivity.toString());
      localStorage.setItem('aether_voice_activation_sound', nextSettings.activationSoundEnabled.toString());
    }
    return { voiceSettings: nextSettings };
  }),
  hideChat: (chatId) => set((state) => {
    const nextHidden = [...state.hiddenChatIds, chatId];
    if (typeof window !== 'undefined') {
      localStorage.setItem('aether_hidden_chats', JSON.stringify(nextHidden));
    }
    return { hiddenChatIds: nextHidden };
  }),
  unhideChat: (chatId) => set((state) => {
    const nextHidden = state.hiddenChatIds.filter(id => id !== chatId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('aether_hidden_chats', JSON.stringify(nextHidden));
    }
    return { hiddenChatIds: nextHidden };
  }),
  setLockChats: (val) => set(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('aether_lock_chats', val.toString());
    }
    return { lockChats: val };
  }),
  isSidebarOpen: false,
  activeMode: 'general',
  setSidebarOpen: (val) => set({ isSidebarOpen: val }),
  setActiveMode: (mode) => set({ activeMode: mode }),
  addToast: (message, type = 'error') => set((state) => {
    const id = Date.now();
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter(t => t.id !== id) }));
    }, 4000);
    return { toasts: [...state.toasts, { id, message, type }] };
  }),
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) })),
}));
