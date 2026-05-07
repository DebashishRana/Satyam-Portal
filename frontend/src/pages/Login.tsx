import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Building2, Eye, EyeOff, Lock, Mail, Shield } from 'lucide-react';
import { getApiErrorMessage } from '../services/api';

type LoginMode = 'admin' | 'bidder';

const modeConfig = {
  admin: {
    title: 'Admin Login',
    subtitle: 'Tender administration, document intake, AI evaluation, and officer review.',
    email: 'officer1@crpf.gov.in',
    password: 'password123',
    roles: ['committee_member', 'approver', 'admin'],
    icon: Shield,
    button: 'Enter Admin Portal',
  },
  bidder: {
    title: 'Bidder Login',
    subtitle: 'Vendor profile, tender discovery, bid upload, extraction preview, and status tracking.',
    email: 'bidder1@example.com',
    password: 'password123',
    roles: ['bidder'],
    icon: Building2,
    button: 'Enter Bidder Portal',
  },
};

const Login: React.FC = () => {
  const [mode, setMode] = useState<LoginMode>('bidder');
  const [email, setEmail] = useState(modeConfig.bidder.email);
  const [password, setPassword] = useState(modeConfig.bidder.password);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login, logout } = useAuth();
  const navigate = useNavigate();
  const selectedMode = modeConfig[mode];

  const helperText = useMemo(() => {
    return mode === 'admin'
      ? 'Use this for CRPF officers and administrators. Bidder-only accounts are blocked here.'
      : 'Use this for vendors, MSMEs, startups, PSUs, and other bidder organisations.';
  }, [mode]);

  const switchMode = (nextMode: LoginMode) => {
    setMode(nextMode);
    setEmail(modeConfig[nextMode].email);
    setPassword(modeConfig[nextMode].password);
    setError('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const loggedInUser = await login(email, password);
      if (!selectedMode.roles.includes(loggedInUser.role)) {
        logout();
        setError(`This account belongs to the ${loggedInUser.role} role. Please use the correct login option.`);
        return;
      }
      navigate('/dashboard');
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Login failed. Please check the email, password, and selected portal.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f6fb] p-2 md:p-4">
      <div className="mx-auto grid min-h-[calc(100vh-1rem)] max-w-[1400px] overflow-hidden rounded-[24px] border border-[#dbe4ef] bg-white shadow-xl md:min-h-[calc(100vh-2rem)] lg:grid-cols-[1fr_1.05fr]">
        <aside className="relative hidden lg:block">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url('/images/bidder.webp')" }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/20 via-slate-900/10 to-slate-900/70" />
          <div className="relative flex h-full flex-col justify-between p-8 text-white">
            <div className="inline-flex w-fit items-center rounded-full bg-white/85 px-4 py-2 text-sm font-semibold text-slate-800 backdrop-blur">
              <Building2 size={16} className="mr-2" /> Satyam Bidder Portal
            </div>

            <div className="max-w-md space-y-3">
              <h2 className="text-5xl font-bold leading-tight">Find your best-fit tender</h2>
              <p className="text-base text-slate-100/95">
                Discover opportunities, submit documents, and track evaluation updates in one guided workflow.
              </p>
              
            </div>
          </div>
        </aside>

        <section className="flex h-full flex-col bg-[#fbfcff] p-6 sm:p-10 lg:p-14">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center rounded-full border border-[#d6deea] bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
              <Shield size={14} className="mr-1.5" /> Secure access
            </div>
            <span className="rounded-full bg-[#0b1220] px-6 py-2 text-sm font-semibold text-white">Sign in</span>
          </div>

          <div className="mx-auto mt-10 w-full max-w-[460px]">
            <h1 className="text-4xl font-bold tracking-tight text-[#1b2657]">Welcome Back</h1>
            <p className="mt-2 text-sm text-slate-500">Sign in to continue to your bidder account.</p>

            <div className="mt-6 grid grid-cols-2 gap-2 rounded-xl border border-[#d8e0ec] bg-white p-1">
              {(['bidder', 'admin'] as LoginMode[]).map((item) => {
                const active = mode === item;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => switchMode(item)}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${active ? 'bg-[#1e2f72] text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                  >
                    {item === 'bidder' ? 'Bidder' : 'Admin'}
                  </button>
                );
              })}
            </div>

            <p className="mt-3 text-xs text-slate-500">{helperText}</p>

            {error && (
              <div className="mt-4 rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Your Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="input-field border-[#bcc9da] bg-white pl-10"
                    placeholder={selectedMode.email}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="input-field border-[#bcc9da] bg-white pl-10 pr-10"
                    placeholder="password123"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center text-slate-600">
                  <input type="checkbox" className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                  <span className="ml-2">Remember me</span>
                </label>
                <Link to="/forgot-password" className="text-slate-500 hover:text-primary-700">Forgot Password?</Link>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-lg bg-[#131a2a] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1d263b]"
              >
                {isLoading ? (
                  <div className="mx-auto h-5 w-5 animate-spin rounded-full border-b-2 border-white" />
                ) : (
                  selectedMode.button
                )}
              </button>
            </form>

            <div className="mt-6 border-t border-[#e2e8f0] pt-5 text-sm text-slate-600">
              <p className="font-semibold text-slate-800">Demo Credentials</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <button type="button" onClick={() => switchMode('bidder')} className="rounded-lg border border-[#d8e0ec] bg-white p-3 text-left hover:bg-slate-50">
                  <p className="font-semibold text-slate-800">Bidder</p>
                  <p className="mt-1 text-xs">bidder1@example.com</p>
                  <p className="text-xs">password123</p>
                </button>
                <button type="button" onClick={() => switchMode('admin')} className="rounded-lg border border-[#d8e0ec] bg-white p-3 text-left hover:bg-slate-50">
                  <p className="font-semibold text-slate-800">Admin</p>
                  <p className="mt-1 text-xs">officer1@crpf.gov.in</p>
                  <p className="text-xs">password123</p>
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Login;
