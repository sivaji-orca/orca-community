import { useState } from "react";
import { useBranding } from "../hooks/useBranding";

interface LoginProps {
  onLogin: (username: string, password: string) => Promise<void>;
  onRestartOnboarding?: () => void;
}

export function Login({ onLogin, onRestartOnboarding }: LoginProps) {
  const { branding } = useBranding();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onLogin(username, password);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-bg-subtle via-white to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          {branding.logoSvg ? (
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary-bg overflow-hidden text-primary" dangerouslySetInnerHTML={{ __html: branding.logoSvg }} />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary-bg">
              <span className="text-white font-bold text-2xl">{branding.appShortName[0]}</span>
            </div>
          )}
          <h1 className="text-3xl font-bold text-slate-800">{branding.appShortName}</h1>
          <p className="text-slate-500 mt-1">{branding.description}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          <h2 className="text-lg font-semibold text-slate-700 mb-1">Sign in</h2>
          <p className="text-sm text-slate-400 mb-6">
            Enter your credentials to continue
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary-ring outline-none transition-all"
                placeholder="Enter username"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary-ring outline-none transition-all"
                placeholder="Enter password"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white py-2.5 rounded-lg font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-400 text-center">
              Default credentials: <span className="font-mono text-slate-500">developer / developer</span> or{" "}
              <span className="font-mono text-slate-500">admin / admin</span>
            </p>
          </div>
        </div>

        {onRestartOnboarding && (
          <div className="mt-6 text-center space-y-2">
            <button
              onClick={onRestartOnboarding}
              className="text-sm text-primary hover:text-primary-hover font-medium cursor-pointer inline-flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Run Setup Wizard Again
            </button>
            <p className="text-xs text-slate-400">
              Re-check prerequisites, configure credentials, or review your setup.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
