'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Fingerprint,
  ScanFace,
  Laptop,
  Smartphone,
  Tablet,
  Key,
  Trash2,
  LogOut,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Globe,
  Loader2,
  RefreshCw,
  Plus
} from 'lucide-react';
import { apiService } from '@/services/api';

interface DeviceItem {
  id: string;
  device_name: string;
  platform: string;
  browser: string;
  location: string;
  biometrics_enabled: boolean;
  created_at: string;
  last_login_at: string;
}

interface SecurityDashboardProps {
  token: string | null;
  isDark: boolean;
}

export function SecurityDashboard({ token, isDark }: SecurityDashboardProps) {
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState<boolean | null>(null);
  const [registering, setRegistering] = useState(false);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Detect platform and browser
  const detectDeviceInfo = () => {
    const ua = navigator.userAgent;
    let platform = 'Desktop';
    if (/windows/i.test(ua)) platform = 'Windows';
    else if (/macintosh|mac os x/i.test(ua)) platform = 'macOS';
    else if (/iphone/i.test(ua)) platform = 'iPhone';
    else if (/ipad/i.test(ua)) platform = 'iPad';
    else if (/android/i.test(ua)) platform = 'Android';
    else if (/linux/i.test(ua)) platform = 'Linux';

    let browser = 'Browser';
    if (/edg/i.test(ua)) browser = 'Edge';
    else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
    else if (/safari/i.test(ua)) browser = 'Safari';
    else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
    else if (/brave/i.test(ua)) browser = 'Brave';
    else if (/arc/i.test(ua)) browser = 'Arc';

    return { platform, browser, device_name: `My ${platform} (${browser})` };
  };

  useEffect(() => {
    checkBiometricSupport();
    if (token) {
      loadTrustedDevices();
    }
  }, [token]);

  const checkBiometricSupport = async () => {
    if (typeof window === 'undefined' || !window.PublicKeyCredential) {
      setBiometricSupported(false);
      return;
    }
    try {
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      setBiometricSupported(available);
    } catch {
      setBiometricSupported(false);
    }
  };

  const loadTrustedDevices = async () => {
    if (!token) return;
    setLoadingDevices(true);
    try {
      const list = await apiService.getTrustedDevices(token);
      setDevices(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDevices(false);
    }
  };

  const handleRegisterBiometrics = async () => {
    if (!token) return;
    setRegistering(true);
    setActionStatus(null);
    setActionError(null);

    try {
      if (!window.PublicKeyCredential) {
        throw new Error('Biometric Passkeys are not supported on this browser.');
      }

      const info = detectDeviceInfo();
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const credential = (await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: {
            name: 'SAMRAT AETHERMIND',
            id: window.location.hostname,
          },
          user: {
            id: new Uint8Array(16).map(() => Math.floor(Math.random() * 256)),
            name: 'aethermind_user',
            displayName: info.device_name,
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' },
            { alg: -257, type: 'public-key' },
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
            residentKey: 'preferred',
          },
          timeout: 60000,
          attestation: 'none',
        },
      })) as PublicKeyCredential;

      if (credential) {
        const rawId = credential.id;
        localStorage.setItem('aether_biometric_cred_id', rawId);

        await apiService.registerBiometricDevice(token, {
          credential_id: rawId,
          device_name: info.device_name,
          platform: info.platform,
          browser: info.browser,
        });

        setActionStatus(`Biometric unlock successfully registered for ${info.device_name}!`);
        loadTrustedDevices();
      }
    } catch (err: any) {
      console.error(err);
      if (err?.name === 'NotAllowedError') {
        setActionError('Biometric prompt was cancelled or timed out.');
      } else {
        setActionError(err?.message || 'Biometric registration failed.');
      }
    } finally {
      setRegistering(false);
    }
  };

  const handleRemoveDevice = async (id: string, name: string) => {
    if (!token) return;
    if (!confirm(`Are you sure you want to remove "${name}" from trusted devices?`)) return;

    try {
      await apiService.removeDevice(token, id);
      setActionStatus(`Removed device "${name}".`);
      loadTrustedDevices();
    } catch (err: any) {
      setActionError(err?.message || 'Failed to remove device.');
    }
  };

  const handleLogoutAllDevices = async () => {
    if (!token) return;
    if (!confirm('This will revoke biometric access across ALL registered devices. Continue?')) return;

    try {
      await apiService.logoutAllDevices(token);
      localStorage.removeItem('aether_biometric_cred_id');
      setActionStatus('All trusted device sessions revoked.');
      loadTrustedDevices();
    } catch (err: any) {
      setActionError(err?.message || 'Failed to logout all devices.');
    }
  };

  // Security score calculation
  const hasBiometrics = devices.some(d => d.biometrics_enabled);
  const securityScore = hasBiometrics ? 95 : biometricSupported ? 70 : 60;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div>
        <h4 className={`text-sm font-bold flex items-center gap-2 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
          <ShieldCheck className="w-4 h-4 text-violet-400" />
          Security Dashboard & Biometric Passkeys
        </h4>
        <p className="text-[10px] text-slate-500 mt-0.5">
          Manage universal WebAuthn biometric unlock (Face ID, Touch ID, Windows Hello) and trusted devices.
        </p>
      </div>

      {/* Security Health Score Card */}
      <div className={`p-5 rounded-2xl border flex items-center justify-between gap-4 flex-wrap ${
        isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'
      }`}>
        <div className="flex items-center gap-4">
          <div className="relative flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-600/10 border border-violet-500/30">
            <span className="text-lg font-black text-violet-400">{securityScore}</span>
            <span className="text-[8px] text-slate-500 absolute bottom-1 font-bold">/100</span>
          </div>
          <div>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-3 h-3" />
              {securityScore >= 90 ? 'High Protection' : 'Standard Protection'}
            </span>
            <h5 className={`text-xs font-bold mt-1 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
              Universal Biometrics Status
            </h5>
            <p className="text-[10px] text-slate-500">
              {hasBiometrics
                ? 'Device biometrics (WebAuthn / Passkeys) active on this account.'
                : 'Enable biometric unlock on this device for instant login access.'}
            </p>
          </div>
        </div>

        <button
          onClick={loadTrustedDevices}
          className={`p-2 rounded-xl border transition-all ${
            isDark ? 'border-slate-800 hover:bg-slate-800 text-slate-400' : 'border-slate-200 hover:bg-slate-100 text-slate-600'
          }`}
          title="Refresh devices"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingDevices ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Biometrics Setup Box */}
      <div className={`p-5 rounded-2xl border space-y-4 ${
        isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'
      }`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-600 text-white shadow-md">
              <Fingerprint className="w-5 h-5" />
            </div>
            <div>
              <h5 className={`text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                Hardware Biometric Unlock
              </h5>
              <p className="text-[10px] text-slate-500">
                Windows Hello, Touch ID, Face ID, Android Biometrics via WebAuthn FIDO2
              </p>
            </div>
          </div>
        </div>

        {biometricSupported === false ? (
          <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/10 flex items-center gap-2.5 text-amber-400 text-xs font-semibold">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>This device does not support hardware biometric authentication.</span>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            <p className="text-[10px] text-slate-400">
              Biometric credentials are strictly stored in your OS enclave. No fingerprint or facial data is ever transmitted to servers.
            </p>

            <button
              onClick={handleRegisterBiometrics}
              disabled={registering}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-550 text-white rounded-xl text-xs font-bold transition-all shadow-md flex-shrink-0 cursor-pointer disabled:opacity-50"
            >
              {registering ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {registering ? 'Verifying with OS...' : 'Enable Biometrics on This Device'}
            </button>
          </div>
        )}
      </div>

      {/* Action Banners */}
      {actionStatus && (
        <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{actionStatus}</span>
        </div>
      )}
      {actionError && (
        <div className="p-3.5 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Trusted Devices Section */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h5 className={`text-xs uppercase font-bold tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Trusted Devices ({devices.length})
          </h5>

          {devices.length > 0 && (
            <button
              onClick={handleLogoutAllDevices}
              className="text-[10px] font-bold text-red-400 hover:text-red-300 flex items-center gap-1.5 transition-colors"
            >
              <LogOut className="w-3 h-3" />
              Revoke All Devices
            </button>
          )}
        </div>

        {loadingDevices ? (
          <div className="p-6 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading trusted devices...
          </div>
        ) : devices.length === 0 ? (
          <div className={`p-6 rounded-2xl border text-center ${isDark ? 'bg-slate-900/20 border-slate-850' : 'bg-slate-50 border-slate-200'}`}>
            <Laptop className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-40" />
            <p className="text-xs font-bold text-slate-400">No Biometric Trusted Devices Registered Yet</p>
            <p className="text-[10px] text-slate-550 mt-0.5">Click "Enable Biometrics" above to register your primary laptop or phone.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-900">
            {devices.map(dev => {
              const isMobile = /iphone|ipad|android/i.test(dev.platform);
              const DevIcon = isMobile ? Smartphone : Laptop;

              return (
                <div
                  key={dev.id}
                  className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
                    isDark ? 'bg-slate-950/80 border-slate-850 hover:border-slate-800' : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl border ${
                      isDark ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                    }`}>
                      <DevIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                          {dev.device_name}
                        </span>
                        {dev.biometrics_enabled && (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-violet-500/10 text-violet-400 border border-violet-500/20">
                            Biometric Lock Active
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {dev.platform} • {dev.browser} • Registered {new Date(dev.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRemoveDevice(dev.id, dev.device_name)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition-colors"
                    title="Remove Device"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
