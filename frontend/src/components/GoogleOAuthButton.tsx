/* eslint-disable */
'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, AlertCircle, RefreshCw, CheckCircle2, ShieldCheck } from 'lucide-react';
import { apiService } from '@/services/api';
import { useAuth } from '@/context/AuthContext';

export interface GoogleAuthError {
  type:
    | 'INVALID_CLIENT_ID'
    | 'REDIRECT_URI_MISMATCH'
    | 'OAUTH_CONFIG_ERROR'
    | 'NETWORK_FAILURE'
    | 'EXPIRED_SESSION'
    | 'POPUP_BLOCKED'
    | 'CANCELLED_LOGIN'
    | 'SERVER_UNAVAILABLE'
    | 'INVALID_TOKEN'
    | 'UNKNOWN';
  message: string;
  detail?: string;
}

interface GoogleOAuthButtonProps {
  onSuccess: (token: string, userId: string, email: string) => void;
  onError?: (error: GoogleAuthError) => void;
  isDark?: boolean;
}

declare global {
  interface Window {
    google?: any;
    handleGoogleCredentialResponse?: (response: any) => void;
  }
}

export function GoogleOAuthButton({ onSuccess, onError, isDark = true }: GoogleOAuthButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<GoogleAuthError | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '272450948882-1gtkmfa722it65iqj1ggppap2g3nsmli.apps.googleusercontent.com';
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';

  // Load Google Identity Services script dynamically
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (window.google?.accounts?.id) {
      setScriptLoaded(true);
      initializeGIS();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setScriptLoaded(true);
      initializeGIS();
    };
    script.onerror = () => {
      const err: GoogleAuthError = {
        type: 'NETWORK_FAILURE',
        message: 'Failed to load Google Identity Services SDK.',
        detail: 'Check network connectivity or ad-blocker settings.'
      };
      setAuthError(err);
      if (onError) onError(err);
    };

    document.head.appendChild(script);

    return () => {
      // Clean up window handler
      delete window.handleGoogleCredentialResponse;
    };
  }, [clientId, retryCount]);

  const initializeGIS = () => {
    if (!window.google?.accounts?.id) return;

    try {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
        context: 'signin'
      });
    } catch (err: any) {
      const authErr: GoogleAuthError = {
        type: 'OAUTH_CONFIG_ERROR',
        message: 'OAuth Configuration Initialization Error.',
        detail: err?.message || 'Check Client ID and origin parameters.'
      };
      setAuthError(authErr);
      if (onError) onError(authErr);
    }
  };

  const handleCredentialResponse = async (response: any) => {
    setIsLoading(true);
    setAuthError(null);

    if (!response || !response.credential) {
      const err: GoogleAuthError = {
        type: 'INVALID_TOKEN',
        message: 'Invalid Google Identity credential received.',
        detail: 'Google did not return a valid JWT ID Token.'
      };
      setAuthError(err);
      setIsLoading(false);
      if (onError) onError(err);
      return;
    }

    try {
      // Decode JWT token payload on client for preliminary validation
      const base64Url = response.credential.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      const decodedPayload = JSON.parse(jsonPayload);

      const userEmail = decodedPayload.email;
      const userName = decodedPayload.name || decodedPayload.given_name;
      const userPicture = decodedPayload.picture;

      if (!userEmail) {
        throw { type: 'INVALID_TOKEN', message: 'No email field found in Google token payload.' };
      }

      // Send credential payload to backend /auth/google endpoint
      const res = await apiService.googleLogin(userEmail, userName, userPicture);

      onSuccess(res.access_token, res.user_id, userEmail);
    } catch (err: any) {
      console.error('Google OAuth backend verification error:', err);

      let parsedErr: GoogleAuthError;
      if (err.type) {
        parsedErr = err;
      } else if (err.message?.includes('Failed to fetch') || err.name === 'TypeError') {
        parsedErr = {
          type: 'NETWORK_FAILURE',
          message: 'Network Failure during authentication request.',
          detail: `Could not connect to authentication server at ${currentOrigin}.`
        };
      } else if (err.status === 401 || err.message?.includes('expired')) {
        parsedErr = {
          type: 'EXPIRED_SESSION',
          message: 'Google authentication session expired.',
          detail: 'Please initiate a fresh Google sign-in ceremony.'
        };
      } else if (err.status >= 500) {
        parsedErr = {
          type: 'SERVER_UNAVAILABLE',
          message: 'Authentication Server Unavailable.',
          detail: 'Backend server encountered a transient error.'
        };
      } else {
        parsedErr = {
          type: 'UNKNOWN',
          message: err.message || 'Google OAuth authentication failed.',
          detail: JSON.stringify(err)
        };
      }

      setAuthError(parsedErr);
      if (onError) onError(parsedErr);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignInClick = () => {
    setAuthError(null);
    setIsLoading(true);

    if (!clientId) {
      const err: GoogleAuthError = {
        type: 'INVALID_CLIENT_ID',
        message: 'Invalid Google Client ID.',
        detail: 'NEXT_PUBLIC_GOOGLE_CLIENT_ID variable is missing.'
      };
      setAuthError(err);
      setIsLoading(false);
      if (onError) onError(err);
      return;
    }

    if (!window.google?.accounts?.id) {
      // Retry loading script
      setRetryCount((prev) => prev + 1);
      setTimeout(() => {
        if (window.google?.accounts?.id) {
          window.google.accounts.id.prompt((notification: any) => {
            handleGISNotification(notification);
          });
        } else {
          const err: GoogleAuthError = {
            type: 'NETWORK_FAILURE',
            message: 'Google SDK loading timed out.',
            detail: 'Check internet connection or disable script blockers.'
          };
          setAuthError(err);
          setIsLoading(false);
          if (onError) onError(err);
        }
      }, 1000);
      return;
    }

    try {
      window.google.accounts.id.prompt((notification: any) => {
        handleGISNotification(notification);
      });
    } catch (err: any) {
      const errorObj: GoogleAuthError = {
        type: 'OAUTH_CONFIG_ERROR',
        message: 'Failed to launch Google Sign-In prompt.',
        detail: err?.message || 'Check domain origin configuration.'
      };
      setAuthError(errorObj);
      setIsLoading(false);
      if (onError) onError(errorObj);
    }
  };

  const handleGISNotification = (notification: any) => {
    if (notification.isNotDisplayed()) {
      const reason = notification.getNotDisplayedReason();
      let err: GoogleAuthError;
      if (reason === 'browser_not_supported') {
        err = { type: 'OAUTH_CONFIG_ERROR', message: 'Browser not supported by Google Identity.' };
      } else if (reason === 'opt_out_or_clear_recency') {
        err = { type: 'CANCELLED_LOGIN', message: 'Google One Tap was dismissed recently.' };
      } else {
        err = {
          type: 'POPUP_BLOCKED',
          message: 'Google Sign-In prompt blocked by browser.',
          detail: `Reason: ${reason}. Please allow popups or third-party cookies.`
        };
      }
      setAuthError(err);
      setIsLoading(false);
      if (onError) onError(err);
    } else if (notification.isDismissed()) {
      const reason = notification.getDismissedReason();
      if (reason !== 'credential_returned') {
        const err: GoogleAuthError = {
          type: 'CANCELLED_LOGIN',
          message: 'Google Sign-In cancelled by user.',
          detail: `Dismissed reason: ${reason}`
        };
        setAuthError(err);
        setIsLoading(false);
        if (onError) onError(err);
      }
    }
  };

  return (
    <div className="w-full space-y-3">
      {/* Primary Google Auth Button */}
      <button
        type="button"
        onClick={handleSignInClick}
        disabled={isLoading}
        className={`w-full py-3 px-4 rounded-xl border font-bold text-xs transition-all flex items-center justify-center gap-3 cursor-pointer shadow-md disabled:opacity-60 disabled:cursor-wait ${
          isDark
            ? 'border-white/15 bg-white/[0.03] hover:bg-white/[0.08] text-slate-100 hover:border-violet-500/40'
            : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-800 shadow-slate-200'
        }`}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
            <span>Verifying Google Authentication...</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.47 14.98 1 12 1 7.35 1 3.37 3.68 1.43 7.6l3.87 3C6.23 7.62 8.89 5.04 12 5.04z" />
              <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.29 1.48-1.14 2.73-2.4 3.58l3.73 2.9c2.18-2 3.7-4.99 3.7-8.63z" />
              <path fill="#FBBC05" d="M5.3 14.4c-.24-.73-.38-1.5-.38-2.3s.14-1.57.38-2.3L1.43 6.8C.51 8.65 0 10.74 0 13s.51 4.35 1.43 6.2l3.87-2.8z" />
              <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.73-2.9c-1.1.74-2.5 1.18-4.23 1.18-3.11 0-5.77-2.58-6.7-5.56l-3.87 3C3.37 20.32 7.35 23 12 23z" />
            </svg>
            <span>Continue with Google</span>
          </>
        )}
      </button>

      {/* Detailed Granular Error Alert */}
      {authError && (
        <div className="p-3 border border-red-500/30 bg-red-950/30 rounded-xl text-red-300 text-xs space-y-1.5 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 font-extrabold text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="uppercase text-[10px] tracking-wider font-mono">
                {authError.type.replace(/_/g, ' ')}
              </span>
            </div>
            <button
              onClick={() => handleSignInClick()}
              className="text-[10px] font-bold text-red-300 hover:text-white flex items-center gap-1 bg-red-900/50 px-2 py-0.5 rounded cursor-pointer"
            >
              <RefreshCw className="w-3 h-3 animate-spin" /> Retry
            </button>
          </div>
          <p className="font-semibold text-slate-200">{authError.message}</p>
          {authError.detail && (
            <p className="text-[10px] text-red-300/80 font-mono bg-black/30 p-1.5 rounded border border-red-500/10">
              {authError.detail}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
