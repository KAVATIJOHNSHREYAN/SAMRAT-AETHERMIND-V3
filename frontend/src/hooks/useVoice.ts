/* eslint-disable */
'use client';

import { useState, useEffect, useRef } from 'react';
import { useChatStore } from '@/store/chatStore';

const langToCode: Record<string, string> = {
  'English': 'en-US',
  'Hindi': 'hi-IN',
  'Telugu': 'te-IN',
  'Marathi': 'mr-IN',
  'Tamil': 'ta-IN',
  'Kannada': 'kn-IN',
  'Malayalam': 'ml-IN',
  'Bengali': 'bn-IN',
  'Gujarati': 'gu-IN',
  'Punjabi': 'pa-IN'
};

const accentToCode: Record<string, string> = {
  'American': 'en-US',
  'British': 'en-GB',
  'Indian': 'en-IN',
  'Australian': 'en-AU'
};

interface UseVoiceOptions {
  onTranscript: (text: string) => void;
  onResponseEnd?: () => void;
  onError?: (error: string) => void;
}

export const useVoice = ({ onTranscript, onResponseEnd, onError }: UseVoiceOptions) => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  
  const { languageSettings, voiceSettings } = useChatStore();
  
  const recognitionRef = useRef<any>(null);
  const synthesisRef = useRef<SpeechSynthesis | null>(null);

  // Maintain latest callback references
  const onTranscriptRef = useRef(onTranscript);
  const onResponseEndRef = useRef(onResponseEnd);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
    onResponseEndRef.current = onResponseEnd;
    onErrorRef.current = onError;
  }, [onTranscript, onResponseEnd, onError]);

  useEffect(() => {
    // Check Speech Recognition & Synthesis availability
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        
        // Use configured text language for recognition
        recognition.lang = langToCode[languageSettings.textLanguage] || 'en-US';

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          if (transcript) {
            onTranscriptRef.current(transcript);
          }
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
          
          // Ignore normal user stop/abort actions
          if (event.error === 'aborted') {
            return;
          }

          if (onErrorRef.current) {
            let msg = event.error;
            if (event.error === 'not-allowed') {
              msg = 'Microphone permission blocked. Please enable mic access in your browser settings.';
            } else if (event.error === 'network') {
              msg = 'Speech network error. Please verify connection.';
            } else if (event.error === 'no-speech') {
              msg = 'No speech detected. Please speak closer to your microphone.';
            }
            onErrorRef.current(msg);
          }
        };

        recognitionRef.current = recognition;
        setTimeout(() => setSpeechSupported(true), 0);
      }
      
      synthesisRef.current = window.speechSynthesis;
    }
  }, []); // Run only on mount


  const startListening = async () => {
    if (!speechSupported || !recognitionRef.current) {
      alert('Speech recognition is not supported in this browser. Please try Google Chrome.');
      return;
    }
    // Stop speaking if active
    stopSpeaking();

    // Request permission explicitly on phone/desktop browsers to trigger user prompt
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Release stream tracks immediately after permission check
        stream.getTracks().forEach(track => track.stop());
      }
    } catch (e: any) {
      console.warn('Microphone permission request rejected:', e);
      if (onErrorRef.current) {
        onErrorRef.current('Microphone permission denied. Please allow mic access in your site settings.');
      }
      return;
    }

    try {
      recognitionRef.current.start();
    } catch (e: any) {
      console.warn(e);
      // If recognition is already starting or active, ignore and sync state
      if (e.name === 'InvalidStateError' || (e.message && e.message.includes('already started'))) {
        setIsListening(true);
        return;
      }
      if (onErrorRef.current) {
        onErrorRef.current(e.message || 'Failed to initialize microphone interface');
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn(e);
      }
    }
  };

  const speak = (text: string) => {
    if (!synthesisRef.current) return;
    
    // Stop active speech recognition first
    stopListening();
    
    // Cancel ongoing speech
    synthesisRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Apply pitch and speed
    utterance.pitch = voiceSettings.pitch || 1;
    utterance.rate = voiceSettings.speed || 1;
    
    const voices = synthesisRef.current.getVoices();
    let targetLang = langToCode[languageSettings.voiceLanguage] || 'en-US';
    
    // Apply accent for English
    if (languageSettings.voiceLanguage === 'English' && voiceSettings.accent) {
      targetLang = accentToCode[voiceSettings.accent] || 'en-US';
    }
    
    const langVoices = voices.filter(v => v.lang.startsWith(targetLang.split('-')[0]));
    
    let chosenVoice;
    
    // Personality heuristic filtering
    const isMale = voiceSettings.personality === 'Male';
    const isFemale = voiceSettings.personality === 'Female' || voiceSettings.personality === 'Friendly';
    
    if (isMale) {
      chosenVoice = langVoices.find(v => v.name.toLowerCase().includes('male') || v.name.toLowerCase().includes('guy'));
    } else if (isFemale) {
      const femaleVoiceNames = ['jenny', 'aria', 'samantha', 'zira', 'female', 'tessa', 'susan', 'karen'];
      chosenVoice = langVoices.find(v => femaleVoiceNames.some(f => v.name.toLowerCase().includes(f)));
    }
    
    if (!chosenVoice && langVoices.length > 0) {
      // Prioritize Google / Natural voices if available
      chosenVoice = langVoices.find(v => v.name.includes('Natural') || v.name.includes('Google')) || langVoices[0];
    }
    
    if (!chosenVoice) {
      chosenVoice = voices[0];
    }

    if (chosenVoice) {
      utterance.voice = chosenVoice;
    }

    utterance.onstart = () => {
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      if (onResponseEndRef.current) {
        onResponseEndRef.current();
      }
      
      // Auto-restart listening if continuous mode is enabled
      if (voiceSettings.continuousMode && speechSupported && recognitionRef.current) {
        setTimeout(() => {
          try {
            recognitionRef.current.start();
          } catch(e) { /* ignore */ }
        }, 500);
      }
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
    };

    synthesisRef.current.speak(utterance);
  };

  const stopSpeaking = () => {
    if (synthesisRef.current) {
      synthesisRef.current.cancel();
      setIsSpeaking(false);
    }
  };

  return {
    isListening,
    isSpeaking,
    speechSupported,
    startListening,
    stopListening,
    speak,
    stopSpeaking
  };
};
