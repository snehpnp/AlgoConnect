import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '../services/apiClient';

export const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address.');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const response = await apiClient.post('/auth/forgot-password', { email });
      setSuccess(true);
      toast.success(response.data.message || 'Reset link sent to your email.');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Something went wrong. Please try again.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#F8FAFC] via-[#EFF6FF] to-[#E2E8F0] px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center mb-3">
            <svg className="h-16 w-16 text-primary filter drop-shadow-sm" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <line x1="25" y1="50" x2="50" y2="25" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity="0.4" />
              <line x1="25" y1="50" x2="50" y2="75" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity="0.4" />
              <line x1="50" y1="25" x2="75" y2="35" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              <line x1="50" y1="75" x2="75" y2="65" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              <line x1="75" y1="35" x2="75" y2="65" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity="0.6" />
              <line x1="50" y1="25" x2="50" y2="75" stroke="currentColor" strokeWidth="3" strokeDasharray="6 4" opacity="0.3" />
              <circle cx="25" cy="50" r="10" fill="currentColor" />
              <circle cx="50" cy="25" r="8" fill="#1E293B" />
              <circle cx="50" cy="75" r="8" fill="#1E293B" />
              <circle cx="75" cy="35" r="7" fill="currentColor" />
              <circle cx="75" cy="65" r="7" fill="currentColor" />
            </svg>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-[#0F172A]">Forgot Password</h2>
          <p className="mt-2 text-sm font-medium text-[#64748B]">
            Enter your email to receive a password reset link.
          </p>
        </div>

        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 sm:p-8 shadow-xl shadow-blue-900/5">
          {success ? (
            <div className="text-center space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-[#0F172A]">Check your email</h3>
              <p className="text-sm text-[#64748B]">
                We've sent a password reset link to <br/><span className="font-medium text-slate-800">{email}</span>
              </p>
              <button onClick={() => navigate('/login')} className="mt-4 flex w-full justify-center rounded-lg bg-primary py-3 sm:py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/25 transition-all hover:bg-blue-600">
                Back to Login
              </button>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700 font-medium">
                  {error}
                </div>
              )}
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-[#64748B]">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="mt-1.5 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-3 sm:py-2.5 text-sm text-[#0F172A] placeholder-slate-400 outline-none transition-all duration-200 focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 sm:py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/25 transition-all hover:bg-blue-600 active:scale-[0.98] disabled:opacity-60"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>{loading ? 'Sending link...' : 'Send Reset Link'}</span>
                </button>
              </form>
              <div className="mt-6 text-center">
                <Link to="/login" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-blue-700 transition-colors">
                  <ArrowLeft className="h-4 w-4" />
                  Back to login
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
