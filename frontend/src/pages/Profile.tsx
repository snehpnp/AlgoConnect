import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Shield, Clock, ShieldCheck, UserCircle, Briefcase, Lock, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export const Profile = () => {
  const { user } = useAuth();
  
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  if (!user) return null;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match!');
      return;
    }
    
    setIsChangingPassword(true);
    try {
      const token = localStorage.getItem('algoconnect_token');
      const response = await fetch('http://localhost:7700/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to change password');
      }
      
      toast.success('Password updated successfully!');
      setIsPasswordModalOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header Section */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-[#0F172A] flex items-center gap-3">
          <UserCircle className="h-8 w-8 text-primary" />
          My Profile
        </h1>
        <p className="text-[#64748B] text-sm">
          View your personal information, role details, and account settings.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        {/* Left Column: Avatar & Basic Info */}
        <div className="md:col-span-1 space-y-6">
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm flex flex-col items-center text-center">
            <div className="h-24 w-24 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-blue-500/30 mb-4">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <h2 className="text-xl font-bold text-[#0F172A]">{user.name}</h2>
            <p className="text-sm font-medium text-[#64748B] mt-1">{user.email}</p>
            
            <div className="mt-6 w-full flex items-center justify-center gap-2 rounded-lg bg-blue-50 py-2.5 px-4 text-sm font-bold text-blue-700 border border-blue-100">
              <ShieldCheck className="h-4 w-4" />
              {user.role}
            </div>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
             <h3 className="text-sm font-bold text-[#0F172A] mb-4 uppercase tracking-wider text-left">Quick Actions</h3>
             <button 
               onClick={() => setIsPasswordModalOpen(true)}
               className="w-full mb-3 flex items-center gap-2.5 rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
             >
               <Lock className="h-4 w-4 text-slate-400" />
               Change Password
             </button>
             <button className="w-full flex items-center gap-2.5 rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
               <Mail className="h-4 w-4 text-slate-400" />
               Update Email Settings
             </button>
          </div>
        </div>

        {/* Right Column: Detailed Info */}
        <div className="md:col-span-2 space-y-6">
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-[#0F172A] mb-6 flex items-center gap-2 border-b border-[#E2E8F0] pb-4">
              <User className="h-5 w-5 text-indigo-500" />
              Personal Information
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8">
              <div>
                <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Full Name</label>
                <div className="text-sm font-medium text-[#0F172A] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-4 py-2.5">
                  {user.name}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Email Address</label>
                <div className="text-sm font-medium text-[#0F172A] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-4 py-2.5">
                  {user.email}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Phone Number</label>
                <div className="text-sm font-medium text-[#0F172A] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-4 py-2.5">
                  Not Provided
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-[#0F172A] mb-6 flex items-center gap-2 border-b border-[#E2E8F0] pb-4">
              <Briefcase className="h-5 w-5 text-emerald-500" />
              Account & Role Information
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8">
              <div>
                <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Assigned Role</label>
                <div className="flex items-center gap-2 text-sm font-medium text-[#0F172A]">
                  <Shield className="h-4 w-4 text-emerald-500" />
                  {user.role}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Account Status</label>
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-600">
                  <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                  Active
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Member Since</label>
                <div className="flex items-center gap-2 text-sm font-medium text-[#0F172A]">
                  <Clock className="h-4 w-4 text-[#64748B]" />
                  {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md border border-[#E2E8F0] bg-white rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
              <h3 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
                <Lock className="h-5 w-5 text-indigo-500" />
                Change Password
              </h3>
              <button
                onClick={() => setIsPasswordModalOpen(false)}
                className="rounded-lg p-1 text-[#64748B] hover:bg-[#F8FAFC] hover:text-slate-900 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleChangePassword} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Current Password</label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5 text-sm outline-none transition-all focus:border-primary focus:bg-white"
                  placeholder="Enter current password"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1.5">New Password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5 text-sm outline-none transition-all focus:border-primary focus:bg-white"
                  placeholder="Enter new password"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Confirm New Password</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5 text-sm outline-none transition-all focus:border-primary focus:bg-white"
                  placeholder="Confirm new password"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="flex-1 rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-primary/20 hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                  {isChangingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
