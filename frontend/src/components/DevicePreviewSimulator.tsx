/* eslint-disable */
'use client';

import React, { useState, useEffect } from 'react';
import {
  Monitor,
  Smartphone,
  Tablet,
  Laptop,
  RotateCw,
  X,
  Maximize2,
  Minimize2,
  Check,
  ChevronDown,
  Sparkles,
  Sliders
} from 'lucide-react';

export interface DevicePreset {
  id: string;
  name: string;
  category: 'Desktop' | 'Laptop' | 'Tablet' | 'Phone' | 'Custom';
  width: number;
  height: number;
  icon: React.ElementType;
}

export const DEVICE_PRESETS: DevicePreset[] = [
  { id: 'native', name: 'Native Responsive', category: 'Desktop', width: 0, height: 0, icon: Monitor },
  { id: 'desktop-1920', name: 'Desktop 1920', category: 'Desktop', width: 1920, height: 1080, icon: Monitor },
  { id: 'desktop-1440', name: 'Desktop 1440', category: 'Desktop', width: 1440, height: 900, icon: Monitor },
  { id: 'laptop-1366', name: 'Laptop 1366', category: 'Laptop', width: 1366, height: 768, icon: Laptop },
  { id: 'macbook', name: 'MacBook Pro 16', category: 'Laptop', width: 1728, height: 1117, icon: Laptop },
  { id: 'surface', name: 'Surface Laptop', category: 'Laptop', width: 1500, height: 1000, icon: Laptop },
  { id: 'ipad-landscape', name: 'iPad Landscape', category: 'Tablet', width: 1180, height: 820, icon: Tablet },
  { id: 'ipad-portrait', name: 'iPad Portrait', category: 'Tablet', width: 820, height: 1180, icon: Tablet },
  { id: 'ipad-mini', name: 'iPad Mini', category: 'Tablet', width: 744, height: 1133, icon: Tablet },
  { id: 'galaxy-tab', name: 'Galaxy Tab', category: 'Tablet', width: 800, height: 1280, icon: Tablet },
  { id: 'iphone-se', name: 'iPhone SE', category: 'Phone', width: 375, height: 667, icon: Smartphone },
  { id: 'iphone-14', name: 'iPhone 14', category: 'Phone', width: 390, height: 844, icon: Smartphone },
  { id: 'iphone-15-promax', name: 'iPhone 15 Pro Max', category: 'Phone', width: 430, height: 932, icon: Smartphone },
  { id: 'pixel-8', name: 'Pixel 8', category: 'Phone', width: 412, height: 915, icon: Smartphone },
  { id: 'galaxy-s24', name: 'Galaxy S24', category: 'Phone', width: 360, height: 780, icon: Smartphone },
];

interface DevicePreviewMenuProps {
  currentPreset: DevicePreset;
  onSelectPreset: (preset: DevicePreset) => void;
  isDark?: boolean;
}

