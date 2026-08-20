/* eslint-disable */
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Upload, Trash2, Sliders, CheckCircle2, AlertCircle, RefreshCw, Download, Scissors, Maximize2, Sparkles, Smile, Eye } from 'lucide-react';

interface ImageEditStudioProps {
  token: string;
}

export default function ImageEditStudio({ token }: ImageEditStudioProps) {
  const [selectedTool, setSelectedTool] = useState<'remove_bg' | 'replace_bg' | 'inpaint' | 'outpaint' | 'upscale' | 'face_enhance'>('remove_bg');
  const [image, setImage] = useState<string | null>(null);
  const [mask, setMask] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
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

  // Load image onto canvas for inpainting mask
  useEffect(() => {
    if (selectedTool === 'inpaint' && image && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const img = new Image();
        img.onload = () => {
          // Resize canvas to match image or container aspect ratio
          const maxWidth = 500;
          const scaleFactor = Math.min(maxWidth / img.width, 1);
          canvas.width = img.width * scaleFactor;
          canvas.height = img.height * scaleFactor;
          
          // Draw base image
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          // Initialize mask canvas to transparent black
          ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
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

  // Canvas drawing handlers for Mask creation
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    draw(e);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || selectedTool !== 'inpaint' || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const { x, y } = getCanvasCoords(e);
      ctx.beginPath();
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 0, 0, 0.6)'; // Red semi-transparent mask
      ctx.fill();
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    generateMaskBase64();
  };

  const clearMask = () => {
    setMask(null);
    if (canvasRef.current && image) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
        img.src = image;
      }
    }
  };

  const generateMaskBase64 = () => {
    if (!canvasRef.current || !image) return;
    
    // We create a temporary black-and-white mask canvas
    // where black is the unmasked area and white is the painted/masked area
    const tempCanvas = document.createElement('canvas');
    const canvas = canvasRef.current;
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    
    const tempCtx = tempCanvas.getContext('2d');
    const ctx = canvas.getContext('2d');
    
    if (tempCtx && ctx) {
      // Get current screen canvas pixel data
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      
      const maskImgData = tempCtx.createImageData(canvas.width, canvas.height);
      const maskData = maskImgData.data;
      
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i+1];
        const b = data[i+2];
        const a = data[i+3];
        
        // If the pixel is significantly tinted with our red brush color (255, 0, 0)
        if (r > 200 && g < 50 && b < 50 && a > 100) {
          // White = Masked area
          maskData[i] = 255;
          maskData[i+1] = 255;
          maskData[i+2] = 255;
          maskData[i+3] = 255;
        } else {
          // Black = Unmasked area
          maskData[i] = 0;
          maskData[i+1] = 0;
          maskData[i+2] = 0;
          maskData[i+3] = 255;
        }
      }
      
      tempCtx.putImageData(maskImgData, 0, 0);
      setMask(tempCanvas.toDataURL('image/png'));
    }
  };

  const handleProcessImage = async () => {
    if (!image) {
      setErrorMessage('Please upload a source image first.');
      return;
    }
    if (selectedTool === 'inpaint' && !mask) {
      setErrorMessage('Please brush over the image to define the edit area.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setOutputUrl(null);
    setStatusMessage('Contacting server image processing pipelines...');

    try {
      const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
      const res = await fetch(`${BASE_URL}/image-edit/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          image,
          mask: selectedTool === 'inpaint' ? mask : null,
          prompt: ['replace_bg', 'inpaint', 'outpaint'].includes(selectedTool) ? prompt : null,
          tool: selectedTool,
          replicate_key: replicateKey || null
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to process image');
      }

      const data = await res.json();
      setOutputUrl(data.output_url);
      setStatusMessage(data.message || 'Image processing succeeded!');
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred during processing.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div id="image-edit-studio-container" className="flex flex-col gap-6 max-w-6xl mx-auto py-4">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-violet-500" />
            Image Studio
          </h2>
          <p className="text-xs text-slate-500 mt-1">Remove backgrounds, upscale, expand, and perform custom inpaint editing.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Tool Selector & Parameters (Lg: 4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-4">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5" />
              Edit Tools
            </div>

            {/* Tool Radio List */}
            <div className="flex flex-col gap-1">
              {[
                { id: 'remove_bg', label: 'Remove Background', desc: 'Isolate subjects instantly', icon: Scissors },
                { id: 'replace_bg', label: 'Replace Background', desc: 'Swap background using text prompt', icon: RefreshCw },
                { id: 'inpaint', label: 'Inpaint (Brush Edit)', desc: 'Modify specific areas only', icon: Sparkles },
                { id: 'outpaint', label: 'Outpaint (Expand)', desc: 'Extend scene margins', icon: Maximize2 },
                { id: 'upscale', label: 'Upscale (2x Resolution)', desc: 'Super-resolution rendering', icon: RefreshCw },
                { id: 'face_enhance', label: 'Face Enhancement', desc: 'Sharpen and restore faces', icon: Smile },
              ].map((t) => {
                const Icon = t.icon;
                const isSelected = selectedTool === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setSelectedTool(t.id as any);
                      setOutputUrl(null);
                      setErrorMessage(null);
                    }}
                    className={`w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all ${
                      isSelected
                        ? 'bg-violet-50 border-l-4 border-violet-500 text-violet-700 shadow-sm'
                        : 'hover:bg-slate-50 text-slate-600 border-l-4 border-transparent'
                    }`}
                  >
                    <Icon className={`w-4 h-4 mt-0.5 ${isSelected ? 'text-violet-500' : 'text-slate-400'}`} />
                    <div>
                      <div className="text-xs font-bold">{t.label}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{t.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Prompt/Inputs Settings */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-4">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Tool Parameters
            </div>

            {/* API Settings */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500">Replicate API Key (Optional)</label>
              <input
                type="password"
                placeholder="replicate_token_..."
                value={replicateKey}
                onChange={(e) => setReplicateKey(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-violet-500 bg-slate-50"
              />
              <p className="text-[9px] text-slate-400 leading-normal">
                Leave blank to run in simulated Keyless Fallback mode.
              </p>
            </div>

            {/* Text prompt for replacement tools */}
            {['replace_bg', 'inpaint', 'outpaint'].includes(selectedTool) && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500">Editing Prompt</label>
                <textarea
                  rows={3}
                  placeholder="Describe your edits (e.g. 'wearing fancy futuristic glasses', 'on a sunny tropical beach')"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-violet-500 bg-slate-50 resize-none"
                />
              </div>
            )}

            {/* Inpainting brush sliders */}
            {selectedTool === 'inpaint' && image && (
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-500">
                  <span>Brush Size</span>
                  <span>{brushSize}px</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="50"
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-violet-500"
                />
                <button
                  type="button"
                  onClick={clearMask}
                  className="w-full py-1.5 px-3 rounded-lg border border-slate-200 text-[10px] font-bold hover:bg-slate-50 text-slate-600 transition-colors"
                >
                  Clear Selection Mask
                </button>
              </div>
            )}

            {/* upscale scale select */}
            {selectedTool === 'upscale' && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500">Upscale Factor</label>
                <select
                  value={scale}
                  onChange={(e) => setScale(Number(e.target.value))}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-violet-500 bg-slate-50"
                >
                  <option value={2}>2x Super Resolution</option>
                  <option value={4}>4x (Requires Pro Key)</option>
                </select>
              </div>
            )}

            {/* Action CTA Button */}
            <button
              onClick={handleProcessImage}
              disabled={isProcessing || !image}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-md transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Process Image
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Source View & Result Panel (Lg: 8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Input File Box */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col gap-3 min-h-[380px]">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Source Image</span>
                {image && (
                  <button
                    type="button"
                    onClick={() => {
                      setImage(null);
                      setMask(null);
                      setOutputUrl(null);
                    }}
                    className="text-red-500 hover:text-red-600 p-1 hover:bg-red-50 rounded-md transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Upload Workspace Area */}
              <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl relative overflow-hidden bg-slate-50/50 p-4">
                {image ? (
                  selectedTool === 'inpaint' ? (
                    <div className="flex flex-col items-center gap-2">
                      <canvas
                        ref={canvasRef}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        className="max-w-full rounded-lg border border-slate-200 cursor-crosshair shadow-sm"
                        title="Brush over the specific pixels you want to edit."
                      />
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        Brush over the areas to apply inpainting edits.
                      </span>
                    </div>
                  ) : (
                    <img
                      src={image}
                      alt="source preview"
                      className="max-h-[300px] w-auto object-contain rounded-lg border border-slate-200 shadow-sm"
                    />
                  )
                ) : (
                  <label className="flex flex-col items-center justify-center gap-3 cursor-pointer w-full h-full py-8 text-center">
                    <div className="p-3 bg-violet-50 rounded-xl border border-violet-100 shadow-sm">
                      <Upload className="w-6 h-6 text-violet-500" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-700">Drag and drop or Upload image</div>
                      <div className="text-[10px] text-slate-400 mt-1">Supports PNG, JPEG up to 10MB</div>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Output File Box */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col gap-3 min-h-[380px]">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Output Result</span>
                {outputUrl && (
                  <a
                    href={outputUrl}
                    download="aether_edited_image.png"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 py-1 px-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[10px] font-bold text-slate-700 shadow-sm transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    Download
                  </a>
                )}
              </div>

              {/* Output Display Area */}
              <div className="flex-1 flex flex-col items-center justify-center border-2 border-slate-100 rounded-xl relative overflow-hidden bg-slate-50 p-4">
                {isProcessing ? (
                  <div className="flex flex-col items-center justify-center text-center gap-4 py-8">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full border-4 border-violet-100 border-t-violet-500 animate-spin" />
                      <Sparkles className="w-5 h-5 text-violet-500 absolute top-3.5 left-3.5 animate-pulse" />
                    </div>
                    <div className="max-w-[200px]">
                      <div className="text-xs font-bold text-slate-700 animate-pulse">Processing Edits</div>
                      <div className="text-[9px] text-slate-400 mt-1 leading-relaxed">
                        {statusMessage || 'Initializing Replicate API prediction...'}
                      </div>
                    </div>
                  </div>
                ) : outputUrl ? (
                  <img
                    src={outputUrl}
                    alt="output result"
                    className="max-h-[300px] w-auto object-contain rounded-lg border border-slate-200 shadow-md animate-fade-in"
                  />
                ) : (
                  <div className="text-center text-slate-400 max-w-[200px] flex flex-col items-center justify-center py-8">
                    <div className="p-3 bg-slate-100 rounded-xl border border-slate-200/50 mb-3">
                      <Sparkles className="w-6 h-6 text-slate-400" />
                    </div>
                    <div className="text-xs font-bold">Waiting for run</div>
                    <div className="text-[10px] mt-1">Edited outputs will show up here.</div>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Feedback Alerts */}
          {statusMessage && !isProcessing && (
            <div className="bg-emerald-50 border border-emerald-200/60 rounded-xl p-3.5 flex items-start gap-2.5 text-emerald-800 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-600 flex-shrink-0" />
              <div className="text-[10px] leading-relaxed">
                <span className="font-bold">Success: </span>
                {statusMessage}
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="bg-red-50 border border-red-200/60 rounded-xl p-3.5 flex items-start gap-2.5 text-red-800 animate-fade-in">
              <AlertCircle className="w-4 h-4 mt-0.5 text-red-600 flex-shrink-0" />
              <div className="text-[10px] leading-relaxed">
                <span className="font-bold">Error: </span>
                {errorMessage}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
