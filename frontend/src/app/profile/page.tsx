'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { apiService } from '@/services/api';
import { ArrowLeft, User, Mail, LogOut, Loader2, Camera } from 'lucide-react';

export default function ProfilePage() {
  const router = useRouter();
  const { email, logout } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await apiService.logout();
      logout();
      router.push('/');
    } catch (err) {
      console.error('Logout error:', err);
      // Force logout even if API call fails
      logout();
      router.push('/');
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Link
              href="/"
              className="p-2 hover:bg-slate-700/50 rounded-lg transition"
            >
              <ArrowLeft className="w-6 h-6 text-gray-300" />
            </Link>
            <h1 className="text-3xl font-bold text-white">Profile Settings</h1>
          </div>

          {/* Profile Card */}
          <div className="bg-slate-800/50 backdrop-blur-xl border border-purple-500/20 rounded-2xl p-8 shadow-2xl mb-8">
            {/* Avatar Section */}
            <div className="flex flex-col items-center mb-8">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center mb-4 shadow-lg">
                <User className="w-12 h-12 text-white" />
              </div>
              <button className="flex items-center gap-2 px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-lg transition text-purple-300 text-sm font-medium">
                <Camera className="w-4 h-4" />
                Change Avatar
              </button>
            </div>

            {/* User Info */}
            <div className="space-y-6">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email Address
                </label>
                <div className="flex items-center gap-3 p-3.5 bg-slate-700/50 border border-purple-500/30 rounded-lg">
                  <Mail className="w-5 h-5 text-purple-400" />
                  <input
                    type="email"
                    value={email || ''}
                    disabled
                    className="flex-1 bg-transparent text-white outline-none"
                  />
                </div>
              </div>

              {/* Account Status */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Account Status
                </label>
                <div className="flex items-center gap-3 p-3.5 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-green-300 font-medium">Active</span>
                </div>
              </div>

              {/* Subscription */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Plan
                </label>
                <div className="flex items-center justify-between p-3.5 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                  <span className="text-gray-200">Free Plan</span>
                  <button className="text-purple-400 hover:text-purple-300 text-sm font-medium">
                    Upgrade
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Preferences */}
          <div className="bg-slate-800/50 backdrop-blur-xl border border-purple-500/20 rounded-2xl p-8 shadow-2xl mb-8">
            <h2 className="text-xl font-bold text-white mb-6">Preferences</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg">
                <div>
                  <p className="text-white font-medium">Dark Mode</p>
                  <p className="text-sm text-gray-400">Always on</p>
                </div>
                <div className="w-10 h-6 bg-purple-600 rounded-full flex items-center p-1">
                  <div className="bg-white w-4 h-4 rounded-full shadow-md ml-4"></div>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg">
                <div>
                  <p className="text-white font-medium">Email Notifications</p>
                  <p className="text-sm text-gray-400">Get updates about your chats</p>
                </div>
                <div className="w-10 h-6 bg-slate-600 rounded-full flex items-center p-1">
                  <div className="bg-white w-4 h-4 rounded-full shadow-md"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-red-950/20 backdrop-blur-xl border border-red-500/20 rounded-2xl p-8 shadow-2xl">
            <h2 className="text-xl font-bold text-red-300 mb-4">Danger Zone</h2>
            <p className="text-gray-400 text-sm mb-6">
              Logging out will end your current session. You can log back in anytime with your credentials.
            </p>
            <button
              onClick={handleLogout}
              disabled={isLoading}
              className="w-full py-3 px-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Logging out...
                </>
              ) : (
                <>
                  <LogOut className="w-5 h-5" />
                  Logout
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