export function DevicePreviewMenu({ currentPreset, onSelectPreset, isDark = true }: DevicePreviewMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customWidth, setCustomWidth] = useState(390);
  const [customHeight, setCustomHeight] = useState(844);
  const [activeTab, setActiveTab] = useState<'All' | 'Desktop' | 'Laptop' | 'Tablet' | 'Phone'>('All');

  const categories = ['All', 'Desktop', 'Laptop', 'Tablet', 'Phone'];

  const filteredPresets = activeTab === 'All' 
    ? DEVICE_PRESETS 
    : DEVICE_PRESETS.filter(p => p.category === activeTab || p.id === 'native');

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const customPreset: DevicePreset = {
      id: 'custom',
      name: `Custom (${customWidth} × ${customHeight})`,
      category: 'Custom',
      width: Number(customWidth) || 390,
      height: Number(customHeight) || 844,
      icon: Sliders
    };
    onSelectPreset(customPreset);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-left">
      {/* Device Toggle Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title="Device Preview Mode"
        className={`p-2 rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${
          currentPreset.id !== 'native'
            ? 'border-violet-500/50 bg-violet-600/20 text-violet-400 shadow-[0_0_12px_rgba(124,58,237,0.3)]'
            : isDark
            ? 'border-white/10 bg-white/[0.02] text-slate-355 hover:text-white hover:bg-white/[0.06]'
            : 'border-slate-200 bg-white text-slate-505 hover:text-[#0EA5E9]'
        }`}
      >
        <ResponsiveIcon preset={currentPreset} />
        {currentPreset.id !== 'native' && (
          <span className="text-[10px] font-mono font-bold tracking-tight hidden lg:inline-block">
            {currentPreset.width}×{currentPreset.height}
          </span>
        )}
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>

      {/* Modern Floating Dropdown Menu */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className={`absolute right-0 mt-2 w-80 rounded-2xl border shadow-2xl z-50 overflow-hidden backdrop-blur-xl transition-all animate-in fade-in zoom-in-95 ${
            isDark ? 'bg-slate-900/95 border-violet-500/20 text-white shadow-violet-950/40' : 'bg-white/95 border-slate-200 text-slate-800 shadow-slate-300/50'
          }`}>
            {/* Header */}
            <div className="p-3.5 border-b border-white/10 flex items-center justify-between bg-violet-950/20">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-400 animate-pulse" />
                <span className="text-xs font-black tracking-wider uppercase bg-gradient-to-r from-violet-400 to-indigo-300 bg-clip-text text-transparent">
                  Device Preview Simulator
                </span>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Category Filter Pills */}
            <div className="p-2 border-b border-white/5 flex gap-1 overflow-x-auto scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveTab(cat as any)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase transition-all whitespace-nowrap cursor-pointer ${
                    activeTab === cat
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Presets List */}
            <div className="max-h-64 overflow-y-auto p-2 space-y-1 scrollbar-thin">
              {filteredPresets.map((preset) => {
                const IconComponent = preset.icon;
                const isSelected = currentPreset.id === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => {
                      onSelectPreset(preset);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-violet-600/25 text-violet-300 border border-violet-500/40 font-bold'
                        : isDark
                        ? 'text-slate-300 hover:bg-white/[0.04] hover:text-white'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <IconComponent className={`w-4 h-4 ${isSelected ? 'text-violet-400' : 'text-slate-400'}`} />
                      <span>{preset.name}</span>
                    </div>
                    {preset.width > 0 ? (
                      <span className="text-[10px] font-mono opacity-60">
                        {preset.width} × {preset.height}
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase font-bold text-violet-400">Full</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Custom Width Input */}
            <form onSubmit={handleCustomSubmit} className="p-3 border-t border-white/10 bg-white/[0.02] space-y-2">
              <span className="text-[9px] uppercase font-black tracking-widest text-slate-400 block">Custom Resolution</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Width"
                  value={customWidth}
                  onChange={(e) => setCustomWidth(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/5 text-xs text-center font-mono text-white focus:border-violet-500 focus:outline-none"
                  min={280}
                  max={3840}
                />
                <span className="text-slate-500 text-xs font-bold">×</span>
                <input
                  type="number"
                  placeholder="Height"
                  value={customHeight}
                  onChange={(e) => setCustomHeight(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/5 text-xs text-center font-mono text-white focus:border-violet-500 focus:outline-none"
                  min={280}
                  max={2160}
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shrink-0 cursor-pointer"
                >
                  Apply
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

function ResponsiveIcon({ preset }: { preset: DevicePreset }) {
  if (preset.category === 'Phone') return <Smartphone className="w-4 h-4" />;
  if (preset.category === 'Tablet') return <Tablet className="w-4 h-4" />;
  if (preset.category === 'Laptop') return <Laptop className="w-4 h-4" />;
  return <Monitor className="w-4 h-4" />;
}

interface DeviceSimulatorWrapperProps {
  currentPreset: DevicePreset;
  onReset: () => void;
  children: React.ReactNode;
}

export function DeviceSimulatorWrapper({ currentPreset, onReset, children }: DeviceSimulatorWrapperProps) {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [scaleMultiplier, setScaleMultiplier] = useState<number>(0.85);

  if (currentPreset.id === 'native') {
    return <>{children}</>;
  }

  const baseWidth = orientation === 'landscape' ? Math.max(currentPreset.width, currentPreset.height) : Math.min(currentPreset.width, currentPreset.height);
  const baseHeight = orientation === 'landscape' ? Math.min(currentPreset.width, currentPreset.height) : Math.max(currentPreset.width, currentPreset.height);

  return (
    <div className="w-full min-h-screen bg-slate-950 flex flex-col items-center justify-start overflow-auto p-4 md:p-8 relative">
      {/* Top Device Simulator Floating Control Bar */}
      <div className="sticky top-4 z-50 mb-6 glass-panel px-5 py-2.5 rounded-2xl flex flex-wrap items-center justify-between gap-4 border border-violet-500/30 shadow-2xl shadow-violet-950/50 max-w-4xl w-full animate-in fade-in slide-in-from-top-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-violet-600/20 text-violet-400 border border-violet-500/30">
            <ResponsiveIcon preset={currentPreset} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black tracking-tight text-white">{currentPreset.name}</span>
              <span className="px-2 py-0.5 rounded-md bg-violet-950 text-violet-300 text-[10px] font-mono font-bold border border-violet-500/30">
                {baseWidth} × {baseHeight}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
              Active Simulation • {orientation}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Orientation Toggle */}
          <button
            onClick={() => setOrientation(orientation === 'portrait' ? 'landscape' : 'portrait')}
            className="px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-200 flex items-center gap-1.5 transition-all cursor-pointer"
            title="Rotate Device"
          >
            <RotateCw className="w-3.5 h-3.5 text-violet-400" />
            <span className="hidden sm:inline capitalize">{orientation}</span>
          </button>

          {/* Scale Buttons */}
          <div className="flex items-center bg-white/5 rounded-xl border border-white/10 p-0.5">
            {[0.65, 0.85, 1.0].map((sc) => (
              <button
                key={sc}
                onClick={() => setScaleMultiplier(sc)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  scaleMultiplier === sc
                    ? 'bg-violet-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {Math.round(sc * 100)}%
              </button>
            ))}
          </div>

          {/* Exit Simulator */}
          <button
            onClick={onReset}
            className="p-2 rounded-xl border border-red-500/30 bg-red-950/30 hover:bg-red-900/50 text-red-400 transition-all cursor-pointer"
            title="Exit Simulator"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Render Device Bezel Frame & Content Container */}
      <div
        className="device-viewport-container relative rounded-[36px] border-[12px] border-slate-800 bg-slate-900 overflow-hidden shadow-2xl device-frame-shadow transition-all duration-300"
        style={{
          width: `${baseWidth}px`,
          height: `${baseHeight}px`,
          transform: `scale(${scaleMultiplier})`,
          transformOrigin: 'top center'
        }}
      >
        {/* Dynamic Bezel Camera Notch / Speaker Pill for Phones & Tablets */}
        {(currentPreset.category === 'Phone' || currentPreset.category === 'Tablet') && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 w-28 h-4 bg-black rounded-full flex items-center justify-center gap-2 border border-slate-800">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-700" />
            <div className="w-1.5 h-1.5 rounded-full bg-blue-900/60" />
          </div>
        )}

        {/* Scaled Render Viewport */}
        <div className="w-full h-full overflow-y-auto scrollbar-thin flex flex-col bg-slate-950">
          {children}
        </div>
      </div>
    </div>
  );
}
