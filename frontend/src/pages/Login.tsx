import { useState } from "react";

interface LoginProps {
  onLogin: (username: string, password: string, role: string) => Promise<void>;
}

export function Login({ onLogin }: LoginProps) {
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onLogin(username, password, selectedRole!);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200">
            <span className="text-white font-bold text-2xl">O</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-800">Orca</h1>
          <p className="text-slate-500 mt-1">MuleSoft Developer Productivity Tool</p>
          <p className="text-xs text-slate-400 mt-1">Community Edition</p>
        </div>

        {!selectedRole ? (
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
            <h2 className="text-lg font-semibold text-slate-700 text-center mb-6">
              Choose your role
            </h2>
            <div className="space-y-3">
              <button
                onClick={() => setSelectedRole("administrator")}
                className="w-full px-6 py-4 rounded-xl border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all text-left cursor-pointer"
              >
                <div className="font-semibold text-slate-800">Sign in as Administrator</div>
                <div className="text-sm text-slate-500 mt-0.5">
                  Manage team, secrets, and platform settings
                </div>
              </button>
              <button
                onClick={() => setSelectedRole("developer")}
                className="w-full px-6 py-4 rounded-xl border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all text-left cursor-pointer"
              >
                <div className="font-semibold text-slate-800">Sign in as Developer</div>
                <div className="text-sm text-slate-500 mt-0.5">
                  Access dashboard, manage projects, and deploy
                </div>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
            <button
              onClick={() => { setSelectedRole(null); setError(""); }}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium mb-4 cursor-pointer"
            >
              &larr; Back to role selection
            </button>
            <h2 className="text-lg font-semibold text-slate-700 mb-1">
              Sign in as {selectedRole === "administrator" ? "Administrator" : "Developer"}
            </h2>
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
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
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
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                  placeholder="Enter password"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
