import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Unauthorized: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  return (
    <div className="flex h-[calc(100vh-200px)] flex-col items-center justify-center text-center px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600 border border-red-200 mb-6 shadow-inner animate-bounce">
        <ShieldAlert className="h-9 w-9" />
      </div>
      
      <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">Access Denied</h1>
      <p className="mt-2 text-sm text-[#64748B] max-w-md">
        You do not have the required permissions to view this page. This page requires elevated access role permissions.
      </p>

      {user && (
        <p className="mt-1 text-xs text-slate-400 capitalize">
          Your current role: <span className="font-bold text-slate-600">{user.role}</span>
        </p>
      )}

      <div className="mt-8 flex items-center gap-4">
        <button
          onClick={() => navigate(user?.role === 'Sales Rep' ? '/leads' : '/dashboard')}
          className="inline-flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-4 py-2.5 text-sm font-semibold text-[#0F172A] hover:bg-[#F8FAFC]"
        >
          <ArrowLeft className="h-4.5 w-4.5" />
          Back to Authorized Home
        </button>

        <button
          onClick={logout}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-red-600/20 hover:bg-red-700"
        >
          <LogOut className="h-4.5 w-4.5" />
          Sign Out
        </button>
      </div>
    </div>
  );
};
