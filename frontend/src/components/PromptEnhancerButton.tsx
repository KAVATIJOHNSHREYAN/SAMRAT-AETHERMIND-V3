/* eslint-disable */
'use client';

import React, { useState } from 'react';
import { Sparkles, Wand2, RefreshCw } from 'lucide-react';

interface PromptEnhancerButtonProps {
  currentPrompt: string;
  onEnhance: (enhancedPrompt: string) => void;
  type?: 'general' | 'image' | 'code';
  className?: string;
}

export default function PromptEnhancerButton({
  currentPrompt,
  onEnhance,
  type = 'general',
  className = ''
}: PromptEnhancerButtonProps) {
  const [isEnhancing, setIsEnhancing] = useState(false);

  const handleEnhancePrompt = async () => {
    if (!currentPrompt.trim()) return;

    setIsEnhancing(true);

    try {
      // Rule-based & heuristic intelligent neural prompt expander
      let enhanced = currentPrompt.trim();

      if (type === 'image') {
        const visualKeywords = [
          'ultra photorealistic',
          '8k octane render',
          'cinematic lighting',
          'hyper-detailed textures',
          'volumetric atmosphere',
          'masterpiece composition'
        ];
        // Ensure prompt doesn't already contain these
        const missing = visualKeywords.filter(k => !enhanced.toLowerCase().includes(k));
        enhanced = `${enhanced}, ${missing.join(', ')}`;
      } else if (type === 'code') {
        enhanced = `Provide a clean, robust, modern, production-grade implementation for: ${enhanced}. Include step-by-step code, edge-case error handling, and performance optimizations.`;
      } else {
        enhanced = `Deep-dive analysis on: ${enhanced}. Please provide comprehensive, highly detailed, step-by-step insights with actionable examples and key takeaways.`;
      }

      onEnhance(enhanced);
    } catch (err) {
      console.warn('Prompt enhancement error:', err);
    } finally {
      setIsEnhancing(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleEnhancePrompt}
      disabled={isEnhancing || !currentPrompt.trim()}
      className={`px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-violet-600/30 to-cyan-500/30 hover:from-violet-600/50 hover:to-cyan-500/50 border border-violet-500/40 text-violet-300 hover:text-white text-[10px] font-extrabold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-30 ${className}`}
      title="1-Click Magic AI Prompt Enhancer"
    >
      {isEnhancing ? (
        <RefreshCw className="w-3 h-3 animate-spin text-cyan-400" />
      ) : (
        <Wand2 className="w-3 h-3 text-cyan-400" />
      )}
      <span>Magic Enhance</span>
    </button>
  );
}
