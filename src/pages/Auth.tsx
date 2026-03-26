import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Heart, IdCard, Lock, Mail, UserRound, Users } from 'lucide-react';
import { useAuth } from '../lib/auth-context';

type AuthMode = 'login' | 'register';
type LoginRole = 'parent' | 'child';

export default function Auth() {
  const { user, isLoading, loginUser, registerParentUser } = useAuth();

  const [mode, setMode] = useState<AuthMode>('login');
  const [loginRole, setLoginRole] = useState<LoginRole>('parent');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [childUsername, setChildUsername] = useState('');
  const [childParentId, setChildParentId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <p className="text-sm text-slate-300">Checking your session...</p>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (mode === 'register') {
        await registerParentUser(name, email, password);
      } else {
        if (loginRole === 'child') {
          await loginUser({
            username: childUsername,
            parentId: childParentId,
            password,
          });
        } else {
          await loginUser({
            email,
            password,
          });
        }
      }
      setPassword('');
    } catch (submitError: any) {
      setError(submitError?.message || 'Authentication failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.2),transparent_45%),radial-gradient(circle_at_80%_30%,rgba(244,114,182,0.2),transparent_40%),radial-gradient(circle_at_50%_80%,rgba(45,212,191,0.14),transparent_50%)]" />
      <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 shadow-[0_20px_80px_rgba(15,23,42,0.5)]">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-cyan-500/20 text-cyan-300 p-3 rounded-2xl border border-cyan-300/20">
              <Heart className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">EmoCare AI</h1>
              <p className="text-xs text-slate-300">Safe space for families and children</p>
            </div>
          </div>

          <div className="flex gap-2 bg-white/10 rounded-xl p-1 mb-6">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 py-2 text-sm rounded-lg font-semibold transition ${mode === 'login' ? 'bg-white text-slate-900' : 'text-slate-300 hover:text-white'}`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`flex-1 py-2 text-sm rounded-lg font-semibold transition ${mode === 'register' ? 'bg-white text-slate-900' : 'text-slate-300 hover:text-white'}`}
            >
              Register Parent
            </button>
          </div>

          {mode === 'login' && (
            <div className="grid grid-cols-2 gap-2 bg-white/10 rounded-xl p-1 mb-4">
              <button
                type="button"
                onClick={() => setLoginRole('parent')}
                className={`py-2 text-sm rounded-lg font-semibold transition ${loginRole === 'parent' ? 'bg-cyan-400 text-slate-900' : 'text-slate-200 hover:text-white'}`}
              >
                Parent Login
              </button>
              <button
                type="button"
                onClick={() => setLoginRole('child')}
                className={`py-2 text-sm rounded-lg font-semibold transition ${loginRole === 'child' ? 'bg-cyan-400 text-slate-900' : 'text-slate-200 hover:text-white'}`}
              >
                Child Login
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <label className="block">
                <span className="text-xs text-slate-300 mb-1 inline-block">Parent name</span>
                <div className="relative">
                  <UserRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Jane Doe"
                    className="w-full rounded-xl bg-slate-900/60 border border-white/10 pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-500"
                    required
                  />
                </div>
              </label>
            )}

            {(mode === 'register' || loginRole === 'parent') && (
              <label className="block">
                <span className="text-xs text-slate-300 mb-1 inline-block">{mode === 'register' ? 'Parent email' : 'Login email'}</span>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="name@example.com"
                    className="w-full rounded-xl bg-slate-900/60 border border-white/10 pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-500"
                    required
                  />
                </div>
              </label>
            )}

            {mode === 'login' && loginRole === 'child' && (
              <>
                <label className="block">
                  <span className="text-xs text-slate-300 mb-1 inline-block">Child username</span>
                  <div className="relative">
                    <UserRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={childUsername}
                      onChange={(event) => setChildUsername(event.target.value)}
                      placeholder="child username"
                      className="w-full rounded-xl bg-slate-900/60 border border-white/10 pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-500"
                      required
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="text-xs text-slate-300 mb-1 inline-block">Parent ID</span>
                  <div className="relative">
                    <IdCard className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={childParentId}
                      onChange={(event) => setChildParentId(event.target.value)}
                      placeholder="parent-123456789"
                      className="w-full rounded-xl bg-slate-900/60 border border-white/10 pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-500"
                      required
                    />
                  </div>
                </label>
              </>
            )}

            <label className="block">
              <span className="text-xs text-slate-300 mb-1 inline-block">Password</span>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="********"
                  className="w-full rounded-xl bg-slate-900/60 border border-white/10 pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-500"
                  required
                />
              </div>
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-cyan-400 text-slate-900 font-bold py-3 text-sm hover:bg-cyan-300 transition disabled:opacity-50"
            >
              {mode === 'register' ? 'Create Parent Account' : loginRole === 'child' ? 'Login as Child' : 'Login'}
            </button>
          </form>

          {mode === 'login' && loginRole === 'child' && (
            <p className="mt-4 text-xs text-slate-300">
              Child login requires username, parent ID, and password.
            </p>
          )}

          {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}
        </div>
      </div>
    </div>
  );
}
