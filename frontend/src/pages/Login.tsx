import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2, Eye, EyeOff } from 'lucide-react';

import toast from 'react-hot-toast';

export const Login: React.FC = () => {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleFormLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      toast.error('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await login(email, password);
      toast.success('Successfully logged in!');
      // Navigation based on role happens after user state updates
      // We read role from the fresh user state through the navigate after state refresh
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        const msg = axiosErr.response?.data?.message || 'Invalid credentials. Please try again.';
        setError(msg);
        toast.error(msg);
      } else {
        setError('Unable to connect to server. Please try again.');
        toast.error('Unable to connect to server. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Once user is set after login, navigate to role-based destination
  React.useEffect(() => {
    if (user) {
      if (user.role === 'Sales Rep') {
        navigate('/leads', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [user, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#F8FAFC] via-[#EFF6FF] to-[#E2E8F0] px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        {/* Brand Logo & Heading */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center mb-3">
            <svg
              className="h-16 w-16 text-primary filter drop-shadow-sm"
              viewBox="0 0 100 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Connection Lines */}
              <line x1="25" y1="50" x2="50" y2="25" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity="0.4" />
              <line x1="25" y1="50" x2="50" y2="75" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity="0.4" />
              <line x1="50" y1="25" x2="75" y2="35" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              <line x1="50" y1="75" x2="75" y2="65" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              <line x1="75" y1="35" x2="75" y2="65" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity="0.6" />
              <line x1="50" y1="25" x2="50" y2="75" stroke="currentColor" strokeWidth="3" strokeDasharray="6 4" opacity="0.3" />
              {/* Node Circles */}
              <circle cx="25" cy="50" r="10" fill="currentColor" />
              <circle cx="50" cy="25" r="8" fill="#1E293B" />
              <circle cx="50" cy="75" r="8" fill="#1E293B" />
              <circle cx="75" cy="35" r="7" fill="currentColor" />
              <circle cx="75" cy="65" r="7" fill="currentColor" />
            </svg>
          </div>

          <h2 className="text-3xl font-extrabold tracking-tight text-[#0F172A]">AlgoConnect</h2>
          <p className="mt-2 text-sm font-medium text-[#64748B]">
            Enterprise B2B Lead Management & Campaign Automation
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-8 shadow-xl shadow-blue-900/5">
          <h3 className="text-lg font-bold text-[#0F172A]">Welcome back</h3>
          <p className="mt-1 text-xs text-[#64748B]">Sign in to access your customized dashboard.</p>

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700 font-medium">
              {error}
            </div>
          )}

          {/* Login Form */}
          <form className="mt-6 space-y-5" onSubmit={handleFormLogin}>
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
                placeholder="admin@algoconnect.com"
                className="mt-1.5 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2.5 text-sm text-[#0F172A] placeholder-slate-400 outline-none transition-all duration-200 focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  Password
                </label>
                <Link to="/forgot-password" className="text-xs font-semibold text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative mt-1.5">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2.5 pr-10 text-sm text-[#0F172A] placeholder-slate-400 outline-none transition-all duration-200 focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/25 transition-all hover:bg-blue-600 active:scale-[0.98] disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{loading ? 'Signing in...' : 'Sign In'}</span>
            </button>
          </form>


        </div>
      </div>
    </div>
  );
};
