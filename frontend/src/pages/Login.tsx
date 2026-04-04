import { useState } from "react";

interface LoginProps {
  onLogin: (username: string, password: string) => Promise<void>;
}

export function Login({ onLogin }: LoginProps) {
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
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary-bg">
            <span className="text-white font-bold text-2xl">O</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-800">Orca</h1>
          <p className="text-slate-500 mt-1">MuleSoft Developer Productivity Tool</p>
          <p className="text-xs text-slate-400 mt-1">Community Edition</p>
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
      </div>
    </div>
  );
}
