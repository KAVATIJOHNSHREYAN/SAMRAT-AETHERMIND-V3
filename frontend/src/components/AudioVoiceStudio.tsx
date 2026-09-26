/* eslint-disable */
'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Play,
  Square,
  Sparkles,
  Radio,
  Sliders,
  RefreshCw,
  Copy,
  Check,
  Zap,
  Globe,
  MessageSquare,
  Bot,
  User,
  Activity,
  Languages,
  RotateCcw
} from 'lucide-react';
import { useChatStore } from '@/store/chatStore';
import { apiService } from '@/services/api';

interface AudioVoiceStudioProps {
  token: string;
}

export default function AudioVoiceStudio({ token }: AudioVoiceStudioProps) {
  const { voiceSettings, setVoiceSettings, languageSettings, setLanguageSettings } = useChatStore();

  const [mode, setMode] = useState<'tts' | 'stt'>('tts');

  // TTS State
  const [ttsText, setTtsText] = useState('Welcome to SAMRAT AETHERMIND V3. Experience next-generation neural text-to-speech synthesis with real-time waveform visualization.');
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>('');
  const [pitch, setPitch] = useState<number>(1.0);
  const [rate, setRate] = useState<number>(1.0);
  const [emotionPreset, setEmotionPreset] = useState<'neutral' | 'friendly' | 'authoritative' | 'calm'>('friendly');
  const [isTTSSpeaking, setIsTTSSpeaking] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  // STT / Live Mic State
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [aiResponseText, setAiResponseText] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [continuousMode, setContinuousMode] = useState(false);

  // Visualizer Canvas Ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Speech Recognition & Synthesis refs
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // Load available Voices from Web Speech API
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;

      const updateVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        setAvailableVoices(voices);
        if (voices.length > 0 && !selectedVoiceURI) {
          const defaultUsVoice = voices.find(v => v.lang === 'en-US' || v.name.includes('Google US') || v.name.includes('Natural')) || voices[0];
          setSelectedVoiceURI(defaultUsVoice.voiceURI);
        }
      };

      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;

      return () => {
        if (window.speechSynthesis) {
          window.speechSynthesis.onvoiceschanged = null;
        }
      };
    }
  }, []);

  // Initialize Web Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onresult = (event: any) => {
          let currentText = '';
          for (let i = 0; i < event.results.length; i++) {
            currentText += event.results[i][0].transcript;
          }
          setLiveTranscript(currentText);
        };

        recognition.onend = () => {
          setIsListening(false);
          stopMicAnalyzer();
        };

        recognition.onerror = (event: any) => {
          console.warn('Speech recognition error:', event.error);
          setIsListening(false);
          stopMicAnalyzer();
        };

        recognitionRef.current = recognition;
      }
    }
  }, []);

  // Audio Canvas Waveform Visualizer
  const startCanvasVisualizer = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;

    const drawWaveform = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;

      // Outer Glow Effect
      ctx.shadowBlur = 15;
      ctx.shadowColor = isListening ? '#38bdf8' : '#a855f7';

      // Draw primary glowing sine waves
      for (let w = 0; w < 3; w++) {
        ctx.beginPath();
        ctx.lineWidth = 3 - w;
        ctx.strokeStyle = w === 0 ? 'rgba(168, 85, 247, 0.9)' : w === 1 ? 'rgba(56, 189, 248, 0.8)' : 'rgba(236, 72, 153, 0.7)';

        const freq = 0.02 + w * 0.01;
        const speed = 0.08 + w * 0.03;
        const amplitude = (isListening || isTTSSpeaking) ? (25 + Math.sin(phase * 2 + w) * 15) : 4;

        for (let x = 0; x < width; x++) {
          const y = centerY + Math.sin(x * freq + phase * speed + w) * amplitude;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      ctx.shadowBlur = 0;
      phase += 1;
      animFrameRef.current = requestAnimationFrame(drawWaveform);
    };

    drawWaveform();
  };

  const stopCanvasVisualizer = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const startMicAnalyzer = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 128;
        source.connect(analyser);

        audioCtxRef.current = audioCtx;
        analyserRef.current = analyser;
      }
    } catch (e) {
      console.warn('Mic audio context error:', e);
    }
  };

  const stopMicAnalyzer = () => {
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  };

  // Start Neural TTS Speech
  const handleSpeakTTS = (overrideText?: string) => {
    const textToSpeak = overrideText || ttsText;
    if (!textToSpeak.trim() || !synthRef.current) return;

    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(textToSpeak);

    // Apply selected voice
    if (selectedVoiceURI) {
      const chosen = availableVoices.find(v => v.voiceURI === selectedVoiceURI);
      if (chosen) utterance.voice = chosen;
    }

    // Apply pitch & rate adjustments based on emotion preset
    let finalPitch = pitch;
    let finalRate = rate;

    if (emotionPreset === 'friendly') {
      finalPitch = 1.1;
      finalRate = 1.05;
    } else if (emotionPreset === 'authoritative') {
      finalPitch = 0.9;
      finalRate = 0.95;
    } else if (emotionPreset === 'calm') {
      finalPitch = 0.95;
      finalRate = 0.9;
    }

    utterance.pitch = finalPitch;
    utterance.rate = finalRate;

    utterance.onstart = () => {
      setIsTTSSpeaking(true);
      startCanvasVisualizer();
    };

    utterance.onend = () => {
      setIsTTSSpeaking(false);
      stopCanvasVisualizer();
    };

    utterance.onerror = () => {
      setIsTTSSpeaking(false);
      stopCanvasVisualizer();
    };

    synthRef.current.speak(utterance);
  };

  const handleStopTTS = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsTTSSpeaking(false);
      stopCanvasVisualizer();
    }
  };

  // Toggle Speech Recognition
  const handleToggleListening = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser. Please try Google Chrome or Edge.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      stopCanvasVisualizer();
      stopMicAnalyzer();
    } else {
      setLiveTranscript('');
      setAiResponseText('');
      try {
        recognitionRef.current.start();
        setIsListening(true);
        startCanvasVisualizer();
        startMicAnalyzer();
      } catch (e: any) {
        console.warn('Recognition start error:', e);
      }
    }
  };

  // Send live voice transcript to AI backend
  const handleSendVoiceToAI = async () => {
    if (!liveTranscript.trim() || isAiProcessing) return;

    setIsAiProcessing(true);
    setAiResponseText('');

    try {
      const activeToken = token || (typeof window !== 'undefined' ? (localStorage.getItem('aether_token') || localStorage.getItem('auth_token')) : null);
      const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://samrat-aethermind-v3.onrender.com/api/v1';
      const cleanBase = BASE_URL.endsWith('/api/v1') ? BASE_URL : `${BASE_URL}/api/v1`;

      // Create temporary chat or stream response directly
      const res = await fetch(`${cleanBase}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { 'Authorization': `Bearer ${activeToken}` } : {})
        },
        body: JSON.stringify({
          message: liveTranscript,
          model: 'auto',
          temperature: 0.7
        })
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Failed to process voice request.`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6));
                if (data.content) {
                  fullText += data.content;
                  setAiResponseText(fullText);
                }
              } catch (e) {
                // Ignore parse errors for raw text chunks
                if (line.substring(6) !== '[DONE]') {
                  fullText += line.substring(6);
                  setAiResponseText(fullText);
                }
              }
            }
          }
        }
      }

      // Automatically speak the reply out loud once complete
      if (fullText) {
        handleSpeakTTS(fullText);
      }

    } catch (err: any) {
      console.error('Voice AI query error:', err);
      setAiResponseText(`Error: ${err.message || 'AI service temporarily unavailable.'}`);
    } finally {
      setIsAiProcessing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  return (
    <div id="audio-studio-root" className="flex flex-col gap-6 max-w-6xl mx-auto py-2">
      {/* Studio Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-white/10 pb-4 gap-4">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Volume2 className="w-6 h-6 text-cyan-400" />
            Audio & Voice Neural Studio
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            API-less Neural Text-to-Speech synthesis, custom voice accents, and live audio waveform transcriptions.
          </p>
        </div>

        {/* Studio Mode Selector Pills */}
        <div className="flex p-1 bg-slate-900 border border-slate-800 rounded-2xl">
          <button
            onClick={() => setMode('tts')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              mode === 'tts'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Neural Text-to-Speech (TTS)
          </button>
          <button
            onClick={() => setMode('stt')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              mode === 'stt'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            Real-time Voice Input
          </button>
        </div>
      </div>

      {/* Visualizer Header Waveform Canvas */}
      <div className="bg-slate-950 border border-slate-850 rounded-2xl p-4 shadow-2xl relative overflow-hidden flex flex-col items-center justify-center min-h-[140px]">
        <canvas
          ref={canvasRef}
          width={700}
          height={100}
          className="w-full h-24 object-contain"
        />
        <div className="absolute top-3 left-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span className="text-[10px] font-mono font-bold text-cyan-300 uppercase tracking-widest">
            {isListening ? 'LIVE MICROPHONE FREQUENCY WAVEFORM' : isTTSSpeaking ? 'NEURAL SYNTHESIS WAVEFORM' : 'WAVEFORM ENGINE READY'}
          </span>
        </div>
      </div>

      {/* MODE 1: NEURAL TEXT-TO-SPEECH (TTS) */}
      {mode === 'tts' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls Sidebar (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-slate-950 border border-slate-850 rounded-2xl p-4 space-y-4 shadow-xl">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Voice & Accent Settings</span>

              {/* Voice Selector */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Select Neural Voice</label>
                <select
                  value={selectedVoiceURI}
                  onChange={(e) => setSelectedVoiceURI(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-medium"
                >
                  {availableVoices.map(v => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
              </div>

              {/* Emotion Presets */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Voice Tone Preset</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'friendly', label: 'Friendly / Warm' },
                    { id: 'authoritative', label: 'Authoritative' },
                    { id: 'calm', label: 'Calm / Relaxed' },
                    { id: 'neutral', label: 'Neutral Studio' }
                  ].map(e => (
                    <button
                      key={e.id}
                      onClick={() => setEmotionPreset(e.id as any)}
                      className={`p-2 rounded-xl text-[11px] font-bold border transition-all text-left ${
                        emotionPreset === e.id
                          ? 'bg-cyan-600/20 border-cyan-500 text-cyan-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {e.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pitch & Rate Sliders */}
              <div className="space-y-3 pt-2">
                <div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold mb-1">
                    <span>SPEED / RATE</span>
                    <span className="text-cyan-400">{rate}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={rate}
                    onChange={(e) => setRate(parseFloat(e.target.value))}
                    className="w-full accent-cyan-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold mb-1">
                    <span>PITCH MODULATION</span>
                    <span className="text-cyan-400">{pitch}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={pitch}
                    onChange={(e) => setPitch(parseFloat(e.target.value))}
                    className="w-full accent-cyan-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              {/* Play / Stop Action CTA */}
              <div className="flex gap-2 pt-2">
                {isTTSSpeaking ? (
                  <button
                    onClick={handleStopTTS}
                    className="w-full py-3 bg-rose-600 hover:bg-rose-550 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Square className="w-4 h-4" />
                    Stop Speech
                  </button>
                ) : (
                  <button
                    onClick={() => handleSpeakTTS()}
                    className="w-full py-3 bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-550 hover:to-violet-550 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Synthesize Neural Speech
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Text Input & Canvas Preview (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-slate-950 border border-slate-850 rounded-2xl p-4 shadow-2xl space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-cyan-400" />
                  Script / Text to Synthesize
                </span>
                <button
                  onClick={() => copyToClipboard(ttsText)}
                  className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  {copiedText ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  Copy Text
                </button>
              </div>

              <textarea
                rows={8}
                value={ttsText}
                onChange={(e) => setTtsText(e.target.value)}
                placeholder="Enter or paste any text script to generate realistic speech..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none font-medium leading-relaxed"
              />

              {/* Sample Preset Script Buttons */}
              <div className="space-y-1.5 pt-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Starter Sample Scripts</span>
                <div className="flex flex-wrap gap-2">
                  {[
                    "SAMRAT AETHERMIND V3 is an intelligent multimodal AI platform designed for speech, vision, and deep analytics.",
                    "System diagnostic complete. All 6 image processing tools and neural voice engines are operating at peak efficiency.",
                    "Welcome back user. Voice command pipeline is active and ready for input."
                  ].map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => setTtsText(s)}
                      className="px-2.5 py-1.5 bg-slate-900 border border-slate-850 hover:border-cyan-500/50 rounded-xl text-[10px] text-slate-300 hover:text-white transition-all text-left"
                    >
                      Sample {idx + 1}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: REAL-TIME VOICE INPUT */}
      {mode === 'stt' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Mic Interaction Orb Panel (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-slate-950 border border-slate-850 rounded-2xl p-6 shadow-xl flex flex-col items-center justify-center text-center space-y-5 min-h-[340px]">
              <div className="relative">
                <button
                  onClick={handleToggleListening}
                  className={`w-24 h-24 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-2xl ${
                    isListening
                      ? 'bg-rose-600 text-white animate-pulse ring-8 ring-rose-500/30 shadow-rose-500/50'
                      : 'bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-550 hover:to-violet-550 text-white ring-4 ring-cyan-500/20'
                  }`}
                >
                  {isListening ? <MicOff className="w-10 h-10" /> : <Mic className="w-10 h-10" />}
                </button>
              </div>

              <div>
                <h3 className="text-sm font-bold text-white">
                  {isListening ? 'Listening to your voice...' : 'Click Mic to Speak'}
                </h3>
                <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                  {isListening ? 'Speak naturally. Streaming transcription is active.' : 'Uses API-less browser Web Speech for instant response.'}
                </p>
              </div>

              {liveTranscript && (
                <button
                  onClick={handleSendVoiceToAI}
                  disabled={isAiProcessing || !liveTranscript.trim()}
                  className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-550 disabled:opacity-40 text-white font-extrabold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isAiProcessing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  Ask SAMRAT AI
                </button>
              )}
            </div>
          </div>

          {/* Transcript & Response Area (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            {/* User Spoken Transcript */}
            <div className="bg-slate-950 border border-slate-850 rounded-2xl p-4 shadow-2xl space-y-2">
              <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                Live Speech Transcript
              </span>
              <div className="p-3 bg-slate-900 border border-slate-850 rounded-xl min-h-[70px] text-xs text-white font-medium">
                {liveTranscript || <span className="text-slate-500 italic">Your spoken words will appear here in real time...</span>}
              </div>
            </div>

            {/* AI Voice Response Output */}
            <div className="bg-slate-950 border border-slate-850 rounded-2xl p-4 shadow-2xl space-y-2">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-[10px] font-bold text-violet-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5" />
                  SAMRAT AI Spoken Answer
                </span>
                {aiResponseText && (
                  <button
                    onClick={() => handleSpeakTTS(aiResponseText)}
                    className="px-2.5 py-1 bg-violet-600 hover:bg-violet-550 text-white text-[10px] font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                  >
                    <Volume2 className="w-3 h-3" />
                    Replay Audio
                  </button>
                )}
              </div>

              <div className="p-3 bg-slate-900 border border-slate-850 rounded-xl min-h-[140px] text-xs text-slate-200 font-medium leading-relaxed">
                {isAiProcessing ? (
                  <div className="flex items-center gap-2 text-cyan-400 font-bold animate-pulse">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Analyzing voice input and generating audio answer...</span>
                  </div>
                ) : aiResponseText ? (
                  aiResponseText
                ) : (
                  <span className="text-slate-500 italic">Click "Ask SAMRAT AI" after speaking to get spoken responses.</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
