'use client';

import React, { useState, useEffect } from 'react';
import { useChatStore, ChatRoom, ChatMessage } from '@/store/chatStore';
import { apiService } from '@/services/api';
import { useVoice } from '@/hooks/useVoice';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { VortexVisualizer } from '@/components/chat/VortexVisualizer';
import { useAuth } from '@/context/AuthContext';
import {
  MessageSquare,
  Mic,
  ArrowRight,
  ChevronRight,
  Bell,
  Sparkles,
  ArrowLeft,
  Keyboard,
  Bookmark,
  Send,
  Loader2,
  Trash2,
  Lock,
  Mail,
  User,
  Bot,
  Settings,
  LogOut,
  Upload,
  X,
  Pin,
  Search,
  Edit2,
  MoreVertical,
  LayoutGrid,
  Eye,
  EyeOff,
  TrendingUp,
  Activity,
  Code,
  Briefcase,
  Menu,
  Sun,
  Moon,
  Paperclip,
  Check,
  Plus,
  LayoutTemplate,
  Zap,
  Minus,
  Layers,
  Terminal,
  FileText,
  Image,
  ShieldCheck,
  Fingerprint,
  ScanFace
} from 'lucide-react';

// Helper to render message content with media blocks
function renderMessageContent(content: string) {
  if (!content) return null;

  // Pattern to match markdown images: ![alt](url)
  // Pattern to match video tags: <video src="url" ... />
  // We can use a single regex to parse and split the content sequentially.
  const mediaRegex = /(?:!\[([^\]]*)\]\(([^)]+)\))|(?:<video\s+[^>]*src="([^"]+)"[^>]*\/>)|(?:<video\s+src="([^"]+)"[^>]*\/>)/g;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = mediaRegex.exec(content)) !== null) {
    const matchIndex = match.index;

    // Add preceding text if any
    if (matchIndex > lastIndex) {
      const text = content.substring(lastIndex, matchIndex);
      parts.push(
        <span key={`text-${key++}`} className="whitespace-pre-wrap block mb-2">
          {text}
        </span>
      );
    }

    // Check if it's an image: match[1] (alt text) and match[2] (url)
    if (match[2] !== undefined) {
      const alt = match[1] || 'Generated Image';
      const src = match[2];
      parts.push(
        <div key={`img-${key++}`} className="my-3 rounded-2xl overflow-hidden border border-slate-800 shadow-md group relative max-w-lg">
          <img
            src={src}
            alt={alt}
            className="w-full max-h-[400px] object-cover transition-transform duration-300 group-hover:scale-[1.01]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
            <a
              href={src}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 bg-violet-600 hover:bg-violet-550 text-white rounded-lg text-[10px] font-bold"
            >
              Open original
            </a>
          </div>
        </div>
      );
    }
    // Check if it's a video: match[3] or match[4] (url)
    else {
      const src = match[3] || match[4];
      if (src) {
        parts.push(
          <div key={`vid-${key++}`} className="my-3 rounded-2xl overflow-hidden border border-violet-850/50 shadow-lg shadow-violet-950/30 bg-slate-950 max-w-lg">
            <video
              src={src}
              controls
              className="w-full aspect-video rounded-2xl"
            />
          </div>
        );
      }
    }

    lastIndex = mediaRegex.lastIndex;
  }

  // Add trailing text
  if (lastIndex < content.length) {
    const text = content.substring(lastIndex);
    parts.push(
      <span key={`text-${key++}`} className="whitespace-pre-wrap block">
        {text}
      </span>
    );
  }

  return <div className="space-y-1">{parts}</div>;
}

