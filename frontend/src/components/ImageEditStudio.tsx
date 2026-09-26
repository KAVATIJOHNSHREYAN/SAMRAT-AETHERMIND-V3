/* eslint-disable */
'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Trash2,
  Sliders,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Download,
  Scissors,
  Maximize2,
  Sparkles,
  Smile,
  Eye,
  Image as ImageIcon,
  Copy,
  Share2,
  ZoomIn,
  Wand2,
  Terminal,
  X,
  Layers,
  Check
} from 'lucide-react';

interface ImageEditStudioProps {
  token: string;
}

interface ImageResult {
  success: boolean;
  provider: string;
  imageUrl: string;
  prompt: string;
  width: number;
  height: number;
  generationTime: number;
  seed: number;
  metadata?: any;
}

export default function ImageEditStudio({ token }: ImageEditStudioProps) {
  const [studioMode, setStudioMode] = useState<'text2image' | 'editor'>('text2image');

  // Text-to-Image state
  const [genPrompt, setGenPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('Photorealistic');
  const [aspectRatio, setAspectRatio] = useState<'1024x1024' | '1280x720' | '720x1280'>('1024x1024');
  const [isGenerating, setIsGenerating] = useState(false);
  const [genResult, setGenResult] = useState<ImageResult | null>(null);
  const [genHistory, setGenHistory] = useState<ImageResult[]>([]);
  const [genError, setGenError] = useState<string | null>(null);
  const [genStatusText, setGenStatusText] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);

  // Editor Tools state
  const [selectedTool, setSelectedTool] = useState<'remove_bg' | 'replace_bg' | 'inpaint' | 'outpaint' | 'upscale' | 'face_enhance'>('remove_bg');
  const [image, setImage] = useState<string | null>(null);
  const [mask, setMask] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [scale, setScale] = useState(2);
  const [replicateKey, setReplicateKey] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Inpainting Canvas state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(20);

  const stylePresets = [
    { name: 'Photorealistic', suffix: 'ultra photorealistic 8k octane render hyper-detailed photography' },
    { name: 'Cyberpunk', suffix: 'cyberpunk neon synthwave futuristic glowing lights high tech concept art' },
    { name: '3D Render', suffix: '3d Pixar style smooth render vibrant colors volumetric lighting' },
    { name: 'Anime', suffix: 'japanese anime illustration high quality Makoto Shinkai studio ghibli style' },
    { name: 'Oil Painting', suffix: 'fine oil painting rich brush strokes classical masterpiece museum quality' },
    { name: 'Sci-Fi', suffix: 'epic sci-fi concept art deep space planetary stations futuristic technology' }
  ];

  const handleGenerateImage = async (overridePrompt?: string, attempt = 1) => {
    const promptToUse = overridePrompt || genPrompt;
    if (!promptToUse.trim()) {
      setGenError('Please enter an image prompt to generate.');
      return;
    }

    setIsGenerating(true);
    setGenError(null);
    setGenStatusText(attempt === 1 ? 'Contacting AetherMind Image Generation Engine...' : `Retrying generation (Attempt ${attempt}/3)...`);

    const selectedPreset = stylePresets.find(s => s.name === selectedStyle);
    const finalPrompt = selectedPreset ? `${promptToUse}, ${selectedPreset.suffix}` : promptToUse;

    try {
      const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://samrat-aethermind-v3.onrender.com/api/v1';
      const res = await fetch(`${BASE_URL}/image/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          prompt: finalPrompt,
          aspect_ratio: aspectRatio,
          style: selectedStyle
        })
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Failed to reach image generation provider.`);
      }

      const data = await res.json();
      if (!data.success && !data.image_url) {
        throw new Error(data.detail || 'Image generation returned an unserviceable payload.');
      }

      const result: ImageResult = {
        success: true,
        provider: data.provider || 'AetherMind Flux Engine',
        imageUrl: data.image_url,
        prompt: promptToUse,
        width: data.width || 1024,
        height: data.height || 1024,
        generationTime: data.generation_time || 1.2,
        seed: data.seed || Math.floor(Math.random() * 1000000),
        metadata: data.metadata || {}
      };

      setGenResult(result);
      setGenHistory(prev => [result, ...prev]);
      setGenStatusText(null);
      setRetryCount(0);
    } catch (err: any) {
      console.warn(`Image generation attempt ${attempt} failed:`, err);
      if (attempt < 3) {
        setTimeout(() => {
          handleGenerateImage(promptToUse, attempt + 1);
        }, 1200);
      } else {
        setGenError(err.message || 'Image generation service temporarily unavailable. Please try again.');
        setGenStatusText(null);
      }
    } finally {
      if (attempt >= 3 || genResult) {
        setIsGenerating(false);
      }
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Canvas drawing logic for Inpainting
  useEffect(() => {
    if (selectedTool === 'inpaint' && image && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const img = new Image();
        img.onload = () => {
          const maxWidth = 500;
          const scaleFactor = Math.min(maxWidth / img.width, 1);
          canvas.width = img.width * scaleFactor;
          canvas.height = img.height * scaleFactor;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
        img.src = image;
      }
    }
  }, [image, selectedTool]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setMask(null);
        setOutputUrl(null);
        setErrorMessage(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProcessImageEdit = async () => {
    if (!image) {
      setErrorMessage('Please upload a source image first.');
      return;
    }
    setIsProcessing(true);
    setErrorMessage(null);
    setOutputUrl(null);
    setStatusMessage('Processing image edit through server neural pipelines...');

    try {
      const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://samrat-aethermind-v3.onrender.com/api/v1';
      const res = await fetch(`${BASE_URL}/image-edit/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          image,
          mask: selectedTool === 'inpaint' ? mask : null,
          prompt: editPrompt,
          tool: selectedTool,
          replicate_key: replicateKey || null
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ detail: 'Image edit failed' }));
        throw new Error(data.detail || 'Image processing failed.');
      }

      const data = await res.json();
      setOutputUrl(data.output_url);
      setStatusMessage('Image edit completed successfully!');
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred during image processing.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div id="image-studio-root" className="flex flex-col gap-6 max-w-6xl mx-auto py-2">
      {/* Header Mode Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-white/10 pb-4 gap-4">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Sparkles className="w-6 h-6 text-violet-400" />
            Image Studio
          </h2>
          <p className="text-xs text-slate-400 mt-1">Generate AI visuals, remove backgrounds, upscale, and apply inpaint edits.</p>
        </div>

        {/* Mode Switcher Pills */}
        <div className="flex p-1 bg-slate-900 border border-slate-800 rounded-2xl">
          <button
            onClick={() => setStudioMode('text2image')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              studioMode === 'text2image'
                ? 'bg-violet-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5" />
            Text-to-Image Generator
          </button>
          <button
            onClick={() => setStudioMode('editor')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              studioMode === 'editor'
                ? 'bg-violet-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Scissors className="w-3.5 h-3.5" />
            Image Editor Tools
          </button>
        </div>
      </div>

      {/* MODE 1: TEXT-TO-IMAGE STUDIO */}
      {studioMode === 'text2image' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls Column (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-slate-950/70 border border-slate-850 rounded-2xl p-4 shadow-xl space-y-4">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">Prompt</label>
              <textarea
                rows={4}
                value={genPrompt}
                onChange={(e) => setGenPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleGenerateImage();
                  }
                }}
                placeholder="Describe what you want to see... e.g. A futuristic cybernetic tiger in a neon synthwave city at sunset"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 resize-none font-medium"
              />

              {/* Style Presets */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Artistic Style</label>
                <div className="grid grid-cols-2 gap-2">
                  {stylePresets.map(s => (
                    <button
                      key={s.name}
                      onClick={() => setSelectedStyle(s.name)}
                      className={`p-2 rounded-xl text-[11px] font-bold border transition-all text-left ${
                        selectedStyle === s.name
                          ? 'bg-violet-600/20 border-violet-500 text-violet-300 shadow-sm'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Aspect Ratio */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Dimensions</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: '1024x1024', label: 'Square (1:1)' },
                    { id: '1280x720', label: 'Landscape (16:9)' },
                    { id: '720x1280', label: 'Portrait (9:16)' }
                  ].map(ar => (
                    <button
                      key={ar.id}
                      onClick={() => setAspectRatio(ar.id as any)}
                      className={`py-2 px-1 rounded-xl text-[10px] font-bold border text-center transition-all ${
                        aspectRatio === ar.id
                          ? 'bg-violet-600/20 border-violet-500 text-violet-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {ar.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Generate CTA Button */}
              <button
                onClick={() => handleGenerateImage()}
                disabled={isGenerating || !genPrompt.trim()}
                className="w-full py-3 bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 disabled:opacity-40 text-white font-extrabold text-xs rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    Generating Visual...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    Generate Image
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Canvas Output Column (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-slate-950 border border-slate-850 rounded-2xl p-4 min-h-[480px] flex flex-col justify-between relative overflow-hidden shadow-2xl">
              {/* Top Controls Bar */}
              <div className="flex items-center justify-between pb-3 border-b border-white/5">
                <span className="text-xs font-bold text-slate-400 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-violet-400" />
                  Visual Canvas
                </span>

                {genResult && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyToClipboard(genResult.prompt, 'prompt')}
                      className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 hover:text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                      title="Copy Prompt"
                    >
                      {copiedField === 'prompt' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>Prompt</span>
                    </button>

                    <button
                      onClick={() => setFullscreenImage(genResult.imageUrl)}
                      className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 hover:text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                      title="Fullscreen Zoom"
                    >
                      <ZoomIn className="w-3 h-3" />
                      <span>Zoom</span>
                    </button>

                    <a
                      href={genResult.imageUrl}
                      download={`aether_art_${genResult.seed}.png`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-550 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer shadow-md"
                    >
                      <Download className="w-3 h-3" />
                      Download
                    </a>
                  </div>
                )}
              </div>

              {/* Main Image Display Area */}
              <div className="flex-1 flex flex-col items-center justify-center p-6 relative my-2">
                {isGenerating ? (
                  <div className="flex flex-col items-center justify-center text-center space-y-4 animate-pulse">
                    <div className="w-16 h-16 rounded-full border-4 border-violet-500/20 border-t-violet-500 animate-spin flex items-center justify-center">
                      <Sparkles className="w-6 h-6 text-violet-400" />
                    </div>
                    <p className="text-xs font-bold text-violet-300">{genStatusText || 'Creating neural masterpiece...'}</p>
                    <p className="text-[10px] text-slate-500">Multi-provider engine fallback & retries active</p>
                  </div>
                ) : genResult ? (
                  <div className="relative group max-w-full rounded-2xl overflow-hidden border border-violet-500/20 shadow-2xl">
                    <img
                      src={genResult.imageUrl}
                      alt={genResult.prompt}
                      className="max-h-[440px] w-auto object-contain rounded-2xl transition-transform duration-300 group-hover:scale-[1.01]"
                      onError={(e) => {
                        console.warn('Direct image load error, falling back to proxy');
                        const proxyUrl = `${process.env.NEXT_PUBLIC_API_URL || 'https://samrat-aethermind-v3.onrender.com/api/v1'}/image/proxy?url=${encodeURIComponent(genResult.imageUrl)}`;
                        e.currentTarget.src = proxyUrl;
                      }}
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-mono text-cyan-300 font-bold block">{genResult.provider}</span>
                        <span className="text-[11px] text-white font-medium line-clamp-1">{genResult.prompt}</span>
                      </div>
                      <button
                        onClick={() => handleGenerateImage(genResult.prompt)}
                        className="px-3 py-1.5 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white rounded-lg text-[10px] font-bold"
                      >
                        Regenerate
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-3 max-w-sm">
                    <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-violet-400">
                      <Wand2 className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-bold text-white">Your Canvas is Ready</h3>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Enter a detailed text prompt on the left to start generating high-resolution AI visuals with auto-fallback.
                    </p>
                  </div>
                )}
              </div>

              {/* Bottom Diagnostics Footer Bar */}
              {genResult && (
                <div className="flex items-center justify-between pt-3 border-t border-white/5 text-[10px] font-mono text-slate-400">
                  <div className="flex items-center gap-3">
                    <span>Engine: <strong className="text-violet-300">{genResult.provider}</strong></span>
                    <span>Time: <strong className="text-cyan-300">{genResult.generationTime}s</strong></span>
                    <span>Seed: <strong className="text-slate-300">{genResult.seed}</strong></span>
                  </div>
                  <button
                    onClick={() => setShowDebug(!showDebug)}
                    className="text-slate-400 hover:text-white flex items-center gap-1 font-bold cursor-pointer"
                  >
                    <Terminal className="w-3 h-3" />
                    Diagnostics
                  </button>
                </div>
              )}

              {/* Debug Drawer */}
              {showDebug && genResult && (
                <div className="mt-3 p-3 bg-black/80 border border-violet-500/30 rounded-xl text-[10px] font-mono text-slate-300 space-y-1">
                  <div>Status: <span className="text-emerald-400 font-bold">200 OK</span></div>
                  <div>Provider: <span className="text-violet-300">{genResult.provider}</span></div>
                  <div>Image URL: <span className="text-slate-400 truncate block max-w-full">{genResult.imageUrl}</span></div>
                  <div>Latency: <span className="text-cyan-300">{genResult.generationTime} seconds</span></div>
                </div>
              )}
            </div>

            {/* Generation History Gallery */}
            {genHistory.length > 0 && (
              <div className="bg-slate-950 border border-slate-850 rounded-2xl p-4 space-y-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Session History ({genHistory.length})</span>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-800">
                  {genHistory.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => setGenResult(item)}
                      className={`w-24 h-24 rounded-xl border flex-shrink-0 overflow-hidden cursor-pointer transition-all ${
                        genResult?.imageUrl === item.imageUrl ? 'border-violet-500 ring-2 ring-violet-500/40' : 'border-white/10 hover:border-white/30'
                      }`}
                    >
                      <img src={item.imageUrl} alt={item.prompt} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODE 2: IMAGE EDITOR TOOLS */}
      {studioMode === 'editor' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-slate-950 border border-slate-850 rounded-2xl p-4 space-y-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Edit Tool</span>
              <div className="space-y-1">
                {[
                  { id: 'remove_bg', label: 'Remove Background', desc: 'Isolate subjects instantly', icon: Scissors },
                  { id: 'replace_bg', label: 'Replace Background', desc: 'Swap scene backdrop', icon: RefreshCw },
                  { id: 'inpaint', label: 'Inpaint (Brush Edit)', desc: 'Brush & modify pixels', icon: Sparkles },
                  { id: 'outpaint', label: 'Outpaint (Expand)', desc: 'Extend scene bounds', icon: Maximize2 },
                  { id: 'upscale', label: 'Super Resolution Upscale', desc: 'Sharpen resolution', icon: RefreshCw },
                  { id: 'face_enhance', label: 'Face Enhancement', desc: 'Restore face details', icon: Smile }
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setSelectedTool(t.id as any);
                      setOutputUrl(null);
                      setErrorMessage(null);
                    }}
                    className={`w-full text-left p-3 rounded-xl border flex items-start gap-3 transition-all ${
                      selectedTool === t.id
                        ? 'bg-violet-600/20 border-violet-500 text-violet-300 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <t.icon className="w-4 h-4 mt-0.5 text-violet-400" />
                    <div>
                      <div className="text-xs">{t.label}</div>
                      <div className="text-[10px] text-slate-500 font-normal mt-0.5">{t.desc}</div>
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={handleProcessImageEdit}
                disabled={isProcessing || !image}
                className="w-full py-3 bg-violet-600 hover:bg-violet-550 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer mt-4"
              >
                {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Apply Edit Tool
              </button>
            </div>
          </div>

          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-950 border border-slate-850 rounded-2xl p-4 min-h-[360px] flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Source Image</span>
              <div className="flex-1 border-2 border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center p-4 bg-slate-900/50 relative">
                {image ? (
                  <img src={image} alt="Source" className="max-h-[280px] object-contain rounded-lg" />
                ) : (
                  <label className="flex flex-col items-center justify-center gap-2 cursor-pointer text-center">
                    <Upload className="w-8 h-8 text-violet-400" />
                    <span className="text-xs font-bold text-slate-300">Upload Image File</span>
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                )}
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-850 rounded-2xl p-4 min-h-[360px] flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Result</span>
              <div className="flex-1 border border-slate-800 rounded-xl flex flex-col items-center justify-center p-4 bg-slate-900/50">
                {isProcessing ? (
                  <div className="text-center space-y-2">
                    <RefreshCw className="w-8 h-8 text-violet-400 animate-spin mx-auto" />
                    <span className="text-xs font-bold text-slate-300 block">{statusMessage}</span>
                  </div>
                ) : outputUrl ? (
                  <img src={outputUrl} alt="Output" className="max-h-[280px] object-contain rounded-lg shadow-lg" />
                ) : (
                  <span className="text-xs text-slate-500 font-medium">Output will appear here after processing.</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Lightbox Modal */}
      {fullscreenImage && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative max-w-5xl max-h-[90vh]">
            <button
              onClick={() => setFullscreenImage(null)}
              className="absolute -top-12 right-0 text-slate-400 hover:text-white p-2 rounded-full bg-white/10"
            >
              <X className="w-6 h-6" />
            </button>
            <img src={fullscreenImage} alt="Fullscreen View" className="max-h-[85vh] max-w-full rounded-2xl shadow-2xl object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
