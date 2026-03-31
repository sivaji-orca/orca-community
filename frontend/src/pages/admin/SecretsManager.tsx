import { useState, useEffect } from "react";
import { api } from "../../api/client";
import { Card } from "../../components/Card";

interface SecretEntry {
  key: string;
  category: string;
  updatedAt: string;
}

const CATEGORIES = ["github", "anypoint", "postman", "general"];

export function SecretsManager() {
  const [secrets, setSecrets] = useState<SecretEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revealedValue, setRevealedValue] = useState("");
  const [form, setForm] = useState({ key: "", value: "", category: "general" });
  const [error, setError] = useState("");

  const fetchSecrets = async () => {
    setLoading(true);
    try {
      const data = await api.get<SecretEntry[]>("/secrets");
      setSecrets(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSecrets(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await api.post("/secrets", form);
      setShowForm(false);
      setForm({ key: "", value: "", category: "general" });
      fetchSecrets();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (key: string) => {
    if (!confirm(`Delete secret '${key}'?`)) return;
    try {
      await api.delete(`/secrets/${key}`);
      fetchSecrets();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleReveal = async (key: string) => {
    if (revealedKey === key) {
      setRevealedKey(null);
      setRevealedValue("");
      return;
    }
    try {
      const data = await api.get<{ key: string; value: string }>(`/secrets/${key}`);
      setRevealedKey(key);
      setRevealedValue(data.value);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const groupedSecrets = CATEGORIES.map((cat) => ({
    category: cat,
    items: secrets.filter((s) => s.category === cat),
  })).filter((g) => g.items.length > 0);

  const ungrouped = secrets.filter((s) => !CATEGORIES.includes(s.category));

  return (
    <Card
      title="Secrets Manager"
      action={
        !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 cursor-pointer"
          >
            Add Secret
          </button>
        )
      }
    >
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-slate-50 rounded-lg p-4 mb-4 space-y-3">
          <h3 className="font-medium text-slate-700">Add / Update Secret</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input
              type="text"
              placeholder="Key (e.g. github_token)"
              value={form.key}
              onChange={(e) => setForm({ ...form, key: e.target.value })}
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-indigo-500 outline-none"
              required
            />
            <input
              type="password"
              placeholder="Value"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-indigo-500 outline-none"
              required
            />
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-indigo-500 outline-none"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 cursor-pointer">
              Save
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-slate-300 text-slate-600 text-sm rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-slate-500 text-sm">Loading secrets...</p>
      ) : secrets.length === 0 ? (
        <p className="text-slate-500 text-sm">No secrets configured yet. Add your first secret above.</p>
      ) : (
        <div className="space-y-6">
          {groupedSecrets.map((group) => (
            <div key={group.category}>
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">
                {group.category}
              </h3>
              <div className="space-y-2">
                {group.items.map((s) => (
                  <div key={s.key} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3">
                    <div>
                      <span className="font-mono text-sm text-slate-800">{s.key}</span>
                      {revealedKey === s.key && (
                        <span className="ml-3 font-mono text-sm text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                          {revealedValue}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReveal(s.key)}
                        className="text-xs text-indigo-600 hover:text-indigo-700 font-medium cursor-pointer"
                      >
                        {revealedKey === s.key ? "Hide" : "Reveal"}
                      </button>
                      <button
                        onClick={() => handleDelete(s.key)}
                        className="text-xs text-red-600 hover:text-red-700 font-medium cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {ungrouped.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Other</h3>
              {ungrouped.map((s) => (
                <div key={s.key} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3">
                  <span className="font-mono text-sm text-slate-800">{s.key}</span>
                  <button onClick={() => handleDelete(s.key)} className="text-xs text-red-600 hover:text-red-700 cursor-pointer">
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
