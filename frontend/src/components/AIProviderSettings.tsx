'use client';

import React, { useState, useEffect } from 'react';
import {
  Cpu,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Zap,
  Server,
  Activity,
  Terminal,
  Shield,
  Layers,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Loader2
} from 'lucide-react';
import { apiService } from '@/services/api';

interface ProviderItem {
  id: string;
  name: string;
  configured: boolean;
  connected: boolean;
  detected_auto: boolean;
  masked_key: string | null;
  base_url?: string | null;
  models: string[];
  latency_ms: number;
  last_checked: string;
}

interface ProviderHealthResponse {
  has_configured_provider: boolean;
  active_default_provider: string;
  providers: ProviderItem[];
  diagnostics: {
    platform: string;
    environment: string;
    detected_count: number;
    total_supported: number;
    cache_status: string;
    env_scanned: { name: string; present: boolean; masked: string | null }[];
  };
}

interface AIProviderSettingsProps {
  isDark: boolean;
  modelSettings: any;
  setModelSettings: (settings: any) => void;
}

export function AIProviderSettings({ isDark, modelSettings, setModelSettings }: AIProviderSettingsProps) {
  const [data, setData] = useState<ProviderHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const fetchHealth = async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = force ? await apiService.refreshProviderHealth() : await apiService.getProviderHealth();
      setData(res);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to connect to backend provider health service.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHealth(false);
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h4 className={`text-sm font-bold flex items-center gap-2 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
            <Cpu className="w-4 h-4 text-violet-400" />
            Server AI Provider Registry & Health
          </h4>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Auto-detected server-side environment variables and dynamic model routing.
          </p>
        </div>

        <button
          onClick={() => fetchHealth(true)}
          disabled={refreshing || loading}
          className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-xl text-xs font-bold transition-all cursor-pointer ${
            isDark ? 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
          }`}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Scanning...' : 'Refresh Status'}
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-violet-400" /> Scanning server environment variables...
        </div>
      ) : error ? (
        <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-400 text-xs font-semibold">
          ⚠️ {error}
        </div>
      ) : data ? (
        <>
          {/* Status Summary Card */}
          <div className={`p-5 rounded-2xl border flex items-center justify-between gap-4 flex-wrap ${
            isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center gap-3.5">
              <div className={`p-3 rounded-2xl ${
                data.has_configured_provider ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
              }`}>
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-200">
                    {data.has_configured_provider ? 'Auto-Orchestration Ready' : 'Server Environment Pending'}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                    data.has_configured_provider ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}>
                    {data.diagnostics.detected_count} / {data.diagnostics.total_supported} Connected
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Platform: <span className="text-violet-400 font-bold">{data.diagnostics.platform}</span> • Default Engine: <span className="text-slate-300 font-bold uppercase">{data.active_default_provider}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={modelSettings.modelName}
                onChange={(e) => setModelSettings({ ...modelSettings, modelName: e.target.value })}
                className={`px-3 py-2 border rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-violet-500 ${
                  isDark ? 'bg-slate-950 border-slate-800 text-violet-400' : 'bg-white border-slate-200 text-slate-800'
                }`}
              >
                <option value="auto">Auto Orchestrated (Recommended)</option>
                {data.providers.filter(p => p.configured).flatMap(p => p.models.map(m => (
                  <option key={`${p.id}-${m}`} value={m}>
                    {p.name}: {m}
                  </option>
                )))}
              </select>
            </div>
          </div>

          {/* Provider Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {data.providers.map(p => (
              <div
                key={p.id}
                className={`p-4 rounded-2xl border transition-all ${
                  p.configured
                    ? isDark ? 'bg-slate-950/80 border-slate-800 hover:border-violet-500/30' : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                    : isDark ? 'bg-slate-950/30 border-slate-900 opacity-60' : 'bg-slate-50 border-slate-150 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                      {p.name}
                    </span>
                    {p.configured && (
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-violet-500/10 text-violet-400 border border-violet-500/20">
                        Auto Detected
                      </span>
                    )}
                  </div>

                  {p.configured ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" /> Connected ({p.latency_ms}ms)
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-800/40 px-2 py-0.5 rounded-full">
                      <XCircle className="w-3 h-3" /> Not Configured
                    </span>
                  )}
                </div>

                <p className="text-[10px] text-slate-500 font-mono truncate">
                  Key: {p.masked_key || 'No key set in environment'}
                </p>

                <div className="mt-2.5 pt-2 border-t border-slate-800/40 flex items-center justify-between text-[9px] text-slate-400">
                  <span>Supported Models:</span>
                  <span className="font-semibold text-slate-300">{p.models.slice(0, 2).join(', ')}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Developer Diagnostics Accordion */}
          <div className={`border rounded-2xl overflow-hidden ${isDark ? 'border-slate-900 bg-slate-950/40' : 'border-slate-200 bg-slate-50'}`}>
            <button
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              className="w-full p-4 flex items-center justify-between text-left text-xs font-bold transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2 text-violet-400">
                <Terminal className="w-4 h-4" />
                <span>Developer Diagnostics & Environment Inspection</span>
              </div>
              {showDiagnostics ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>

            {showDiagnostics && (
              <div className="p-4 pt-0 border-t border-slate-900 space-y-3 font-mono text-[10px]">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-500 block">Platform</span>
                    <span className="text-slate-200 font-bold">{data.diagnostics.platform}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-500 block">Environment</span>
                    <span className="text-slate-200 font-bold">{data.diagnostics.environment}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-500 block">Cache Status</span>
                    <span className="text-slate-200 font-bold">{data.diagnostics.cache_status}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-500 block">Configured</span>
                    <span className="text-emerald-400 font-bold">{data.diagnostics.detected_count} Providers</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-900 space-y-1">
                  <span className="text-slate-400 font-bold block mb-1">Environment Variables Scan:</span>
                  {data.diagnostics.env_scanned.map(e => (
                    <div key={e.name} className="flex justify-between items-center text-[9.5px]">
                      <span className={e.present ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                        {e.name}
                      </span>
                      <span className="text-slate-400">{e.present ? `PRESENT (${e.masked})` : 'ABSENT'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