export default function Home() {
  const { logout, login: authLogin } = useAuth();
  const {
    token,
    user,
    chats,
    activeChatId,
    messages,
    setAuth,
    setChats,
    setActiveChatId,
    setMessages,
    addMessage,
    updateLastMessageChunk,
    isLoadingChats,
    isLoadingMessages,
    setIsLoadingChats,
    setIsLoadingMessages,
    isStreaming,
    setIsStreaming,
    modelSettings,
    setModelSettings,
    profileSettings,
    setProfileSettings,
    appearanceSettings,
    setAppearanceSettings,
    languageSettings,
    setLanguageSettings,
    voiceSettings,
    setVoiceSettings,
    hiddenChatIds,
    hideChat,
    unhideChat,
    lockChats,
    setLockChats,
    isSidebarOpen,
    setSidebarOpen,
    activeMode,
    setActiveMode
  } = useChatStore();

  const isHacker = appearanceSettings.interfaceStyle === 'Hacker';

  // Screen routing state
  const [activeScreen, setActiveScreen] = useState<'splash' | 'dashboard' | 'chat' | 'voice'>('splash');

  // Auth state
  const [isLoginView, setIsLoginView] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState<'fingerprint' | 'face' | null>(null);

  // WebAuthn Biometric Authentication Handler
  const handleBiometricAuth = async (mode: 'fingerprint' | 'face') => {
    setBiometricLoading(mode);
    setAuthError(null);

    try {
      // Check if WebAuthn is supported
      if (!window.PublicKeyCredential) {
        throw new Error('Biometric authentication is not supported on this device/browser.');
      }

      // Check platform authenticator availability (fingerprint/face scanner)
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (!available) {
        throw new Error(
          mode === 'fingerprint'
            ? 'No fingerprint scanner detected. Please use a device with biometric hardware.'
            : 'No face recognition hardware detected. Please use a device with biometric hardware.'
        );
      }

      // Generate a random challenge for the WebAuthn ceremony
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      // Create a credential — this triggers the native biometric prompt
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: {
            name: 'SAMRAT AI',
            id: window.location.hostname,
          },
          user: {
            id: new Uint8Array(16).map(() => Math.floor(Math.random() * 256)),
            name: mode === 'fingerprint' ? 'fingerprint_user@samrat.ai' : 'faceid_user@samrat.ai',
            displayName: mode === 'fingerprint' ? 'Fingerprint User' : 'Face ID User',
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' },   // ES256
            { alg: -257, type: 'public-key' },  // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
            residentKey: 'preferred',
          },
          timeout: 60000,
          attestation: 'none',
        },
      });

      if (credential) {
        // Biometric verification succeeded — fetch real token from backend
        const data = await apiService.biometricLogin(mode);
        const biometricEmail = mode === 'fingerprint' ? 'fingerprint_user@samrat.ai' : 'faceid_user@samrat.ai';
        
        // Sync AuthContext (used by ProtectedRoute)
        authLogin(data.access_token, data.user_id, biometricEmail);
        // Sync chatStore
        setAuth(data.access_token, {
          email: biometricEmail,
          id: data.user_id,
          subscription_status: 'premium',
        });
        setActiveScreen('chat');
      }
    } catch (err: any) {
      // User cancelled or hardware not available
      const message = err?.name === 'NotAllowedError'
        ? 'Biometric verification was cancelled or timed out.'
        : err?.name === 'InvalidStateError'
        ? 'A credential already exists. Verifying identity...'
        : err?.message || 'Biometric authentication failed.';

      // If InvalidStateError, the user already registered — try to authenticate instead
      if (err?.name === 'InvalidStateError') {
        try {
          const challenge2 = new Uint8Array(32);
          crypto.getRandomValues(challenge2);
          const assertion = await navigator.credentials.get({
            publicKey: {
              challenge: challenge2,
              rpId: window.location.hostname,
              userVerification: 'required',
              timeout: 60000,
            },
          });
          if (assertion) {
            const data = await apiService.biometricLogin(mode);
            const biometricEmail2 = mode === 'fingerprint' ? 'fingerprint_user@samrat.ai' : 'faceid_user@samrat.ai';
            authLogin(data.access_token, data.user_id, biometricEmail2);
            setAuth(data.access_token, {
              email: biometricEmail2,
              id: data.user_id,
              subscription_status: 'premium',
            });
            setActiveScreen('chat');
            setBiometricLoading(null);
            return;
          }
        } catch {
          setAuthError('Biometric verification failed. Please try again.');
        }
      } else {
        setAuthError(message);
      }
    } finally {
      setBiometricLoading(null);
    }
  };

  // Settings modal states
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<'model' | 'rag' | 'profile' | 'appearance' | 'language' | 'voice'>('profile');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Attachment state
  const [chatAttachment, setChatAttachment] = useState<{ name: string, type: string, data: string } | null>(null);

  // Chat management state
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [chatEditId, setChatEditId] = useState<string | null>(null);
  const [chatEditTitle, setChatEditTitle] = useState('');

  // Context Menu & Long Press states
  const [contextMenuChat, setContextMenuChat] = useState<ChatRoom | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number, y: number } | null>(null);
  const longPressTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleContextMenu = (e: React.MouseEvent, chat: ChatRoom) => {
    e.preventDefault();
    setContextMenuChat(chat);
    setContextMenuPos({ x: e.clientX, y: e.clientY });
  };

  const handleTouchStart = (chat: ChatRoom) => {
    longPressTimerRef.current = setTimeout(() => {
      setContextMenuChat(chat);
      setContextMenuPos({ x: window.innerWidth / 2 - 100, y: window.innerHeight / 2 - 100 });
    }, 600);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
  };

  const starterPrompts = [
    { text: "Draft an email", desc: "Write a professional message to clients", icon: Mail, prompt: "Draft a professional email to request project feedback from clients." },
    { text: "Debug React hook", desc: "Fix state synchronization issues", icon: Code, prompt: "Help me debug a React hook where dependency arrays are causing infinite re-renders." },
    { text: "Brainstorm ideas", desc: "Creative concepts for branding", icon: Sparkles, prompt: "Brainstorm 5 creative branding names and concepts for a futuristic AI company." },
    { text: "Analyze data", desc: "Interpret trends and insights", icon: TrendingUp, prompt: "Analyze the key metrics of a tech startup to identify expansion bottlenecks." }
  ];

  const handleStarterPrompt = async (prompt: string) => {
    if (!token) return;
    if (isStreaming || isLoadingMessages) return;
    setIsStreaming(true);
    try {
      const newChat = await apiService.createChat(token!, prompt.substring(0, 30), 'general');
      setChats([newChat, ...chats]);
      setActiveChatId(newChat.id);
      setMessages([]);
      setActiveScreen('chat');

      // Add User Message
      const userMsg: ChatMessage = {
        id: Math.random().toString(),
        chat_id: newChat.id,
        sender: 'user',
        content: prompt,
        created_at: new Date().toISOString()
      };
      // Add Assistant placeholder message
      const assistantMsg: ChatMessage = {
        id: Math.random().toString(),
        chat_id: newChat.id,
        sender: 'assistant',
        content: '',
        created_at: new Date().toISOString()
      };

      setMessages([userMsg, assistantMsg]);
      setIsStreaming(true);

      let accumulatedReply = '';
      await apiService.sendMessageStream(
        token!,
        newChat.id,
        prompt,
        modelSettings,
        null,
        (chunk) => {
          updateLastMessageChunk(chunk);
        },
        async () => {
          setIsStreaming(false);
          loadChats();
        }
      );
    } catch (err) {
      console.error(err);
      setIsStreaming(false);
    }
  };

  // Close context menu on window click
  useEffect(() => {
    const handleGlobalClick = () => {
      setContextMenuPos(null);
    };
    if (contextMenuPos) {
      window.addEventListener('click', handleGlobalClick);
    }
    return () => {
      window.removeEventListener('click', handleGlobalClick);
    };
  }, [contextMenuPos]);

  // Message auto-scrolling
  const messagesEndRef = React.useRef<HTMLDivElement | null>(null);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  useEffect(() => {
    if (activeScreen === 'chat' || activeScreen === 'dashboard') {
      scrollToBottom();
    }
  }, [messages, isStreaming, activeScreen]);

  // Speaking state for greeting
  const greetingSpokenRef = React.useRef(false);
  const speakGreeting = (force = false) => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      if (greetingSpokenRef.current && !force) return;
      greetingSpokenRef.current = true;

      const text = "Hi! I am Echo, your personal assistant.";
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      const voices = window.speechSynthesis.getVoices();
      const usVoice = voices.find(v =>
        v.lang === 'en-US' ||
        v.name.includes('Google US') ||
        v.name.includes('Zira') ||
        v.name.includes('David') ||
        v.name.toLowerCase().includes('united states')
      );
      if (usVoice) utterance.voice = usVoice;
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        setChatAttachment({
          name: file.name,
          type: file.type,
          data: base64String
        });
      };
      reader.readAsDataURL(file);
    }
  };

  // Chat window inputs
  const [chatInput, setChatInput] = useState('');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceReplyText, setVoiceReplyText] = useState('Welcome! Click the microphone below to talk.');

  // Prevent hydration mismatch
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);

    // Global fetch interceptor to handle expired sessions (401 Unauthorized) gracefully
    if (typeof window !== 'undefined') {
      const originalFetch = window.fetch;
      window.fetch = async function (...args) {
        const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url || '';
        const response = await originalFetch.apply(this, args);
        if (response.status === 401 && !url.includes('/auth/login') && !url.includes('/auth/register')) {
          console.warn('Unauthorized session detected. Clearing credentials.');
          localStorage.removeItem('aether_token');
          localStorage.removeItem('aether_user');
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user_email');
          localStorage.removeItem('user_id');
          window.location.reload();
        }
        return response;
      };
    }
  }, []);

  // Theme observer
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const html = document.documentElement;
      if (appearanceSettings.theme === 'dark') {
        html.classList.add('dark');
        html.classList.remove('light');
      } else {
        html.classList.add('light');
        html.classList.remove('dark');
      }
      html.setAttribute('data-theme', appearanceSettings.interfaceStyle.toLowerCase());
    }
  }, [appearanceSettings.theme, appearanceSettings.interfaceStyle]);

  // Handle welcome greeting on splash page
  useEffect(() => {
    if (activeScreen === 'splash' && mounted) {
      greetingSpokenRef.current = false;
      const timer = setTimeout(() => {
        speakGreeting();
      }, 500);

      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = () => {
          speakGreeting();
        };
      }

      return () => {
        clearTimeout(timer);
        if (typeof window !== 'undefined' && window.speechSynthesis) {
          window.speechSynthesis.onvoiceschanged = null;
        }
      };
    }
  }, [activeScreen, mounted]);

  // Load chat rooms and automatically bypass splash if authenticated
  useEffect(() => {
    if (token) {
      loadChats();
      setActiveScreen('chat');
    }
  }, [token]);

  const loadChats = async () => {
    if (!token) return;
    setIsLoadingChats(true);
    try {
      const data = await apiService.getChats(token!);
      setChats(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingChats(false);
    }
  };

  // Initialize Voice Assistant hooks
  const {
    isListening,
    isSpeaking,
    startListening,
    stopListening,
    speak,
    stopSpeaking
  } = useVoice({
    onTranscript: async (text) => {
      // Wake Word filter
      if (voiceSettings.wakeWord) {
        const wakeWordLower = voiceSettings.wakeWord.toLowerCase();
        if (!text.toLowerCase().includes(wakeWordLower)) {
          setVoiceReplyText(`(Waiting for wake word "${voiceSettings.wakeWord}")\nHeard: "${text}"`);
          return;
        }
      }

      setVoiceTranscript(text);
      setVoiceReplyText(`Analyzing: "${text}"`);

      // Process voice message through backend API
      try {
        let currentChatId = activeChatId;
        if (!currentChatId) {
          const newChat = await apiService.createChat(token!, 'Voice Interaction', 'voice');
          setChats([newChat, ...chats]);
          setActiveChatId(newChat.id);
          currentChatId = newChat.id;
        }

        // Save User msg in DB
        const userMsg: ChatMessage = {
          id: Math.random().toString(),
          chat_id: currentChatId!,
          sender: 'user',
          content: text,
          created_at: new Date().toISOString()
        };
        addMessage(userMsg);

        // Fetch streaming response to speak out
        let fullReply = '';
        await apiService.sendMessageStream(
          token!,
          currentChatId!,
          text,
          modelSettings,
          null,
          (chunk) => {
            fullReply += chunk;
            setVoiceReplyText(fullReply);
          },
          () => {
            // Speak the reply out loud once it completes
            speak(fullReply);
            loadChats();
          }
        );
      } catch (err) {
        console.error(err);
        setVoiceReplyText('Communication failure. Please verify backend state.');
      }
    },
    onError: (err) => {
      setVoiceReplyText(`Voice Error: ${err}`);
    }
  });

  const selectChat = async (id: string) => {
    if (!token) return;
    setActiveChatId(id);
    setIsLoadingMessages(true);
    try {
      const msgs = await apiService.getChatHistory(token!, id);
      setMessages(msgs);
      setActiveScreen('chat');
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // Continuous Mode loop for Voice Screen
  useEffect(() => {
    if (activeScreen === 'voice' && voiceSettings.continuousMode) {
      if (!isListening && !isSpeaking) {
        // slight delay to prevent overlapping states
        const timer = setTimeout(() => {
          startListening();
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [activeScreen, isListening, isSpeaking, voiceSettings.continuousMode, startListening]);

  const handleCreateChat = async (mode: 'general' | 'voice' = 'general') => {
    if (!token) return;
    try {
      const newChat = await apiService.createChat(token!, 'New Conversation', mode);
      setChats([newChat, ...chats]);
      setActiveChatId(newChat.id);
      setMessages([]);
      setActiveScreen(mode === 'voice' ? 'voice' : 'chat');
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendTextMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isStreaming || isLoadingMessages) return;
    if ((!chatInput.trim() && !chatAttachment) || !token) return;

    setIsStreaming(true);
    let currentChatId = activeChatId;
    if (!currentChatId) {
      try {
        const newChat = await apiService.createChat(token!, chatInput.substring(0, 30), 'general');
        setChats([newChat, ...chats]);
        setActiveChatId(newChat.id);
        currentChatId = newChat.id;
        setMessages([]);
      } catch (err) {
        console.error(err);
        setIsStreaming(false);
        return;
      }
    }

    const text = chatInput.trim();
    setChatInput('');

    let contentToSave = text;
    if (chatAttachment) {
      if (chatAttachment.type.startsWith("image/")) {
        contentToSave += `\n\n![Image](data:${chatAttachment.type};base64,${chatAttachment.data})`;
      } else {
        const attType = chatAttachment.type.toLowerCase();
        let typeLabel = "File Attachment";
        if (attType.includes("pdf")) typeLabel = "PDF Document";
        else if (attType.includes("word") || attType.includes("docx")) typeLabel = "Word Document";
        else if (attType.includes("text") || attType.includes("plain")) typeLabel = "Text File";
        const filename = chatAttachment.name || "Document";
        contentToSave += `\n\n---\n📎 **${filename}** (${typeLabel})`;
      }
    }

    // Add User Message
    const userMsg: ChatMessage = {
      id: Math.random().toString(),
      chat_id: currentChatId!,
      sender: 'user',
      content: contentToSave,
      created_at: new Date().toISOString()
    };
    addMessage(userMsg);

    // Add Assistant placeholder message
    const assistantMsg: ChatMessage = {
      id: Math.random().toString(),
      chat_id: currentChatId!,
      sender: 'assistant',
      content: '',
      created_at: new Date().toISOString()
    };
    addMessage(assistantMsg);

    // Capture and clear attachment
    const currentAttachment = chatAttachment ? [chatAttachment] : null;
    setChatAttachment(null);

    try {
      await apiService.sendMessageStream(
        token!,
        currentChatId!,
        text,
        modelSettings,
        currentAttachment,
        (chunk) => {
          updateLastMessageChunk(chunk);
        },
        async () => {
          setIsStreaming(false);
          loadChats();
        }
      );
    } catch (err) {
      console.error(err);
      setIsStreaming(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    try {
      if (isLoginView) {
        const data = await apiService.login(email, password);
        setAuth(data.access_token, { email, id: data.user_id, subscription_status: 'free' });
      } else {
        const data = await apiService.register(email, password);
        setAuth(data.access_token, { email, id: data.user_id, subscription_status: 'free' });
      }
      setEmail('');
      setPassword('');
      setActiveScreen('chat');
    } catch (err: any) {
      setAuthError(err.message || 'Authentication operation failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    try {
      apiService.logout();
    } catch (err) {
      console.error('Logout error:', err);
    }
    logout();
    setAuth(null, null);
    setActiveChatId(null);
    setMessages([]);
    setChats([]);
    setActiveScreen('splash');
  };

  const handleDeleteAllChats = async () => {
    if (!token || chats.length === 0) return;
    if (confirm('Are you absolutely sure you want to delete ALL conversations? This action is irreversible.')) {
      try {
        for (const chat of chats) {
          await apiService.deleteChat(token, chat.id);
        }
        setChats([]);
        setActiveChatId(null);
        setMessages([]);
        alert('All conversations have been deleted successfully.');
      } catch (err) {
        console.error('Failed to delete all conversations:', err);
        alert('An error occurred while deleting conversations.');
        loadChats();
      }
    }
  };

  if (!mounted) {
    return (
      <main className="w-full min-h-screen bg-[#070513] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
      </main>
    );
  }

  // Render view templates
  const getThemeWrapperClass = () => {
    const base = "w-full h-[100dvh] flex flex-col justify-between overflow-hidden transition-colors duration-300";
    let mode = appearanceSettings.theme === 'dark' ? 'bg-[#070513] text-slate-100' : 'bg-slate-50 text-slate-900';

    let styleClass = '';
    switch (appearanceSettings.interfaceStyle) {
      case 'Cyberpunk': styleClass = 'font-mono uppercase tracking-tight font-sans'; break;
      case 'Glassmorphism': styleClass = 'bg-gradient-to-br from-indigo-950 via-slate-900 to-violet-950 font-sans'; break;
      case 'Minimal': styleClass = 'bg-white text-black font-light font-sans'; break;
      case 'Hacker':
        styleClass = 'bg-black text-emerald-500 font-mono tracking-normal';
        mode = 'bg-black text-emerald-500';
        break;
      default: styleClass = 'font-sans';
    }

    return `${base} ${mode} ${styleClass}`;
  };

  const isDark = appearanceSettings.theme === 'dark';

  const chatContent = (
    <div className={getThemeWrapperClass()}>
      {/* Background Radial Orbs for Dark Mode */}
      {isDark && !isHacker && (
        <>
          <div className="absolute top-[10%] left-[20%] w-[350px] h-[350px] rounded-full bg-violet-600/10 blur-[130px] pointer-events-none z-0" />
          <div className="absolute bottom-[20%] right-[15%] w-[450px] h-[450px] rounded-full bg-cyan-500/10 blur-[160px] pointer-events-none z-0" />
        </>
      )}
      {isDark && isHacker && (
        <>
          <div className="absolute top-[10%] left-[20%] w-[350px] h-[350px] rounded-full bg-emerald-500/5 blur-[130px] pointer-events-none z-0" />
          <div className="absolute bottom-[20%] right-[15%] w-[450px] h-[450px] rounded-full bg-emerald-500/5 blur-[160px] pointer-events-none z-0" />
        </>
      )}

      {/* ----------------- SCREEN 1: SPLASH SCREEN / GATEWAY ----------------- */}
      {activeScreen === 'splash' && (
        <div className="flex-1 w-full min-h-screen flex flex-col md:flex-row relative z-10 bg-[#020205] text-white font-sans overflow-y-auto">
          {/* Left panel: Futuristic Planet backdrop, trust slogan, security greeting */}
          <div className="flex-1 flex flex-col justify-between p-8 md:p-12 relative overflow-hidden min-h-[400px] md:min-h-screen">
            {/* Soft planetary arc backdrop */}
            <div className="absolute top-[10%] right-[-30%] w-[650px] h-[650px] rounded-full border border-violet-500/20 bg-gradient-to-br from-violet-955/20 via-transparent to-transparent opacity-80 pointer-events-none" />
            <div className="absolute top-[15%] right-[-25%] w-[550px] h-[550px] rounded-full border border-indigo-500/10 pointer-events-none" />
            
            {/* Top network badge */}
            <div className="z-10 self-start">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/[0.04] bg-white/[0.02] backdrop-blur-md text-[9px] font-bold tracking-widest text-slate-400 uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>AETHERMIND NETWORK V3.0</span>
              </div>
            </div>

            {/* Left center robot logo and conversation slogan */}
            <div className="my-auto z-10 space-y-8 max-w-lg">
              {/* Spherical Logo + Speak Greeting popover */}
              <div className="flex items-center gap-4 relative">
                <div 
                  onClick={() => speakGreeting(true)}
                  className="w-24 h-24 rounded-full bg-[#04040a] border border-violet-500/30 flex items-center justify-center p-3 relative shadow-[0_0_30px_rgba(124,58,237,0.3)] hover:scale-[1.03] transition-all cursor-pointer group"
                >
                  <img
                    src="/echo_mind_bot.png"
                    alt="Samrat AI"
                    className="w-full h-full object-contain rounded-full"
                    onError={(e) => {
                      e.currentTarget.src = "https://cdn-icons-png.flaticon.com/512/4712/4712109.png";
                    }}
                  />
                  {/* Outer circle glow rings */}
                  <div className="absolute inset-[-4px] rounded-full border border-violet-500/20 animate-pulse" />
                </div>

                {/* Speak greeting popover bubble */}
                <div className="max-w-xs p-4 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-md text-[11px] leading-relaxed text-slate-300">
                  <p className="font-semibold text-white">👋 Hello! I am AetherMind.</p>
                  <p className="mt-1 text-slate-400">Click me to trigger security voice greeting, or authenticate on the right side to start.</p>
                </div>
              </div>

              {/* Slogan */}
              <div className="space-y-4">
                <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-[1.1] text-white">
                  Intelligent Conversations <br />
                  <span className="bg-gradient-to-r from-violet-400 via-indigo-300 to-cyan-400 bg-clip-text text-transparent">
                    Built for Scale
                  </span>
                </h1>
                <p className="text-xs md:text-sm text-slate-400 font-medium leading-relaxed">
                  Samrat Al enables secure, rapid, and smart conversational intelligence with zero latency and full context processing.
                </p>
              </div>
            </div>

            {/* Status footer inside left panel */}
            <div className="z-10 flex items-center justify-between border-t border-white/[0.04] pt-6 text-[9px] font-bold tracking-widest text-slate-450 uppercase">
              <div className="flex items-center gap-5">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  SYSTEM: <span className="text-emerald-400">ONLINE</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  NODES: <span className="text-cyan-400">SECURE</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400">
                <Lock className="w-3 h-3 text-violet-400" />
                <span>AES-256 SECURED</span>
              </div>
            </div>
          </div>

          {/* Right panel: Modern glassmorphism System Authentication Card */}
          <div className="flex-1 flex items-center justify-center p-6 md:p-12 bg-[#030307]/90 relative">
            <div className="w-full max-w-md border border-white/[0.05] bg-[#07070f]/90 p-8 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] space-y-6 relative z-10">
              
              {/* Header Title with security icon badge */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black tracking-tight text-white uppercase flex items-center gap-2">
                    SYSTEM <span className="text-violet-400">AUTHENTICATION</span>
                  </h2>
                  <p className="text-[10px] text-slate-500 font-semibold mt-1">
                    Provide credentials to link connection node.
                  </p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-violet-650/15 border border-violet-500/30 flex items-center justify-center text-violet-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
              </div>

              {/* Google SSO OAuth Button */}
              <button
                type="button"
                onClick={() => {
                  setEmail('google_user@samrat.ai');
                  setPassword('google_sso_pass');
                  const formEvent = new Event('submit', { cancelable: true, bubbles: true }) as unknown as React.FormEvent<HTMLFormElement>;
                  handleAuthSubmit(formEvent);
                }}
                className="w-full py-2.5 px-4 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] text-xs font-bold transition-all flex items-center justify-center gap-2.5 cursor-pointer text-slate-200"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.47 14.98 1 12 1 7.35 1 3.37 3.68 1.43 7.6l3.87 3C6.23 7.62 8.89 5.04 12 5.04z" />
                  <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.29 1.48-1.14 2.73-2.4 3.58l3.73 2.9c2.18-2 3.7-4.99 3.7-8.63z" />
                  <path fill="#FBBC05" d="M5.3 14.4c-.24-.73-.38-1.5-.38-2.3s.14-1.57.38-2.3L1.43 6.8C.51 8.65 0 10.74 0 13s.51 4.35 1.43 6.2l3.87-2.8z" />
                  <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.73-2.9c-1.1.74-2.5 1.18-4.23 1.18-3.11 0-5.77-2.58-6.7-5.56l-3.87 3C3.37 20.32 7.35 23 12 23z" />
                </svg>
                <span>Continue with Google</span>
              </button>

              {/* Separator */}
              <div className="flex items-center gap-4 text-[9px] font-bold text-slate-650 uppercase justify-center">
                <div className="h-px bg-white/5 flex-1" />
                <span>OR</span>
                <div className="h-px bg-white/5 flex-1" />
              </div>

              {/* Email Login/Signup Form */}
              <form onSubmit={handleAuthSubmit} className="space-y-4">
                {authError && (
                  <div className="p-3 border border-red-500/25 bg-red-955/20 text-red-400 rounded-xl text-xs text-center font-bold">
                    {authError}
                  </div>
                )}
                
                <div className="space-y-1.5">
                  <label htmlFor="email" className="block text-[9px] uppercase font-bold tracking-wider text-slate-500">
                    EMAIL ADDRESS
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-505" />
                    <input
                      type="email"
                      id="email"
                      autoComplete="username"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.02] text-xs font-medium focus:border-violet-500 focus:outline-none transition-all text-slate-100 placeholder-slate-600"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="password" className="block text-[9px] uppercase font-bold tracking-wider text-slate-500">
                    PASSWORD
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-505" />
                    <input
                      type="password"
                      id="password"
                      autoComplete={isLoginView ? "current-password" : "new-password"}
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-white/10 bg-white/[0.02] text-xs font-medium focus:border-violet-500 focus:outline-none transition-all text-slate-100 placeholder-slate-650"
                    />
                    <EyeOff className="absolute right-3 top-3.5 w-4 h-4 text-slate-505 cursor-pointer" />
                  </div>
                </div>

                {/* Primary Submit Button */}
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-650 to-cyan-500 text-white font-extrabold text-xs hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-violet-500/10"
                >
                  {authLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <>
                      <span>{isLoginView ? 'AUTHORIZE ACCESS' : 'CREATE ACCOUNT NODE'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Biometric options */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-4 text-[9px] font-bold text-slate-650 uppercase justify-center">
                  <div className="h-px bg-white/5 w-10" />
                  <span>BIOMETRIC SCANNER ACCESS</span>
                  <div className="h-px bg-white/5 w-10" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={biometricLoading !== null}
                    onClick={() => handleBiometricAuth('fingerprint')}
                    className="py-2.5 border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06] rounded-xl text-[10px] font-bold flex items-center justify-center gap-2 text-slate-300 hover:text-white cursor-pointer disabled:opacity-50 disabled:cursor-wait transition-all"
                  >
                    {biometricLoading === 'fingerprint' ? (
                      <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                    ) : (
                      <Fingerprint className="w-3.5 h-3.5 text-cyan-400" />
                    )}
                    <span>{biometricLoading === 'fingerprint' ? 'Scanning...' : 'Fingerprint ID'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={biometricLoading !== null}
                    onClick={() => handleBiometricAuth('face')}
                    className="py-2.5 border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06] rounded-xl text-[10px] font-bold flex items-center justify-center gap-2 text-slate-300 hover:text-white cursor-pointer disabled:opacity-50 disabled:cursor-wait transition-all"
                  >
                    {biometricLoading === 'face' ? (
                      <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin" />
                    ) : (
                      <ScanFace className="w-3.5 h-3.5 text-violet-400" />
                    )}
                    <span>{biometricLoading === 'face' ? 'Scanning...' : 'Face Lock ID'}</span>
                  </button>
                </div>
              </div>

              {/* Login View Toggle Link */}
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setIsLoginView(!isLoginView)}
                  className="text-[10px] font-bold text-slate-400 hover:text-violet-400 transition-colors"
                >
                  {isLoginView ? (
                    <span>Don't have an account? <span className="text-violet-400 underline">Sign up</span></span>
                  ) : (
                    <span>Already registered? <span className="text-violet-400 underline">Sign in</span></span>
                  )}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ----------------- SCREEN 2: VOICE MODE ----------------- */}
      {activeScreen === 'voice' && (
        <div className="flex-1 flex flex-col justify-between max-w-md mx-auto w-full px-6 py-8 relative z-10">
          {/* Header */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                stopSpeaking();
                stopListening();
                setActiveScreen('chat');
              }}
              className={`p-3 border rounded-2xl transition-colors ${
                isDark ? 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Voice Assistant</span>
            <button
              onClick={() => setActiveScreen('chat')}
              className={`p-3 border rounded-2xl transition-colors ${
                isDark ? 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Keyboard className="w-4 h-4" />
            </button>
          </div>

          {/* Prompt Status */}
          <div className="text-center my-6">
            <p className="text-xs text-violet-400 font-bold uppercase tracking-widest animate-pulse">
              {isListening ? 'Go ahead, I\'m listening...' : isSpeaking ? 'Responding...' : 'Standby Mode'}
            </p>
          </div>

          {/* Visualizer */}
          <div className="flex items-center justify-center my-4">
            <VortexVisualizer isListening={isListening} isSpeaking={isSpeaking} />
          </div>

          {/* Dialogue display */}
          <div className={`border rounded-3xl p-5 min-h-[110px] flex flex-col justify-center text-center shadow-lg backdrop-blur-md ${
            isDark ? 'bg-slate-900/40 border-slate-850' : 'bg-white/80 border-slate-150'
          }`}>
            <p className={`text-[10px] uppercase font-bold mb-1.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Dialogue Stream</p>
            {voiceTranscript && (
              <p className={`text-xs italic mb-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                You: "{voiceTranscript}"
              </p>
            )}
            <p className={`text-xs leading-relaxed font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
              {voiceReplyText}
            </p>
          </div>

          {/* Controls Footer */}
          <div className="flex items-center justify-between px-6 mt-8">
            <button
              onClick={() => setActiveScreen('chat')}
              className={`p-4 border rounded-full transition-colors ${
                isDark ? 'bg-slate-900/60 border-slate-850 text-slate-400 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Keyboard className="w-4 h-4" />
            </button>

            <button
              onClick={isListening ? stopListening : startListening}
              className={`w-18 h-18 rounded-full flex items-center justify-center transition-all shadow-xl ${
                isListening
                  ? 'bg-red-500 hover:bg-red-400 shadow-red-950/50 animate-pulse'
                  : 'bg-gradient-to-tr from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 shadow-violet-950/50'
              }`}
            >
              <Mic className="w-7 h-7 text-white" />
            </button>

            <button
              onClick={() => speak(voiceReplyText)}
              className={`p-4 border rounded-full transition-colors ${
                isDark ? 'bg-slate-900/60 border-slate-850 text-slate-400 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Sparkles className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ----------------- SCREEN 3: UNIFIED CHAT WORKSPACE ----------------- */}
      {activeScreen === 'chat' && (
        <div className="flex-1 flex flex-col h-full overflow-hidden relative z-10">
          {/* Top Navbar */}
          <nav className={`py-4 px-6 border-b backdrop-blur-xl flex items-center justify-between transition-colors z-20 ${
            isDark ? "bg-[#030303] border-white/[0.04] text-white" : "bg-white/80 border-slate-200 text-slate-800"
          }`}>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!isSidebarOpen)}
                className={`p-2 rounded-xl border transition-all ${
                  isDark ? 'border-white/10 bg-white/[0.02] text-slate-300 hover:text-white hover:bg-white/[0.06]' : 'bg-slate-150 border-slate-200 text-slate-650 hover:bg-slate-200'
                }`}
                title="Toggle Sidebar"
              >
                <Menu className="w-4 h-4" />
              </button>
              <div className="hidden sm:block">
                <span className="text-[8px] tracking-widest font-extrabold uppercase block text-slate-550">Welcome back</span>
                <span className={`text-[11px] font-mono font-bold tracking-tight flex items-center gap-1.5 ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {(profileSettings.username || user?.email || 'fingerprint_user@samrat.ai').replace(/<[^>]*>/g, '')}
                </span>
              </div>
            </div>

            {/* Segmented Workspace Toggle Control */}
            <div className={`flex items-center ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-slate-100/80 border-slate-200'} p-1 rounded-full border shadow-inner`}>
              {[
                { id: 'chat', label: 'Standard Chat', icon: MessageSquare },
                { id: 'docChat', label: 'DocMind AI', icon: FileText },
                { id: 'imageEdit', label: 'Image Studio', icon: Image }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (tab.id === 'docChat') {
                      setIsSettingsOpen(true);
                      setActiveSettingsTab('rag');
                    }
                  }}
                  className={`flex items-center gap-1.5 px-4.5 py-2 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                    tab.id === 'chat'
                      ? isDark
                        ? 'bg-violet-600/20 text-violet-400 border border-violet-500/40 shadow-[0_0_15px_rgba(124,58,237,0.25)]'
                        : 'bg-white text-[#0EA5E9] shadow-sm border border-slate-200/50'
                      : isDark
                        ? 'text-slate-400 hover:text-white'
                        : 'text-slate-505 hover:text-[#0EA5E9]'
                  }`}
                >
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setAppearanceSettings({ theme: isDark ? 'light' : 'dark' })}
                className={`p-2 rounded-xl border ${isDark ? 'border-white/10 bg-white/[0.02] text-slate-350 hover:text-white hover:bg-white/[0.06]' : 'border-slate-200 bg-white text-slate-505 hover:text-[#0EA5E9]'} transition-all`}
                title="Toggle Theme"
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button
                onClick={() => {
                  setIsSettingsOpen(true);
                  setActiveSettingsTab('profile');
                }}
                className={`p-2 rounded-xl border transition-all ${
                  isDark
                    ? 'border-white/10 bg-white/[0.02] text-slate-355 hover:text-white'
                    : 'border-slate-200 bg-white text-slate-505 hover:text-[#0EA5E9]'
                }`}
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                onClick={handleLogout}
                className={`p-2 rounded-xl border ${isDark ? 'border-white/10 bg-white/[0.02] text-slate-355 hover:text-red-400 hover:bg-white/[0.06]' : 'border-slate-200 bg-white text-slate-505 hover:text-red-500 hover:border-red-200'} transition-all`}
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </nav>

    <div className="flex flex-1 min-h-0 overflow-hidden relative">

      {/* Left Slide-out Sidebar */}
      {isSidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-20 md:hidden"
        />
      )}

      <aside className={`fixed inset-y-0 left-0 md:static z-30 w-64 h-full flex flex-col border-r ${
        isDark ? 'border-white/[0.04] bg-[#07070d] text-white' : 'border-slate-200 bg-white/95 text-slate-800'
      } transition-all duration-300 ${isSidebarOpen ? 'translate-x-0 opacity-100' : '-translate-x-full md:-ml-64 opacity-0'}`}>
        {/* Sidebar Logo */}
        <div className="p-6 flex items-center gap-3 border-b border-white/[0.04]">
          <div className="w-8 h-8 rounded-xl bg-violet-650/20 border border-violet-500/30 flex items-center justify-center text-violet-400 shadow-[0_0_12px_rgba(124,58,237,0.3)]">
            <Bot className="w-4 h-4" />
          </div>
          <span className="font-extrabold text-sm tracking-widest bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            SAMRAT <span className="text-violet-400">AI</span>
          </span>
        </div>

        {/* Sidebar Items */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1.5 scrollbar-none">
          <button
            className="w-full flex items-center gap-3 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer bg-violet-955/40 text-violet-400 border border-violet-500/20"
          >
            <Bot className="w-4 h-4" />
            <span>Home</span>
          </button>
          <button
            onClick={() => {
              setIsSettingsOpen(true);
              setActiveSettingsTab('rag');
            }}
            className="w-full flex items-center gap-3 py-2.5 px-4 rounded-xl text-xs font-bold text-slate-455 hover:bg-white/[0.02] hover:text-white transition-all cursor-pointer"
          >
            <FileText className="w-4 h-4 text-slate-505" />
            <span>DocMind AI</span>
          </button>
          <button
            className="w-full flex items-center gap-3 py-2.5 px-4 rounded-xl text-xs font-bold text-slate-455 hover:bg-white/[0.02] hover:text-white transition-all cursor-pointer"
          >
            <Image className="w-4 h-4 text-slate-505" />
            <span>Image Studio</span>
          </button>

          <div className="h-px bg-white/[0.04] my-4" />

          <div className="space-y-1">
            <span className="px-4 text-[9px] uppercase tracking-widest font-extrabold text-slate-650 block mb-2">
              WORKSPACE
            </span>
            {[
              { id: 'templates', label: 'Templates', icon: LayoutTemplate },
              { id: 'integrations', label: 'Integrations', icon: Zap },
              { id: 'analytics', label: 'Analytics', icon: Activity }
            ].map(item => (
              <button
                key={item.id}
                className="w-full flex items-center gap-3 py-2.5 px-4 rounded-xl text-xs font-bold text-slate-455 hover:bg-white/[0.02] hover:text-white transition-all cursor-pointer"
              >
                <item.icon className="w-4 h-4 text-slate-505" />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* User profile & upgrades in sidebar footer */}
        <div className="p-4 border-t border-white/[0.04] space-y-3">
          <div className="flex items-center justify-between bg-white/[0.01] border border-white/[0.04] p-3 rounded-2xl">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-black text-white text-[10px]">
                N
              </div>
              <div className="min-w-0">
                <span className="block text-[11px] font-bold text-white truncate">SAMRAT AI</span>
                <span className="block text-[9px] font-extrabold text-amber-400">★ Premium Plan</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-550 shrink-0" />
          </div>
          <button
            onClick={() => {
              setIsSettingsOpen(true);
              setActiveSettingsTab('profile');
            }}
            className="w-full py-2.5 border border-violet-500/30 bg-violet-650/10 hover:bg-violet-650/20 text-violet-400 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Upgrade Plan</span>
          </button>
        </div>
      </aside>

    <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-800 pb-44">
        {!activeChatId ? (
          <div className="min-h-full flex flex-col items-center justify-center relative overflow-hidden px-6 py-12">
            {/* Soft Space planetary background arcs and star dust field */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(124,58,237,0.06),transparent_65%)] pointer-events-none" />
            <div className="absolute top-[10%] left-[5%] w-[800px] h-[800px] rounded-full border border-white/[0.015] [mask-image:linear-gradient(to_bottom,white,transparent)] pointer-events-none" />
            <div className="absolute top-[20%] left-[12%] w-[600px] h-[600px] rounded-full border border-white/[0.025] [mask-image:linear-gradient(to_bottom,white,transparent)] pointer-events-none" />
            <div className="absolute top-[30%] left-[20%] w-[400px] h-[400px] rounded-full border border-white/[0.035] [mask-image:linear-gradient(to_bottom,white,transparent)] pointer-events-none" />

            <div className="relative z-10 w-full max-w-4xl mx-auto flex flex-col items-center text-center space-y-10">
              {/* Trust Pill & Version indicator */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-violet-500/25 bg-violet-955/30 backdrop-blur-md shadow-[0_0_15px_rgba(124,58,237,0.15)] text-[9px] font-bold tracking-widest text-violet-300 uppercase animate-fade-in">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span>SAMRAT AETHERMIND v3.0</span>
              </div>

              {/* Main spaceship cockpit hero heading */}
              <div className="space-y-4">
                <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-[1.08] text-white">
                  Empower Your Ideas with <br />
                  <span className="bg-gradient-to-r from-violet-400 via-indigo-300 to-cyan-400 bg-clip-text text-transparent drop-shadow-[0_2px_10px_rgba(167,139,250,0.2)]">
                    Adaptive Intelligence
                  </span>
                </h1>
                <p className="text-xs md:text-sm max-w-2xl mx-auto text-slate-400 leading-relaxed font-medium">
                  Experience a state-of-the-art workspace integrating deep RAG capabilities, instant image generation, and multi-agent workflows designed for builders.
                </p>
              </div>

              {/* Prompt starters in grid layout */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-3xl pt-4">
                {[
                  {
                    title: "Advanced Data Analysis",
                    desc: "Analyze document content with deep context vector search.",
                    prompt: "Upload a file and summarize the key findings.",
                    color: "from-violet-500/10 to-transparent border-violet-500/20 text-violet-400"
                  },
                  {
                    title: "Studio Image Generator",
                    desc: "Create premium graphics and assets using natural language.",
                    prompt: "Generate a planetary glassmorphic workspace mockup.",
                    color: "from-cyan-500/10 to-transparent border-cyan-500/20 text-cyan-400"
                  },
                  {
                    title: "Deep Reasoning Agent",
                    desc: "Solve logical problems, code algorithms, and debug syntax.",
                    prompt: "Write a high-performance Next.js custom hook.",
                    color: "from-indigo-500/10 to-transparent border-indigo-500/20 text-indigo-400"
                  }
                ].map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => setChatInput(item.prompt)}
                    className={`p-5 rounded-2xl border bg-gradient-to-b ${item.color} text-left transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:bg-white/[0.02] cursor-pointer group flex flex-col justify-between h-40`}
                  >
                    <div>
                      <h3 className="text-xs font-bold text-white group-hover:text-violet-300 transition-colors">
                        {item.title}
                      </h3>
                      <p className="text-[10px] text-slate-500 mt-2 font-medium leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold tracking-tight text-slate-400 group-hover:text-white flex items-center gap-1 mt-4">
                      <span>Try prompt</span>
                      <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
    <div className="max-w-3xl mx-auto space-y-6">
      {messages.map((msg) => {
        const isAssistant = msg.sender === 'assistant';
        return (
          <div
            key={msg.id}
            className={`flex gap-3.5 animate-in fade-in slide-in-from-bottom-2 duration-250 ${isAssistant ? 'justify-start' : 'justify-end'}`}
          >
            {isAssistant && (
              <div className={`w-8 h-8 rounded-xl border flex items-center justify-center flex-shrink-0 shadow-sm ${isHacker
                ? 'bg-black border-emerald-500/30 text-emerald-400 font-mono shadow-[0_0_8px_rgba(16,185,129,0.15)]'
                : isDark ? 'bg-slate-900 border-violet-500/20 text-violet-400' : 'bg-slate-100 border-violet-500/10 text-violet-600'
                }`}>
                <Bot className="w-4.5 h-4.5" />
              </div>
            )}
            <div className="max-w-[80%] flex flex-col gap-1.5">
              <div
                className={`rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-sm transition-all border ${isAssistant
                  ? isHacker
                    ? 'bg-[#020202] border border-dashed border-emerald-600/60 text-emerald-400 font-mono'
                    : isDark
                      ? 'bg-slate-900/60 border-slate-850 text-slate-200'
                      : 'bg-white border-slate-150 text-slate-800'
                  : isHacker
                    ? 'bg-black border-2 border-emerald-500 text-emerald-300 font-mono shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                    : 'bg-gradient-to-r from-violet-600 to-cyan-500 border-transparent text-white font-medium shadow-md shadow-violet-950/20'
                  }`}
              >
                <div className="w-full">{renderMessageContent(msg.content)}</div>
              </div>
              <span className={`text-[9px] font-semibold ${isHacker ? 'text-emerald-700 font-mono' : 'text-slate-550'
                } ${!isAssistant ? 'text-right' : ''}`}>
                {new Date(msg.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            {!isAssistant && (
              <div className={`w-8 h-8 rounded-xl border flex items-center justify-center flex-shrink-0 shadow-sm ${isHacker
                ? 'bg-black border-emerald-500/30 text-emerald-400 font-mono shadow-[0_0_8px_rgba(16,185,129,0.15)]'
                : isDark ? 'bg-slate-900 border-cyan-500/20 text-cyan-400' : 'bg-slate-100 border-cyan-500/10 text-cyan-600'
                }`}>
                <User className="w-4.5 h-4.5" />
              </div>
            )}
          </div>
        );
      })}
    </div>
                )}
              </div>

<div className="absolute bottom-0 inset-x-0 p-4 transition-all z-10 bg-transparent">
  <div className="w-full max-w-3xl mx-auto flex flex-col gap-2">
    {chatAttachment && (
      <div className="p-2 border border-slate-250 rounded-xl flex items-center justify-between gap-3 bg-[#0c0c17] shadow-md">
        <div className="flex items-center gap-2">
          <img
            src={`data:${chatAttachment.type};base64,${chatAttachment.data}`}
            alt="attachment preview"
            className="w-10 h-10 object-cover rounded-lg border border-slate-705"
          />
          <span className="text-[10px] font-semibold truncate max-w-[200px] text-slate-300">
            {chatAttachment.name}
          </span>
        </div>
        <button type="button" onClick={() => setChatAttachment(null)} className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    )}

    {/* Capsule Container */}
    <div className={`rounded-full border p-3 flex items-center gap-2 shadow-2xl transition-all ${
      isDark 
        ? 'border-white/[0.08] bg-[#0b0c16]/80 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)]' 
        : 'border-slate-200 bg-white/80 backdrop-blur-xl shadow-slate-200/60'
    }`}>
      <div className="p-2 flex-shrink-0">
        <div className="w-7.5 h-7.5 rounded-full flex items-center justify-center shadow-md bg-gradient-to-tr from-violet-600 to-cyan-400 text-white animate-pulse">
          <Sparkles className="w-4 h-4" />
        </div>
      </div>

      <div className="relative flex-shrink-0">
        <input
          type="file"
          accept="image/*"
          onChange={handleAttachmentChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        <button
          type="button"
          className={`p-2.5 rounded-full border transition-colors ${
            isDark ? 'border-white/10 bg-white/5 text-slate-355 hover:bg-white/10' : 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
          title="Upload media attachment"
        >
          <Paperclip className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleSendTextMessage} className="flex-1 flex items-center gap-2">
        <textarea
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (!isStreaming && !isLoadingMessages && (chatInput.trim() || chatAttachment)) {
                handleSendTextMessage(e as any);
              }
            }
          }}
          placeholder="Ask me anything..."
          rows={1}
          style={{ resize: 'none' }}
          className={`flex-1 bg-transparent text-sm font-medium focus:outline-none placeholder-slate-500 ${isDark ? 'text-white' : 'text-slate-805'}`}
        />

        <button
          type="button"
          onClick={() => {
            stopSpeaking();
            stopListening();
            setActiveScreen('voice');
          }}
          className={`p-2.5 rounded-full border transition-all flex-shrink-0 ${
            isListening
              ? 'bg-red-500 border-transparent text-white animate-pulse'
              : isDark ? 'border-white/10 bg-white/5 text-slate-355 hover:bg-white/10' : 'border-slate-200 bg-slate-100 text-slate-655 hover:bg-slate-200'
          }`}
          title="Toggle Voice Assistant"
        >
          <Mic className="w-4 h-4" />
        </button>

        <button
          type="submit"
          disabled={isStreaming || isLoadingMessages || (!chatInput.trim() && !chatAttachment)}
          className="p-2.5 rounded-full bg-gradient-to-r from-violet-600 to-indigo-650 hover:from-violet-500 hover:to-indigo-600 disabled:opacity-40 text-white transition-colors shadow-md flex items-center justify-center flex-shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>

    {/* Mode pills */}
    <div className="flex gap-2 items-center mt-3 justify-center flex-wrap">
      {['General', 'Coding', 'Writing', 'Analysis', 'Business'].map((mode) => (
        <button
          key={mode}
          onClick={() => setActiveMode(mode)}
          className={`px-4.5 py-2 rounded-full text-[11px] font-bold whitespace-nowrap transition-all border ${
            activeMode === mode
              ? 'bg-violet-655/20 border-violet-500/30 text-violet-400 shadow-md shadow-violet-500/10'
              : isDark 
                ? 'bg-white/[0.01] border-white/5 text-slate-455 hover:border-white/10 hover:text-white'
                : 'bg-white border-slate-200 text-slate-600 hover:border-[#38BDF8]/40 hover:text-[#0EA5E9]'
          }`}
        >
          {mode}
        </button>
      ))}
    </div>
  </div>
</div>
</main>
</div>
</div>
)}

{contextMenuPos && contextMenuChat && (
    <div
      className={`fixed z-50 w-52 rounded-2xl border p-1 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100 ${isDark ? 'bg-slate-950/90 border-slate-800 text-slate-200 shadow-violet-950/15' : 'bg-white/95 border-slate-200 text-slate-850 shadow-slate-200/50'
        }`}
      style={{ top: contextMenuPos.y, left: contextMenuPos.x }}
    >
      <button
        onClick={async () => {
          try {
            await apiService.updateChat(token!, contextMenuChat.id, { is_pinned: !contextMenuChat.is_pinned });
            loadChats();
          } catch (e) { console.error(e); }
        }}
        className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-bold rounded-xl text-left transition-all ${isDark ? 'hover:bg-white/5 text-slate-300 hover:text-white' : 'hover:bg-slate-100 text-slate-700 hover:text-slate-900'
          }`}
      >
        <Pin className={`w-3.5 h-3.5 ${contextMenuChat.is_pinned ? 'text-cyan-400' : 'text-slate-500'}`} />
        {contextMenuChat.is_pinned ? 'Unpin Conversation' : 'Pin Conversation'}
      </button>
      <button
        onClick={() => {
          setChatEditTitle(contextMenuChat.title);
          setChatEditId(contextMenuChat.id);
        }}
        className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-bold rounded-xl text-left transition-all ${isDark ? 'hover:bg-white/5 text-slate-300 hover:text-white' : 'hover:bg-slate-100 text-slate-700 hover:text-slate-900'
          }`}
      >
        <Edit2 className="w-3.5 h-3.5 text-slate-500" />
        Rename Chat
      </button>
      <button
        onClick={() => {
          if (hiddenChatIds.includes(contextMenuChat.id)) {
            unhideChat(contextMenuChat.id);
          } else {
            hideChat(contextMenuChat.id);
            if (activeChatId === contextMenuChat.id) {
              setActiveChatId(null);
              setMessages([]);
            }
          }
        }}
        className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-bold rounded-xl text-left transition-all ${isDark ? 'hover:bg-white/5 text-slate-300 hover:text-white' : 'hover:bg-slate-100 text-slate-700 hover:text-slate-900'
          }`}
      >
        {hiddenChatIds.includes(contextMenuChat.id) ? (
          <Eye className="w-3.5 h-3.5 text-slate-500" />
        ) : (
          <EyeOff className="w-3.5 h-3.5 text-slate-500" />
        )}
        {hiddenChatIds.includes(contextMenuChat.id) ? 'Unhide Chat' : 'Hide Chat'}
      </button>
      <div className={`my-1 border-t ${isDark ? 'border-slate-900' : 'border-slate-150'}`} />
      <button
        onClick={async () => {
          if (confirm('Delete this conversation?')) {
            try {
              await apiService.deleteChat(token!, contextMenuChat.id);
              loadChats();
              if (activeChatId === contextMenuChat.id) {
                setActiveChatId(null);
                setMessages([]);
              }
            } catch (err) { console.error(err); }
          }
        }}
        className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-bold rounded-xl text-left transition-all ${isDark ? 'hover:bg-red-950/40 text-red-400 hover:text-red-300' : 'hover:bg-red-50 text-red-600 hover:text-red-750'
          }`}
      >
        <Trash2 className="w-3.5 h-3.5" />
        Delete Conversation
      </button>
    </div>
  )
}

{isSettingsOpen && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className={`w-full max-w-md md:max-w-4xl h-[550px] md:h-[600px] border rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col ${isDark ? 'bg-slate-950 border-slate-800 shadow-violet-950/10' : 'bg-white border-slate-200'
        }`}>
        <div className={`flex items-center justify-between p-5 border-b flex-shrink-0 ${isDark ? 'border-slate-900' : 'border-slate-150'}`}>
          <h3 className={`text-sm font-bold flex items-center gap-2 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
            <Settings className="w-4 h-4 text-violet-400" />
            Echo Mind Settings
          </h3>
          <button
            onClick={() => setIsSettingsOpen(false)}
            className={`p-1 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-900 text-slate-400 hover:text-slate-200' : 'hover:bg-slate-100 text-slate-600'}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          <div className={`flex md:flex-col border-b md:border-b-0 md:border-r overflow-x-auto md:overflow-x-visible md:w-56 p-1 md:p-4 flex-shrink-0 space-y-0 md:space-y-1 ${isDark ? 'border-slate-900 bg-slate-950' : 'border-slate-150 bg-slate-50'
            }`}>
            {[
              { id: 'profile', label: 'Account Profile', icon: User },
              { id: 'appearance', label: 'Display Settings', icon: LayoutGrid },
              { id: 'language', label: 'Language', icon: Mail },
              { id: 'voice', label: 'Voice Mode', icon: Mic },
              { id: 'model', label: 'Model Settings', icon: Bot },
              { id: 'rag', label: 'RAG & Docs', icon: MessageSquare }
            ].map(tab => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSettingsTab(tab.id as any)}
                  className={`px-4 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 md:border-b-0 md:border-l-2 md:w-full md:text-left transition-all snap-start rounded-none md:rounded-lg flex items-center gap-2.5 ${activeSettingsTab === tab.id
                    ? 'border-violet-500 text-violet-400 bg-violet-600/5'
                    : isDark ? 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30' : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                >
                  <TabIcon className="w-4 h-4 hidden md:inline" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex-1 p-6 md:p-8 space-y-6 overflow-y-auto bg-slate-900/10 scrollbar-thin scrollbar-thumb-slate-900">

            {activeSettingsTab === 'profile' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div>
                  <h4 className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Account Profile</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">Customize your username representation and account avatar.</p>
                </div>

                <div className={`flex items-center gap-5 border p-5 rounded-2xl ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="relative group flex-shrink-0">
                    <div className={`w-18 h-18 rounded-full border-2 overflow-hidden flex items-center justify-center ${isDark ? 'bg-slate-850 border-slate-700' : 'bg-slate-200 border-slate-300'}`}>
                      {profileSettings.profilePictureUrl ? (
                        <img
                          src={profileSettings.profilePictureUrl.startsWith('http') ? profileSettings.profilePictureUrl : `http://localhost:8000${profileSettings.profilePictureUrl}`}
                          alt="Profile"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-7 h-7 text-slate-500" />
                      )}
                    </div>
                    <label className="absolute bottom-0 right-0 bg-violet-600 hover:bg-violet-550 p-1.5 rounded-full border border-slate-950 cursor-pointer shadow-md transition-all">
                      <Edit2 className="w-3 h-3 text-white" />
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={async (e) => {
                          if (e.target.files && e.target.files[0]) {
                            try {
                              const res = await apiService.uploadProfilePicture(token!, e.target.files[0]);
                              setProfileSettings({ profilePictureUrl: res.profile_picture_url });
                            } catch (error) {
                              console.error('Failed to upload', error);
                            }
                          }
                        }}
                      />
                    </label>
                  </div>
                  <div>
                    <span className={`inline-block px-1.5 py-0.5 border text-[8px] font-bold rounded uppercase tracking-wider ${isDark ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-slate-200 border-slate-300 text-slate-600'}`}>
                      Owner
                    </span>
                    <h5 className={`text-xs font-bold mt-1 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                      {profileSettings.username || 'AetherMind User'}
                    </h5>
                    <p className="text-[10px] text-slate-500">{user?.email}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-[10px] uppercase font-bold mb-1.5 ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>Name</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={profileSettings.username}
                        onChange={(e) => setProfileSettings({ username: e.target.value })}
                        placeholder="Enter username"
                        className={`flex-1 px-3 py-2 border rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-violet-500 ${isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-900'
                          }`}
                      />
                      <button
                        onClick={async () => {
                          try {
                            await apiService.updateProfile(token!, { username: profileSettings.username });
                            alert('Username saved successfully!');
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                        className="px-4 py-2 bg-violet-600 hover:bg-violet-550 rounded-xl text-xs text-white font-bold transition-colors"
                      >
                        Save
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className={`block text-[10px] uppercase font-bold mb-1.5 ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>Email Address</label>
                    <div className="relative">
                      <input
                        type="email"
                        value={user?.email || ''}
                        disabled
                        className={`w-full pl-3 pr-10 py-2 border rounded-xl text-xs cursor-not-allowed ${isDark ? 'bg-slate-900/30 border-slate-800 text-slate-500' : 'bg-slate-100 border-slate-200 text-slate-550'
                          }`}
                      />
                      <Lock className="absolute right-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <button
                    onClick={() => alert('Change password functionality requested.')}
                    className={`flex items-center gap-3 p-4 border rounded-xl hover:border-violet-500/20 text-left transition-all ${isDark ? 'bg-slate-900/40 border-slate-800 hover:bg-slate-900' : 'bg-slate-50 border-slate-150 hover:bg-slate-100'
                      }`}
                  >
                    <div className={`p-2 border rounded-lg ${isDark ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-600'}`}>
                      <Lock className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className={`text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Change Password</p>
                      <p className="text-[9px] text-slate-550">Secure your authentication credentials.</p>
                    </div>
                  </button>

                  <button
                    onClick={() => alert('Transfer ownership flow initiated.')}
                    className={`flex items-center gap-3 p-4 border rounded-xl hover:border-violet-500/20 text-left transition-all ${isDark ? 'bg-slate-900/40 border-slate-800 hover:bg-slate-900' : 'bg-slate-50 border-slate-150 hover:bg-slate-100'
                      }`}
                  >
                    <div className={`p-2 border rounded-lg ${isDark ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-600'}`}>
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className={`text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Transfer Ownership</p>
                      <p className="text-[9px] text-slate-550">Assign primary ownership credentials.</p>
                    </div>
                  </button>
                </div>

                <div className={`border rounded-2xl p-4 flex items-center justify-between gap-4 flex-wrap ${isDark ? 'border-red-950/20 bg-red-950/5' : 'border-red-100 bg-red-50/20'}`}>
                  <div>
                    <p className="text-xs font-bold text-red-500">Delete Account</p>
                    <p className="text-[9px] text-slate-500 mt-0.5">Process the deletion of your account and metadata.</p>
                  </div>
                  <button
                    onClick={() => alert('Support ticket requested for account removal.')}
                    className="px-3 py-1.5 bg-red-650/15 hover:bg-red-550/20 border border-red-500/30 text-red-500 rounded-xl text-xs font-bold transition-all"
                  >
                    Delete Account
                  </button>
                </div>

                <div className={`pt-2 border-t space-y-2 ${isDark ? 'border-slate-900' : 'border-slate-150'}`}>
                  <p className={`text-[10px] uppercase font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Tutorials</p>
                  <a
                    href="#docs"
                    onClick={(e) => { e.preventDefault(); alert('API Documentation is available in AGENTS.md'); }}
                    className={`flex items-center justify-between p-3.5 border rounded-xl transition-colors ${isDark ? 'bg-slate-900/40 border-slate-800 hover:bg-slate-900/60' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <Bot className="w-4 h-4 text-violet-400" />
                      <span className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>API documentation</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                  </a>
                </div>
              </div>
            )}

            {activeSettingsTab === 'appearance' && (
              <div className="space-y-5">
                <div>
                  <label className={`block text-[10px] uppercase font-bold mb-1.5 ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>Theme</label>
                  <div className={`flex p-1 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
                    <button
                      onClick={() => setAppearanceSettings({ theme: 'dark' })}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${appearanceSettings.theme === 'dark' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      Dark
                    </button>
                    <button
                      onClick={() => setAppearanceSettings({ theme: 'light' })}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${appearanceSettings.theme === 'light' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      Light
                    </button>
                  </div>
                </div>
                <div>
                  <label className={`block text-[10px] uppercase font-bold mb-2.5 ${isDark ? 'text-slate-550' : 'text-slate-650'}`}>Interface Style</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          { id: 'Classic', icon: LayoutTemplate, desc: 'Standard UI' },
                          { id: 'Cyberpunk', icon: Zap, desc: 'Neon aesthetics' },
                          { id: 'Minimal', icon: Minus, desc: 'Clean & simple' },
                          { id: 'Glassmorphism', icon: Layers, desc: 'Frosted glass' },
                          { id: 'Hacker', icon: Terminal, desc: 'Terminal mode' }
                        ].map(style => {
                          const IconComp = style.icon;
                          const isActive = appearanceSettings.interfaceStyle === style.id;
                          return (
                          <button
                            key={style.id}
                            onClick={() => setAppearanceSettings({ interfaceStyle: style.id as any })}
                            className={`p-3.5 rounded-2xl border text-left transition-all duration-300 hover:scale-[1.02] flex items-center gap-3 ${
                              isActive
                              ? 'border-violet-500 bg-violet-500/10 shadow-[0_0_15px_rgba(139,92,246,0.15)]'
                              : isDark ? 'border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-900' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                              }`}
                          >
                            <div className={`p-2 rounded-xl flex-shrink-0 ${
                              isActive ? 'bg-violet-500 text-white shadow-md' : isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
                            }`}>
                              <IconComp className="w-4 h-4" />
                            </div>
                            <div>
                              <span className={`block text-xs font-bold ${isActive ? 'text-violet-400' : isDark ? 'text-slate-200' : 'text-slate-800'}`}>{style.id}</span>
                              <span className={`block text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{style.desc}</span>
                            </div>
                          </button>
                        )})}
                      </div>
                    </div>


                <div className={`pt-4 border-t space-y-3.5 ${isDark ? 'border-slate-900' : 'border-slate-150'}`}>
                  <div className="flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4 text-violet-400" />
                    <h4 className={`text-[10px] uppercase font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Chats Settings</h4>
                  </div>

                  {/* Lock Chats Toggle */}
                  <div className={`flex items-center justify-between p-3.5 border rounded-2xl ${isDark ? 'bg-slate-950 border-slate-900' : 'bg-slate-50 border-slate-200'
                    }`}>
                    <div>
                      <label className={`block text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Lock Hidden Chats</label>
                      <span className="text-[10px] text-slate-500 block mt-0.5">If active, hidden chats are hidden from the sidebar list.</span>
                    </div>
                    <button
                      onClick={() => setLockChats(!lockChats)}
                      className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors flex-shrink-0 ${lockChats ? 'bg-violet-600' : 'bg-slate-800'}`}
                    >
                      <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-200 ease-in-out ${lockChats ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  <div>
                    <label className={`block text-xs font-bold mb-1.5 flex items-center gap-1.5 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                      <EyeOff className="w-3.5 h-3.5 text-slate-400" /> Hidden Chats List
                    </label>
                    <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-900">
                      {chats.filter(c => hiddenChatIds.includes(c.id)).length === 0 ? (
                        <p className="text-[10px] text-slate-550 italic">No hidden chats.</p>
                      ) : (
                        chats.filter(c => hiddenChatIds.includes(c.id)).map(chat => (
                          <div key={chat.id} className={`flex items-center justify-between p-2.5 border rounded-xl ${isDark ? 'bg-slate-950/60 border-slate-900' : 'bg-slate-550 border-slate-200'
                            }`}>
                            <span className={`text-xs truncate max-w-[180px] font-semibold ${isDark ? 'text-slate-350' : 'text-slate-700'}`}>{chat.title}</span>
                            <div className="flex gap-1">
                              <button
                                onClick={() => unhideChat(chat.id)}
                                className={`p-1 rounded-md transition-all ${isDark ? 'text-slate-400 hover:text-emerald-400 hover:bg-slate-900' : 'text-slate-500 hover:text-emerald-600 hover:bg-slate-100'}`}
                                title="Unhide Chat"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={async () => {
                                  if (confirm('Delete this hidden conversation?')) {
                                    try {
                                      await apiService.deleteChat(token!, chat.id);
                                      unhideChat(chat.id);
                                      loadChats();
                                      if (activeChatId === chat.id) {
                                        setActiveChatId(null);
                                        setMessages([]);
                                      }
                                    } catch (err) { console.error(err); }
                                  }
                                }}
                                className={`p-1 rounded-md transition-all ${isDark ? 'text-slate-400 hover:text-red-400 hover:bg-slate-900' : 'text-slate-500 hover:text-red-650 hover:bg-slate-100'}`}
                                title="Delete Chat"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Delete All Conversations Global Area */}
                  <div className={`mt-4 p-4 border rounded-2xl ${isHacker
                    ? 'border-red-900/40 bg-red-950/10'
                    : isDark ? 'border-red-950/20 bg-red-950/5' : 'border-red-100 bg-red-50/20'
                    }`}>
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div>
                        <p className="text-xs font-bold text-red-500">Delete All Conversations</p>
                        <p className="text-[10px] text-slate-550 mt-0.5 font-semibold">Wipe your entire conversation history and message logs.</p>
                      </div>
                      <button
                        onClick={handleDeleteAllChats}
                        disabled={chats.length === 0}
                        className="px-4 py-2 bg-red-650/15 hover:bg-red-550/20 border border-red-500/30 text-red-500 rounded-xl text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Delete All Chats
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: LANGUAGE */}
            {activeSettingsTab === 'language' && (
              <div className="space-y-4">
                <div>
                  <label className={`block text-[10px] uppercase font-bold mb-1.5 ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>Text Language</label>
                  <select
                    value={languageSettings.textLanguage}
                    onChange={(e) => setLanguageSettings({ textLanguage: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-violet-500 font-semibold ${isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                  >
                    {['English', 'Hindi', 'Telugu', 'Marathi', 'Tamil', 'Kannada', 'Malayalam', 'Bengali', 'Gujarati', 'Punjabi'].map(lang => (
                      <option key={lang} value={lang}>{lang}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`block text-[10px] uppercase font-bold mb-1.5 ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>Voice Language</label>
                  <select
                    value={languageSettings.voiceLanguage}
                    onChange={(e) => setLanguageSettings({ voiceLanguage: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-violet-500 font-semibold ${isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                  >
                    {['English', 'Hindi', 'Telugu', 'Marathi', 'Tamil', 'Kannada', 'Malayalam', 'Bengali', 'Gujarati', 'Punjabi'].map(lang => (
                      <option key={lang} value={lang}>{lang}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* TAB: VOICE */}
            {activeSettingsTab === 'voice' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-[10px] uppercase font-bold mb-1.5 ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>Accent (English)</label>
                    <select
                      value={voiceSettings.accent}
                      onChange={(e) => setVoiceSettings({ accent: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-violet-500 font-semibold ${isDark ? 'bg-slate-900 border-slate-850 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-900'
                        }`}
                    >
                      {['American', 'British', 'Indian', 'Australian'].map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={`block text-[10px] uppercase font-bold mb-1.5 ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>Personality</label>
                    <select
                      value={voiceSettings.personality}
                      onChange={(e) => setVoiceSettings({ personality: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-violet-500 font-semibold ${isDark ? 'bg-slate-900 border-slate-850 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-900'
                        }`}
                    >
                      {['Professional', 'Friendly', 'Calm', 'Energetic', 'Robotic', 'Male', 'Female'].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={`block text-[10px] uppercase font-bold mb-1.5 ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>Wake Word</label>
                  <select
                    value={voiceSettings.wakeWord}
                    onChange={(e) => setVoiceSettings({ wakeWord: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-violet-500 font-semibold ${isDark ? 'bg-slate-900 border-slate-855 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                  >
                    <option value="">Disabled (None)</option>
                    {['Samrat', 'Aether', 'Echo', 'Friday'].map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                </div>
                <div className={`space-y-3 pt-2 border-t ${isDark ? 'border-slate-900' : 'border-slate-150'}`}>
                  <div>
                    <div className="flex justify-between text-[10px] uppercase font-bold text-slate-500 mb-1.5">
                      <span>Speed</span><span className="text-violet-400 font-bold">{voiceSettings.speed}x</span>
                    </div>
                    <input type="range" min="0.5" max="2.0" step="0.1" value={voiceSettings.speed} onChange={(e) => setVoiceSettings({ speed: parseFloat(e.target.value) })} className="w-full accent-violet-500" />
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] uppercase font-bold text-slate-500 mb-1.5">
                      <span>Pitch</span><span className="text-violet-400 font-bold">{voiceSettings.pitch}</span>
                    </div>
                    <input type="range" min="0.5" max="2.0" step="0.1" value={voiceSettings.pitch} onChange={(e) => setVoiceSettings({ pitch: parseFloat(e.target.value) })} className="w-full accent-violet-500" />
                  </div>
                </div>
                <div className={`flex items-center justify-between pt-2 border-t ${isDark ? 'border-slate-900' : 'border-slate-150'}`}>
                  <div>
                    <label className={`block text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Continuous Mode</label>
                    <span className="text-[10px] text-slate-550">Keep microphone active after assistant responses</span>
                  </div>
                  <button
                    onClick={() => setVoiceSettings({ continuousMode: !voiceSettings.continuousMode })}
                    className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors ${voiceSettings.continuousMode ? 'bg-violet-600' : 'bg-slate-800'}`}
                  >
                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-200 ease-in-out ${voiceSettings.continuousMode ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            )}

            {/* TAB: MODEL SETTINGS */}
            {activeSettingsTab === 'model' && (
              <div className="space-y-4">
                <div>
                  <label className={`block text-[10px] uppercase font-bold mb-1.5 ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>Active LLM Model</label>
                  <select
                    value={modelSettings.modelName}
                    onChange={(e) => setModelSettings({ modelName: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-violet-500 font-semibold ${isDark ? 'bg-slate-900 border-slate-850 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                  >
                      <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                      <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</option>
                      <option value="cohere-command-r">Cohere Command-R</option>
                      <option value="cohere-command-r-plus">Cohere Command-R+</option>
                      <option value="cohere-command-light">Cohere Command-Light</option>
                      <option value="gpt-4o-mini">OpenAI GPT-4o Mini (Efficient)</option>
                      <option value="gpt-4o">OpenAI GPT-4o (Premium)</option>
                  </select>
                </div>

                <div>
                  <div className="flex justify-between text-[10px] uppercase font-bold text-slate-500 mb-1.5">
                    <span>Temperature</span>
                    <span className="text-violet-400 font-bold font-mono">{modelSettings.temperature}</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="1.0"
                    step="0.1"
                    value={modelSettings.temperature}
                    onChange={(e) => setModelSettings({ temperature: parseFloat(e.target.value) })}
                    className="w-full accent-violet-500 cursor-pointer"
                  />
                </div>

                <div>
                  <label className={`block text-[10px] uppercase font-bold mb-1.5 ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>System Instructions Override</label>
                  <textarea
                    value={modelSettings.systemPrompt}
                    onChange={(e) => setModelSettings({ systemPrompt: e.target.value })}
                    placeholder="e.g. You are a helpful code assistant..."
                    rows={3}
                    className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-violet-500 font-semibold ${isDark ? 'bg-slate-900 border-slate-855 text-slate-250 placeholder-slate-700' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'
                      }`}
                  />
                </div>

                <div className={`pt-2 border-t space-y-3 ${isDark ? 'border-slate-900' : 'border-slate-150'}`}>
                  <h4 className={`text-[10px] uppercase font-bold ${isDark ? 'text-slate-550' : 'text-slate-400'}`}>API Credentials (Stored locally)</h4>
                  <div>
                    <label className={`block text-[10px] mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Gemini API Key</label>
                    <input
                      type="password"
                      value={modelSettings.geminiApiKey}
                      onChange={(e) => setModelSettings({ geminiApiKey: e.target.value })}
                      placeholder="AIzaSy..."
                      className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-violet-500 font-mono ${isDark ? 'bg-slate-900 border-slate-855 text-slate-200 placeholder-slate-700' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'
                        }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-[10px] mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Cohere API Key</label>
                    <input
                      type="password"
                      value={modelSettings.cohereApiKey}
                      onChange={(e) => setModelSettings({ cohereApiKey: e.target.value })}
                      placeholder="Zi..."
                      className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-violet-500 font-mono ${isDark ? 'bg-slate-900 border-slate-855 text-slate-200 placeholder-slate-700' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'
                        }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-[10px] mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>OpenAI API Key</label>
                    <input
                      type="password"
                      value={modelSettings.openaiApiKey}
                      onChange={(e) => setModelSettings({ openaiApiKey: e.target.value })}
                      placeholder="sk-proj-..."
                      className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-violet-500 font-mono ${isDark ? 'bg-slate-900 border-slate-855 text-slate-200 placeholder-slate-700' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'
                        }`}
                    />
                  </div>
                    <div>
                      <label className={`block text-[10px] mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Replicate API Key (Image/Video Gen)</label>
                    <input
                      type="password"
                      value={modelSettings.replicateApiKey}
                      onChange={(e) => setModelSettings({ replicateApiKey: e.target.value })}
                      placeholder="r8_..."
                      className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-violet-500 font-mono ${isDark ? 'bg-slate-900 border-slate-855 text-slate-200 placeholder-slate-700' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'
                        }`}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB: RAG SETTINGS */}
            {activeSettingsTab === 'rag' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className={`block text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Enable Vector Context RAG</label>
                    <span className="text-[10px] text-slate-500">Query relevant chunks from uploaded documents</span>
                  </div>
                  <button
                    onClick={() => setModelSettings({ enableRag: !modelSettings.enableRag })}
                    className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors ${modelSettings.enableRag ? 'bg-violet-600' : 'bg-slate-800'}`}
                  >
                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-200 ease-in-out ${modelSettings.enableRag ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>

                {modelSettings.enableRag && (
                  <div>
                    <div className="flex justify-between text-[10px] uppercase font-bold text-slate-500 mb-1.5">
                      <span>Retrieved Chunk Count (k)</span>
                      <span className="text-violet-400 font-bold font-mono">{modelSettings.ragK}</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      step="1"
                      value={modelSettings.ragK}
                      onChange={(e) => setModelSettings({ ragK: parseInt(e.target.value) })}
                      className="w-full accent-violet-500 cursor-pointer"
                    />
                  </div>
                )}

                <div className={`pt-2 border-t space-y-3 ${isDark ? 'border-slate-900' : 'border-slate-150'}`}>
                  <label className={`block text-[10px] uppercase font-bold ${isDark ? 'text-slate-550' : 'text-slate-400'}`}>Ingest Context Document (PDF, TXT)</label>
                  <div className={`flex flex-col items-center justify-center p-6 border border-dashed rounded-2xl text-center hover:border-violet-650 transition-colors relative ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}>
                    <input
                      type="file"
                      accept=".pdf,.txt"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          setSelectedFile(e.target.files[0]);
                        }
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Upload className="w-8 h-8 text-violet-400/80 mb-2" />
                    <p className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      {selectedFile ? selectedFile.name : 'Select or drop a file here'}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Files are parsed, chunked, and embedded into local vector database.
                    </p>
                  </div>

                  {selectedFile && (
                    <button
                      onClick={async () => {
                        if (!selectedFile) return;
                        setIsUploading(true);
                        setUploadStatus('Processing document...');
                        try {
                          const res = await apiService.uploadDocument(token!, selectedFile, modelSettings);
                          setUploadStatus(`Success: ${res.filename} indexed (${res.chunks_indexed} chunks)`);
                          setSelectedFile(null);
                        } catch (err: any) {
                          console.error(err);
                          setUploadStatus(`Error: ${err.message || 'Failed to upload document'}`);
                        } finally {
                          setIsUploading(false);
                        }
                      }}
                      disabled={isUploading}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-violet-600 hover:bg-violet-550 text-white rounded-xl text-xs font-bold disabled:bg-slate-800 transition-all shadow-md cursor-pointer"
                    >
                      {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Start Indexing Ingest'}
                    </button>
                  )}

                  {uploadStatus && (
                    <p className={`text-[10px] text-center font-bold ${uploadStatus.startsWith('Error') ? 'text-red-400' : 'text-violet-400'}`}>
                      {uploadStatus}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={`p-4 border-t text-center flex-shrink-0 ${isDark ? 'bg-slate-900/60 border-slate-900' : 'bg-slate-50 border-slate-150'}`}>
          <button
            onClick={() => {
              setUploadStatus(null);
              setIsSettingsOpen(false);
            }}
            className={`px-6 py-2 border rounded-xl text-xs font-bold transition-colors cursor-pointer ${isDark ? 'bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
          >
            Close Panel
          </button>
        </div>
      </div>
    </div>
  )
}
    </div >
  );

return chatContent;
}
