const getBaseUrl = (): string => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.endsWith("/api/v1")
      ? process.env.NEXT_PUBLIC_API_URL
      : `${process.env.NEXT_PUBLIC_API_URL}/api/v1`;
  }

  if (typeof window !== "undefined") {
    const origin = window.location.origin;

    if (
      origin.includes("localhost") ||
      origin.includes("127.0.0.1")
    ) {
      return "http://localhost:8000/api/v1";
    }
    
    // In production, the backend is hosted under the routePrefix /_/backend
    return `${origin}/_/backend/api/v1`;
  }

  return "http://localhost:8000/api/v1";
};

const BASE_URL = getBaseUrl();
const ROOT_URL = BASE_URL.replace("/api/v1", "");
import { ModelSettings } from '@/store/chatStore';

export function getHeaders(token: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const apiService = {
  async register(email: string, password: string) {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Registration failed' }));
      throw new Error(err.detail || 'Registration failed');
    }
    return res.json();
  },

  async login(email: string, password: string) {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Authentication failed' }));
      throw new Error(err.detail || 'Authentication failed');
    }
    return res.json();
  },

  async googleLogin(email: string, name: string, profilePic: string) {
    const res = await fetch(`${BASE_URL}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, profile_pic: profilePic }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Google sign-in failed' }));
      throw new Error(err.detail || 'Google sign-in failed');
    }
    return res.json();
  },

  async biometricLogin(mode: 'fingerprint' | 'face') {
    const res = await fetch(`${BASE_URL}/auth/biometric`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Biometric sign-in failed' }));
      throw new Error(err.detail || 'Biometric sign-in failed');
    }
    return res.json();
  },

  async getProfile(token: string) {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      headers: getHeaders(token),
    });
    if (!res.ok) throw new Error('Failed to load profile');
    return res.json();
  },

  async updateProfile(token: string, data: { username?: string; preferred_language?: string; interface_style?: string; theme_style?: string }) {
    const res = await fetch(`${BASE_URL}/profile`, {
      method: 'PATCH',
      headers: getHeaders(token),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to update profile' }));
      throw new Error(err.detail || 'Failed to update profile');
    }
    return res.json();
  },

  async uploadProfilePicture(token: string, file: File) {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${BASE_URL}/profile/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to upload profile picture' }));
      throw new Error(err.detail || 'Failed to upload profile picture');
    }
    return res.json();
  },

  async getChats(token: string) {
    const res = await fetch(`${BASE_URL}/chat`, {
      headers: getHeaders(token),
    });
    if (!res.ok) throw new Error('Failed to load chat channels');
    return res.json();
  },

  async createChat(token: string, title = 'New Chat', mode = 'general') {
    const res = await fetch(`${BASE_URL}/chat`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ title, mode }),
    });
    if (!res.ok) throw new Error('Failed to create chat channel');
    return res.json();
  },

  async getChatHistory(token: string, chatId: string) {
    const res = await fetch(`${BASE_URL}/chat/${chatId}/history`, {
      headers: getHeaders(token),
    });
    if (!res.ok) throw new Error('Failed to load chat messages');
    return res.json();
  },

  async uploadDocument(token: string, file: File, settings: ModelSettings) {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (settings.geminiApiKey) {
      headers['X-Gemini-API-Key'] = settings.geminiApiKey;
    }
    if (settings.openaiApiKey) {
      headers['X-OpenAI-API-Key'] = settings.openaiApiKey;
    }

    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${BASE_URL}/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(err.detail || 'Upload failed');
    }
    return res.json();
  },

  async sendMessageStream(
    token: string,
    chatId: string,
    content: string,
    settings: ModelSettings,
    attachments: any[] | null,
    onChunk: (chunk: string) => void,
    onDone?: () => void
  ) {
    const headers: Record<string, string> = getHeaders(token);
    if (settings.geminiApiKey) {
      headers['X-Gemini-API-Key'] = settings.geminiApiKey;
    }
    if (settings.openaiApiKey) {
      headers['X-OpenAI-API-Key'] = settings.openaiApiKey;
    }
    if (settings.replicateApiKey) {
      headers['X-Replicate-API-Key'] = settings.replicateApiKey;
    }
    if (settings.cohereApiKey) {
      headers['X-Cohere-API-Key'] = settings.cohereApiKey;
    }

    const res = await fetch(`${BASE_URL}/chat/${chatId}/message`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        content,
        model_name: settings.modelName,
        temperature: settings.temperature,
        system_prompt: settings.systemPrompt,
        enable_rag: settings.enableRag,
        rag_k: settings.ragK,
        gemini_key: settings.geminiApiKey,
        openai_key: settings.openaiApiKey,
        attachments: attachments || null
      })
    });

    if (!res.ok) {
      throw new Error('Streaming connection failed');
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No readable body stream found');

    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');

        // Save the last partial line back to buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          const cleanLine = line.trim();
          if (cleanLine.startsWith('data: ')) {
            try {
              console.log('RAW SSE DATA:', cleanLine.substring(6));
              const dataObj = JSON.parse(cleanLine.substring(6));
              if (dataObj && dataObj.chunk) {
                console.log('EXTRACTED CHUNK:', dataObj.chunk);
                onChunk(dataObj.chunk);
              }
            } catch (err) {
              console.error('SSE PARSE ERROR:', err);
              // Ignore partial parsing errors
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
      onDone?.();
    }
  },

  // --- NEW PRODUCTION SERVICES ---

  async transcribeVoice(token: string, file: Blob, settings: ModelSettings) {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (settings.openaiApiKey) headers['X-OpenAI-API-Key'] = settings.openaiApiKey;

    const formData = new FormData();
    formData.append('file', file, 'audio.webm');

    const res = await fetch(`${ROOT_URL}/voice/transcribe`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!res.ok) throw new Error('Voice transcription failed');
    return res.json();
  },

  async speakText(token: string, text: string, settings: ModelSettings) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (settings.openaiApiKey) headers['X-OpenAI-API-Key'] = settings.openaiApiKey;

    const res = await fetch(`${ROOT_URL}/voice/speak`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error('Speech synthesis failed');
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },

  async generateImage(token: string, prompt: string, settings: ModelSettings) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (settings.openaiApiKey) headers['X-OpenAI-API-Key'] = settings.openaiApiKey;

    const res = await fetch(`${ROOT_URL}/generate/image`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ prompt }),
    });
    if (!res.ok) throw new Error('Image generation failed');
    return res.json();
  },

  async generateVideo(token: string, prompt: string, settings: ModelSettings) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (settings.replicateApiKey) headers['X-Replicate-API-Key'] = settings.replicateApiKey;

    const res = await fetch(`${ROOT_URL}/generate/video`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ prompt }),
    });
    if (!res.ok) throw new Error('Video generation failed');
    return res.json();
  },

  async getTaskStatus(taskId: string) {
    const res = await fetch(`${ROOT_URL}/tasks/${taskId}`);
    if (!res.ok) throw new Error('Failed to retrieve task status');
    return res.json();
  },

  async uploadDocumentProduction(token: string, file: File) {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${ROOT_URL}/upload/document`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!res.ok) throw new Error('Document RAG upload failed');
    return res.json();
  },

  async searchWeb(query: string, maxResults = 5) {
    const res = await fetch(`${ROOT_URL}/search/web`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, max_results: maxResults }),
    });
    if (!res.ok) throw new Error('Web search query failed');
    return res.json();
  },

  async analyzeResume(token: string, file: File, jobDescription: string, settings: ModelSettings) {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (settings.openaiApiKey) headers['X-OpenAI-API-Key'] = settings.openaiApiKey;
    if (settings.geminiApiKey) headers['X-Gemini-API-Key'] = settings.geminiApiKey;
    if (settings.cohereApiKey) headers['X-Cohere-API-Key'] = settings.cohereApiKey;

    const formData = new FormData();
    formData.append('file', file);
    if (jobDescription) {
      formData.append('job_description', jobDescription);
    }

    const res = await fetch(`${ROOT_URL}/resume/analyze`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!res.ok) throw new Error('Resume matching analysis failed');
    return res.json();
  },

  async sendMessageStreamProduction(
    token: string,
    chatId: string | null,
    content: string,
    settings: ModelSettings,
    attachments: any[] | null,
    onChunk: (chunk: string) => void,
    onDone?: () => void
  ) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (settings.geminiApiKey) headers['X-Gemini-API-Key'] = settings.geminiApiKey;
    if (settings.openaiApiKey) headers['X-OpenAI-API-Key'] = settings.openaiApiKey;
    if (settings.replicateApiKey) headers['X-Replicate-API-Key'] = settings.replicateApiKey;
    if (settings.cohereApiKey) headers['X-Cohere-API-Key'] = settings.cohereApiKey;

    const res = await fetch(`${ROOT_URL}/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        content,
        chat_id: chatId || null,
        chat_history: null,
        model_name: settings.modelName,
        temperature: settings.temperature,
        system_prompt: settings.systemPrompt,
        enable_rag: settings.enableRag,
        rag_k: settings.ragK,
        attachments: attachments || null
      }),
    });

    if (!res.ok) throw new Error('Chat streaming connection failed');

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No readable body stream found');

    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const cleanLine = line.trim();
          if (cleanLine.startsWith('data: ')) {
            try {
              const dataObj = JSON.parse(cleanLine.substring(6));
              if (dataObj && dataObj.chunk) {
                onChunk(dataObj.chunk);
              }
            } catch (err) {
              // Ignore partial parsing errors
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
      onDone?.();
    }
  },

  // --- Chat Management ---

  async updateChat(token: string, chatId: string, updates: { title?: string, mode?: string, is_pinned?: boolean }) {
    const res = await fetch(`${BASE_URL}/chat/${chatId}`, {
      method: 'PUT',
      headers: getHeaders(token),
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update chat');
    return res.json();
  },

  async deleteChat(token: string, chatId: string) {
    const res = await fetch(`${BASE_URL}/chat/${chatId}`, {
      method: 'DELETE',
      headers: getHeaders(token),
    });
    if (!res.ok) throw new Error('Failed to delete chat');
    return res.json();
  },

  async deleteMessage(token: string, chatId: string, messageId: string) {
    const res = await fetch(`${BASE_URL}/chat/${chatId}/message/${messageId}`, {
      method: 'DELETE',
      headers: getHeaders(token),
    });
    if (!res.ok) throw new Error('Failed to delete message');
    return res.json();
  },

  // --- Authentication ---

  async logout() {
    // Clear local storage (logout is handled client-side)
    // Optional: call backend logout endpoint if it exists
    try {
      const res = await fetch(`${BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      // Don't throw error if logout endpoint doesn't exist
      if (!res.ok) console.warn('Backend logout failed');
    } catch (err) {
      console.warn('Logout endpoint not available');
    }
  },

  // --- Token Management ---

  async refreshToken(refreshToken: string) {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) throw new Error('Failed to refresh token');
    return res.json();
  },

  // --- Utility Functions ---

  async getHealthStatus() {
    const res = await fetch(`${ROOT_URL}/health`);
    if (!res.ok) throw new Error('Health check failed');
    return res.json();
  },

  setApiUrl(url: string) {
    // Allow runtime API URL configuration
    if (url.endsWith('/api/v1')) {
      return url;
    } else if (url.endsWith('/')) {
      return `${url}api/v1`;
    } else {
      return `${url}/api/v1`;
    }
  },

  // --- NEW DOC-CHAT SERVICES ---
  async getDocPdfs(token: string) {
    const res = await fetch(`${BASE_URL}/doc-chat/pdfs`, {
      headers: getHeaders(token),
    });
    if (!res.ok) throw new Error('Failed to load PDFs');
    return res.json();
  },

  async deleteDocPdf(token: string, pdfId: number) {
    const res = await fetch(`${BASE_URL}/doc-chat/delete/${pdfId}`, {
      method: 'DELETE',
      headers: getHeaders(token),
    });
    if (!res.ok) throw new Error('Failed to delete PDF');
    return res.json();
  },

  async getDocChatHistory(token: string, pdfId: number) {
    const res = await fetch(`${BASE_URL}/doc-chat/chat/${pdfId}`, {
      headers: getHeaders(token),
    });
    if (!res.ok) throw new Error('Failed to load document chat history');
    return res.json();
  },

  async sendDocChatMessage(token: string, pdfId: number, question: string, settings: ModelSettings) {
    const headers = getHeaders(token);
    if (settings.geminiApiKey) {
      headers['X-Gemini-API-Key'] = settings.geminiApiKey;
    }
    if (settings.openaiApiKey) {
      headers['X-OpenAI-API-Key'] = settings.openaiApiKey;
    }
    const res = await fetch(`${BASE_URL}/doc-chat/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ pdf_id: pdfId, question })
    });
    if (!res.ok) throw new Error('Document chat failed');
    return res.json();
  },

  async uploadDocPdf(token: string, file: File, settings: ModelSettings) {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (settings.geminiApiKey) {
      headers['X-Gemini-API-Key'] = settings.geminiApiKey;
    }
    if (settings.openaiApiKey) {
      headers['X-OpenAI-API-Key'] = settings.openaiApiKey;
    }

    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${BASE_URL}/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(err.detail || 'Upload failed');
    }
    return res.json();
  }
};
