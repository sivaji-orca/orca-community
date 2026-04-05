import { useState, useEffect, useCallback } from "react";
import { api } from "../../api/client";
import { useTheme, type ThemeMode, type AccentColor } from "../../hooks/useTheme";
import { useWorkspace, type Workspace } from "../../hooks/useWorkspace";

const MASK = "••••••••";

type SettingsSubTab = "workspaces" | "secrets" | "salesforce" | "team" | "security" | "appearance";

const ACCENT_PRESETS: { id: AccentColor; label: string; swatch: string }[] = [
  { id: "teal", label: "Teal", swatch: "#14b8a6" },
  { id: "honey", label: "Honey", swatch: "#b45309" },
  { id: "ocean", label: "Ocean", swatch: "#0e7490" },
  { id: "indigo", label: "Indigo", swatch: "#4f46e5" },
  { id: "rose", label: "Rose", swatch: "#be123c" },
  { id: "emerald", label: "Emerald", swatch: "#047857" },
];

const MODE_OPTIONS: { id: ThemeMode; label: string; icon: string }[] = [
  { id: "light", label: "Light", icon: "☀️" },
  { id: "dark", label: "Dark", icon: "🌙" },
  { id: "system", label: "System", icon: "💻" },
];

type SecretCategory = "anypoint" | "salesforce" | "github" | "postman" | "neon" | "kafka";

interface SecretEntry {
  key: string;
  category: string;
  updatedAt: string;
}

const SECRET_CATEGORIES: SecretCategory[] = [
  "anypoint",
  "salesforce",
  "neon",
  "kafka",
  "github",
  "postman",
];

interface SfHealth {
  status: string;
  message?: string;
  instanceUrl?: string;
  username?: string;
  orgId?: string;
}

interface SfQueryPayload {
  totalSize?: number;
  done?: boolean;
  records?: Record<string, unknown>[];
}

interface TeamMember {
  id: number;
  username: string;
  role: string;
  created_by?: string | null;
  created_at?: string;
}

type TeamRole = "administrator" | "developer" | "viewer";

const TEAM_ROLES: TeamRole[] = ["administrator", "developer", "viewer"];

export function Settings() {
  const [subTab, setSubTab] = useState<SettingsSubTab>("secrets");

  const [secrets, setSecrets] = useState<SecretEntry[]>([]);
  const [secretsLoading, setSecretsLoading] = useState(false);
  const [secretsError, setSecretsError] = useState("");
  const [showSecretForm, setShowSecretForm] = useState(false);
  const [secretForm, setSecretForm] = useState({
    key: "",
    value: "",
    category: "github" as SecretCategory | string,
  });
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revealedValue, setRevealedValue] = useState("");

  const [sfHealth, setSfHealth] = useState<SfHealth | null>(null);
  const [sfHealthLoading, setSfHealthLoading] = useState(false);
  const [sfHealthError, setSfHealthError] = useState("");
  const [accounts, setAccounts] = useState<SfQueryPayload | null>(null);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState("");
  const [soql, setSoql] = useState("SELECT Id, Name FROM Account LIMIT 10");
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryResult, setQueryResult] = useState<SfQueryPayload | null>(null);
  const [queryError, setQueryError] = useState("");

  const [team, setTeam] = useState<TeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamError, setTeamError] = useState("");
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [teamForm, setTeamForm] = useState({
    username: "",
    password: "",
    role: "developer" as TeamRole,
  });
  const [teamFormError, setTeamFormError] = useState("");

  const loadSecrets = useCallback(async () => {
    setSecretsLoading(true);
    setSecretsError("");
    try {
      const data = await api.get<SecretEntry[]>("/secrets/list");
      setSecrets(data);
    } catch (err: unknown) {
      setSecretsError(err instanceof Error ? err.message : "Failed to load secrets");
    } finally {
      setSecretsLoading(false);
    }
  }, []);

  const loadSfHealth = useCallback(async () => {
    setSfHealthLoading(true);
    setSfHealthError("");
    try {
      const data = await api.get<SfHealth>("/salesforce/health");
      setSfHealth(data);
    } catch (err: unknown) {
      setSfHealthError(err instanceof Error ? err.message : "Failed to load Salesforce health");
    } finally {
      setSfHealthLoading(false);
    }
  }, []);

  const loadAccounts = useCallback(async () => {
    setAccountsLoading(true);
    setAccountsError("");
    try {
      const data = await api.get<SfQueryPayload>("/salesforce/accounts");
      setAccounts(data);
    } catch (err: unknown) {
      setAccountsError(err instanceof Error ? err.message : "Failed to load accounts");
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  const loadTeam = useCallback(async () => {
    setTeamLoading(true);
    setTeamError("");
    try {
      const data = await api.get<TeamMember[]>("/team");
      setTeam(data);
    } catch (err: unknown) {
      setTeamError(err instanceof Error ? err.message : "Failed to load team");
    } finally {
      setTeamLoading(false);
    }
  }, []);

  useEffect(() => {
    if (subTab === "secrets") loadSecrets();
  }, [subTab, loadSecrets]);

  useEffect(() => {
    if (subTab === "salesforce") {
      loadSfHealth();
      loadAccounts();
    }
  }, [subTab, loadSfHealth, loadAccounts]);

  useEffect(() => {
    if (subTab === "team") loadTeam();
  }, [subTab, loadTeam]);

  const toggleReveal = async (key: string) => {
    if (revealedKey === key) {
      setRevealedKey(null);
      setRevealedValue("");
      return;
    }
    setSecretsError("");
    try {
      const data = await api.get<{ key: string; value: string }>(`/secrets/${encodeURIComponent(key)}`);
      setRevealedKey(key);
      setRevealedValue(data.value);
    } catch (err: unknown) {
      setSecretsError(err instanceof Error ? err.message : "Could not reveal secret");
    }
  };

  const submitSecret = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecretsError("");
    try {
      await api.post("/secrets", {
        key: secretForm.key,
        value: secretForm.value,
        category: secretForm.category,
      });
      setShowSecretForm(false);
      setSecretForm({ key: "", value: "", category: "github" });
      setRevealedKey(null);
      setRevealedValue("");
      await loadSecrets();
    } catch (err: unknown) {
      setSecretsError(err instanceof Error ? err.message : "Failed to save secret");
    }
  };

  const runQuery = async () => {
    setQueryLoading(true);
    setQueryError("");
    setQueryResult(null);
    try {
      const data = await api.post<SfQueryPayload>("/salesforce/query", { soql });
      setQueryResult(data);
    } catch (err: unknown) {
      setQueryError(err instanceof Error ? err.message : "Query failed");
    } finally {
      setQueryLoading(false);
    }
  };

  const submitTeamMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setTeamFormError("");
    try {
      await api.post("/team", {
        username: teamForm.username,
        password: teamForm.password,
        role: teamForm.role,
      });
      setShowTeamForm(false);
      setTeamForm({ username: "", password: "", role: "developer" });
      await loadTeam();
    } catch (err: unknown) {
      setTeamFormError(err instanceof Error ? err.message : "Failed to add member");
    }
  };

  const groupedSecrets = SECRET_CATEGORIES.map((cat) => ({
    category: cat,
    items: secrets.filter((s) => s.category === cat),
  }));

  const otherSecrets = secrets.filter((s) => !SECRET_CATEGORIES.includes(s.category as SecretCategory));

  const accountRecords = accounts?.records ?? [];
  const queryRecords = queryResult?.records ?? [];

  const tableColumns = (rows: Record<string, unknown>[]): string[] => {
    const keys = new Set<string>();
    for (const row of rows) {
      for (const k of Object.keys(row)) {
        if (k !== "attributes") keys.add(k);
      }
    }
    return Array.from(keys);
  };

  const subTabs: { id: SettingsSubTab; label: string }[] = [
    { id: "workspaces", label: "Workspaces" },
    { id: "secrets", label: "Secrets" },
    { id: "salesforce", label: "Salesforce" },
    { id: "team", label: "Team" },
    { id: "security", label: "Security" },
    { id: "appearance", label: "Appearance" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Vault secrets, Salesforce org, and team members.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {subTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors cursor-pointer ${
              subTab === t.id
                ? "bg-primary text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === "workspaces" && <WorkspacesTab />}

      {subTab === "secrets" && (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-medium text-slate-800">Secrets (Vault)</h2>
            {!showSecretForm && (
              <button
                type="button"
                onClick={() => setShowSecretForm(true)}
                className="px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary-hover cursor-pointer"
              >
                Add secret
              </button>
            )}
          </div>

          {secretsError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
              {secretsError}
            </div>
          )}

          {showSecretForm && (
            <form
              onSubmit={submitSecret}
              className="bg-slate-50 rounded-lg p-4 mb-6 space-y-3 border border-slate-200"
            >
              <h3 className="font-medium text-slate-700">Add or update secret</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <input
                  type="text"
                  placeholder="Key"
                  value={secretForm.key}
                  onChange={(e) => setSecretForm({ ...secretForm, key: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-800 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  required
                />
                <input
                  type="password"
                  placeholder="Value"
                  value={secretForm.value}
                  onChange={(e) => setSecretForm({ ...secretForm, value: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-800 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  required
                />
                <select
                  value={secretForm.category}
                  onChange={(e) => setSecretForm({ ...secretForm, category: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-800 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                >
                  {SECRET_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary-hover cursor-pointer"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setShowSecretForm(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-600 text-sm rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {secretsLoading ? (
            <p className="text-slate-500 text-sm">Loading secrets…</p>
          ) : secrets.length === 0 ? (
            <p className="text-slate-500 text-sm">No secrets yet. Add one with the button above.</p>
          ) : (
            <div className="space-y-6">
              {groupedSecrets.map(
                (group) =>
                  group.items.length > 0 && (
                    <div key={group.category}>
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                        {group.category}
                      </h3>
                      <ul className="space-y-2">
                        {group.items.map((s) => (
                          <li
                            key={s.key}
                            className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 rounded-lg px-4 py-3 border border-slate-100"
                          >
                            <div className="min-w-0">
                              <span className="font-mono text-sm text-slate-800">{s.key}</span>
                              <span className="ml-3 font-mono text-sm text-slate-500">
                                {revealedKey === s.key ? revealedValue : MASK}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleReveal(s.key)}
                              className="text-xs text-primary hover:text-primary-hover font-medium shrink-0 cursor-pointer"
                            >
                              {revealedKey === s.key ? "Hide" : "Reveal"}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
              )}
              {otherSecrets.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Other
                  </h3>
                  <ul className="space-y-2">
                    {otherSecrets.map((s) => (
                      <li
                        key={s.key}
                        className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 rounded-lg px-4 py-3 border border-slate-100"
                      >
                        <div className="min-w-0">
                          <span className="font-mono text-sm text-slate-800">{s.key}</span>
                          <span className="ml-2 text-xs text-slate-400">({s.category})</span>
                          <span className="ml-3 font-mono text-sm text-slate-500">
                            {revealedKey === s.key ? revealedValue : MASK}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleReveal(s.key)}
                          className="text-xs text-primary hover:text-primary-hover font-medium shrink-0 cursor-pointer"
                        >
                          {revealedKey === s.key ? "Hide" : "Reveal"}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {subTab === "salesforce" && (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <h2 className="text-lg font-medium text-slate-800">Salesforce</h2>

          {sfHealthError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {sfHealthError}
            </div>
          )}

          {sfHealthLoading ? (
            <p className="text-slate-500 text-sm">Checking org health…</p>
          ) : sfHealth ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">Status</span>
                <span
                  className={`text-sm font-medium px-2 py-0.5 rounded-full ${
                    sfHealth.status === "CONNECTED"
                      ? "bg-emerald-100 text-emerald-800"
                      : sfHealth.status === "NOT_CONFIGURED"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {sfHealth.status}
                </span>
              </div>
              {sfHealth.message && (
                <p className="text-sm text-slate-600">{sfHealth.message}</p>
              )}
              {sfHealth.status === "CONNECTED" && (
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mt-2">
                  <div>
                    <dt className="text-slate-500">Instance URL</dt>
                    <dd className="font-mono text-slate-800 break-all">{sfHealth.instanceUrl}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Username</dt>
                    <dd className="font-mono text-slate-800">{sfHealth.username}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Org ID</dt>
                    <dd className="font-mono text-slate-800">{sfHealth.orgId}</dd>
                  </div>
                </dl>
              )}
            </div>
          ) : null}

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h3 className="text-sm font-semibold text-slate-700">Accounts</h3>
              <button
                type="button"
                onClick={() => loadAccounts()}
                disabled={accountsLoading}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
              >
                {accountsLoading ? "Refreshing…" : "Refresh"}
              </button>
            </div>
            {accountsError && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-4 py-3 mb-2">
                {accountsError}
              </div>
            )}
            {!accountsLoading && accountRecords.length === 0 && !accountsError ? (
              <p className="text-slate-500 text-sm">No account rows returned.</p>
            ) : accountsLoading && accountRecords.length === 0 ? (
              <p className="text-slate-500 text-sm">Loading accounts…</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full text-sm text-left">
                  <thead className="bg-slate-100 text-slate-600">
                    <tr>
                      {tableColumns(accountRecords).map((col) => (
                        <th key={col} className="px-3 py-2 font-medium whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {accountRecords.map((row, i) => (
                      <tr key={i} className="bg-white hover:bg-slate-50">
                        {tableColumns(accountRecords).map((col) => (
                          <td key={col} className="px-3 py-2 text-slate-800 whitespace-nowrap max-w-xs truncate">
                            {formatCell(row[col])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-2">SOQL query</h3>
            <textarea
              value={soql}
              onChange={(e) => setSoql(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-sm text-slate-800 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              placeholder="SELECT Id, Name FROM Account LIMIT 10"
            />
            <button
              type="button"
              onClick={runQuery}
              disabled={queryLoading || !soql.trim()}
              className="mt-2 px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary-hover disabled:opacity-50 cursor-pointer"
            >
              {queryLoading ? "Running…" : "Run query"}
            </button>
            {queryError && (
              <div className="mt-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                {queryError}
              </div>
            )}
            {queryResult && queryRecords.length > 0 && (
              <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full text-sm text-left">
                  <thead className="bg-slate-100 text-slate-600">
                    <tr>
                      {tableColumns(queryRecords).map((col) => (
                        <th key={col} className="px-3 py-2 font-medium whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {queryRecords.map((row, i) => (
                      <tr key={i} className="bg-white hover:bg-slate-50">
                        {tableColumns(queryRecords).map((col) => (
                          <td key={col} className="px-3 py-2 text-slate-800 whitespace-nowrap max-w-xs truncate">
                            {formatCell(row[col])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {queryResult && queryRecords.length === 0 && !queryError && (
              <p className="mt-2 text-slate-500 text-sm">Query returned no rows.</p>
            )}
          </div>
        </section>
      )}

      {subTab === "team" && (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-medium text-slate-800">Team</h2>
            {!showTeamForm && (
              <button
                type="button"
                onClick={() => setShowTeamForm(true)}
                className="px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary-hover cursor-pointer"
              >
                Add member
              </button>
            )}
          </div>

          {teamError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
              {teamError}
            </div>
          )}

          {showTeamForm && (
            <form
              onSubmit={submitTeamMember}
              className="bg-slate-50 rounded-lg p-4 mb-6 space-y-3 border border-slate-200"
            >
              <h3 className="font-medium text-slate-700">New member</h3>
              {teamFormError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
                  {teamFormError}
                </div>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <input
                  type="text"
                  placeholder="Username"
                  value={teamForm.username}
                  onChange={(e) => setTeamForm({ ...teamForm, username: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-800 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  required
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={teamForm.password}
                  onChange={(e) => setTeamForm({ ...teamForm, password: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-800 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  required
                />
                <select
                  value={teamForm.role}
                  onChange={(e) => setTeamForm({ ...teamForm, role: e.target.value as TeamRole })}
                  className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-800 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                >
                  {TEAM_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary-hover cursor-pointer"
                >
                  Add member
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowTeamForm(false);
                    setTeamFormError("");
                  }}
                  className="px-4 py-2 border border-slate-300 text-slate-600 text-sm rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {teamLoading ? (
            <p className="text-slate-500 text-sm">Loading team…</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-sm text-left">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-medium">Username</th>
                    <th className="px-3 py-2 font-medium">Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {team.map((m) => (
                    <tr key={m.id} className="bg-white hover:bg-slate-50">
                      <td className="px-3 py-2 font-mono text-slate-800">{m.username}</td>
                      <td className="px-3 py-2 text-slate-700">{m.role}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {subTab === "security" && <SecurityTab />}

      {subTab === "appearance" && <AppearanceTab />}
    </div>
  );
}

function WorkspacesTab() {
  const { workspaces, activeWorkspace, switchWorkspace, createWorkspace, updateWorkspace, deleteWorkspace, refresh } = useWorkspace();
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [error, setError] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  useEffect(() => { refresh(); }, [refresh]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const ws = await createWorkspace(createName.trim(), createDesc.trim());
      switchWorkspace(ws.id);
      setCreateName("");
      setCreateDesc("");
      setShowCreate(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create workspace");
    }
  };

  const handleUpdate = async (id: number) => {
    setError("");
    try {
      await updateWorkspace(id, { name: editName.trim(), description: editDesc.trim() });
      setEditingId(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update workspace");
    }
  };

  const handleDelete = async (id: number) => {
    setError("");
    try {
      await deleteWorkspace(id);
      setConfirmDeleteId(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete workspace");
    }
  };

  const startEdit = (ws: Workspace) => {
    setEditingId(ws.id);
    setEditName(ws.name);
    setEditDesc(ws.description);
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-slate-800">Workspaces</h2>
          <p className="text-sm text-slate-500">Isolated environments for your projects and data.</p>
        </div>
        {!showCreate && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary-hover cursor-pointer"
          >
            New Workspace
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {showCreate && (
        <form onSubmit={handleCreate} className="bg-slate-50 rounded-lg p-4 space-y-3 border border-slate-200">
          <h3 className="font-medium text-slate-700">Create workspace</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              type="text"
              placeholder="Workspace name"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-800 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              required
              autoFocus
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={createDesc}
              onChange={(e) => setCreateDesc(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-800 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary-hover cursor-pointer">
              Create
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 border border-slate-300 text-slate-600 text-sm rounded-lg hover:bg-slate-100 cursor-pointer">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {workspaces.map((ws) => (
          <div
            key={ws.id}
            className={`rounded-xl border p-4 transition-all ${
              ws.id === activeWorkspace?.id
                ? "border-primary bg-primary-bg-subtle"
                : "border-slate-200 bg-white"
            }`}
          >
            {editingId === ws.id ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-800 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  />
                  <input
                    type="text"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    placeholder="Description"
                    className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-800 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleUpdate(ws.id)} className="px-3 py-1.5 bg-primary text-white text-xs rounded-lg hover:bg-primary-hover cursor-pointer">Save</button>
                  <button onClick={() => setEditingId(null)} className="px-3 py-1.5 border border-slate-300 text-slate-600 text-xs rounded-lg hover:bg-slate-100 cursor-pointer">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">{ws.name}</span>
                    {ws.is_default ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600 font-medium">default</span>
                    ) : null}
                    {ws.id === activeWorkspace?.id && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary text-white font-medium">active</span>
                    )}
                  </div>
                  {ws.description && <p className="text-xs text-slate-500 mt-0.5">{ws.description}</p>}
                  <p className="text-xs text-slate-400 mt-1">
                    {ws.projectCount} project{ws.projectCount !== 1 ? "s" : ""} &middot; Created {new Date(ws.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {ws.id !== activeWorkspace?.id && (
                    <button onClick={() => switchWorkspace(ws.id)} className="px-3 py-1.5 text-xs font-medium text-primary border border-primary rounded-lg hover:bg-primary-bg-subtle cursor-pointer">
                      Switch
                    </button>
                  )}
                  <button onClick={() => startEdit(ws)} className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-100 cursor-pointer">
                    Edit
                  </button>
                  {!ws.is_default && (
                    confirmDeleteId === ws.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleDelete(ws.id)} className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 cursor-pointer">
                          Confirm
                        </button>
                        <button onClick={() => setConfirmDeleteId(null)} className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-100 cursor-pointer">
                          No
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDeleteId(ws.id)} className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 cursor-pointer">
                        Delete
                      </button>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function AppearanceTab() {
  const { mode, accent, setMode, setAccent } = useTheme();

  return (
    <section className="rounded-xl border border-border bg-surface p-6 shadow-sm space-y-8">
      <div>
        <h2 className="text-lg font-medium text-text mb-1">Appearance</h2>
        <p className="text-sm text-text-muted">Customize the look and feel of your dashboard.</p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-text mb-3">Mode</h3>
        <div className="flex gap-3">
          {MODE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setMode(opt.id)}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all cursor-pointer ${
                mode === opt.id
                  ? "border-primary bg-primary-bg-subtle text-primary-text shadow-sm"
                  : "border-border text-text-muted hover:border-border hover:bg-surface-alt"
              }`}
            >
              <span className="text-lg">{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-text mb-3">Accent color</h3>
        <div className="flex gap-3 flex-wrap">
          {ACCENT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setAccent(preset.id)}
              className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer min-w-[72px] ${
                accent === preset.id
                  ? "border-primary shadow-sm bg-primary-bg-subtle"
                  : "border-border hover:border-border"
              }`}
            >
              <span
                className="w-8 h-8 rounded-full shadow-inner ring-2 ring-surface"
                style={{ backgroundColor: preset.swatch }}
              />
              <span className="text-xs font-medium text-text-muted">{preset.label}</span>
              {accent === preset.id && (
                <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface-alt p-4">
        <p className="text-xs text-text-muted">
          Changes are applied instantly and saved to your browser. They persist across sessions.
        </p>
      </div>
    </section>
  );
}

interface FieldEntry { field: string; sensitivity: string; maskingRule: string; example: string }
interface AuditEntry { id: number; correlation_id: string; action: string; secret_key: string; user_id: string | null; ip_address: string | null; timestamp: string }
interface SecurityStatus {
  encryption: { enabled: boolean; algorithm: string; keySource: string; fieldEncryptionEnabled: boolean };
  piiClassification: { enabled: boolean; totalFields: number; piiFields: number; pciFields: number; secretFields: number };
  vaultAudit: { enabled: boolean; totalEntries: number; lastAccess: string | null };
  correlationId: { enabled: boolean; headerName: string; propagation: string[] };
}

function SecurityTab() {
  const [secView, setSecView] = useState<"overview" | "fields" | "audit" | "mask">("overview");
  const [fields, setFields] = useState<FieldEntry[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [status, setStatus] = useState<SecurityStatus | null>(null);
  const [maskInput, setMaskInput] = useState('{\n  "email": "jane@example.com",\n  "first_name": "Jane",\n  "phone": "+1-555-867-5309",\n  "sf_id": "003xx000004TmiZ"\n}');
  const [maskResult, setMaskResult] = useState<{ masked: Record<string, unknown>; details: Array<{ field: string; sensitivity: string; masked: string; wasMasked: boolean }> } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (secView === "overview") {
      api.get<{ encryption: SecurityStatus["encryption"]; piiClassification: SecurityStatus["piiClassification"]; vaultAudit: SecurityStatus["vaultAudit"]; correlationId: SecurityStatus["correlationId"] }>("/security/status").then(setStatus).catch(() => {});
    }
    if (secView === "fields") {
      api.get<{ fields: FieldEntry[] }>("/security/fields").then(r => setFields(r.fields)).catch(() => {});
    }
    if (secView === "audit") {
      api.get<{ entries: AuditEntry[]; total: number }>("/security/vault-audit?limit=50").then(r => { setAuditEntries(r.entries); setAuditTotal(r.total); }).catch(() => {});
    }
  }, [secView]);

  const runMaskTest = async () => {
    setLoading(true);
    try {
      const payload = JSON.parse(maskInput);
      const result = await api.post<{ masked: Record<string, unknown>; details: Array<{ field: string; sensitivity: string; masked: string; wasMasked: boolean }> }>("/security/test-mask", { payload });
      setMaskResult(result);
    } catch { setMaskResult(null); }
    setLoading(false);
  };

  const viewTabs: { id: typeof secView; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "fields", label: "PII Registry" },
    { id: "audit", label: "Vault Audit" },
    { id: "mask", label: "Mask Preview" },
  ];

  const badgeColor = (s: string) => {
    switch (s) {
      case "pii": return "bg-amber-100 text-amber-800";
      case "pci": return "bg-red-100 text-red-800";
      case "secret": return "bg-purple-100 text-purple-800";
      case "internal": return "bg-blue-100 text-blue-800";
      default: return "bg-slate-100 text-slate-600";
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
      <h2 className="text-lg font-semibold text-slate-800">Security</h2>

      <div className="flex gap-2 border-b border-slate-200 pb-2">
        {viewTabs.map(t => (
          <button key={t.id} onClick={() => setSecView(t.id)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ${secView === t.id ? "bg-primary text-white" : "text-slate-600 hover:bg-slate-100"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {secView === "overview" && status && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-slate-200 p-4 space-y-2">
            <h3 className="font-medium text-slate-700">Encryption</h3>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${status.encryption.enabled ? "bg-green-500" : "bg-red-500"}`} />
              <span className="text-sm text-slate-600">{status.encryption.algorithm}</span>
            </div>
            <p className="text-xs text-slate-500">Key source: {status.encryption.keySource}</p>
            <p className="text-xs text-slate-500">Field encryption: {status.encryption.fieldEncryptionEnabled ? "Enabled" : "Disabled"}</p>
          </div>

          <div className="rounded-lg border border-slate-200 p-4 space-y-2">
            <h3 className="font-medium text-slate-700">PII/PCI Classification</h3>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span className="text-sm text-slate-600">{status.piiClassification.totalFields} fields classified</span>
            </div>
            <div className="flex gap-3 text-xs text-slate-500">
              <span>{status.piiClassification.piiFields} PII</span>
              <span>{status.piiClassification.pciFields} PCI</span>
              <span>{status.piiClassification.secretFields} Secret</span>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-4 space-y-2">
            <h3 className="font-medium text-slate-700">Vault Audit Trail</h3>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span className="text-sm text-slate-600">{status.vaultAudit.totalEntries} audit entries</span>
            </div>
            <p className="text-xs text-slate-500">Last access: {status.vaultAudit.lastAccess || "Never"}</p>
          </div>

          <div className="rounded-lg border border-slate-200 p-4 space-y-2">
            <h3 className="font-medium text-slate-700">Correlation ID Tracking</h3>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span className="text-sm text-slate-600">{status.correlationId.headerName}</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {status.correlationId.propagation.map(p => (
                <span key={p} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{p}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {secView === "fields" && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-3 text-slate-600 font-medium">Field</th>
                <th className="text-left py-2 px-3 text-slate-600 font-medium">Sensitivity</th>
                <th className="text-left py-2 px-3 text-slate-600 font-medium">Masking Rule</th>
                <th className="text-left py-2 px-3 text-slate-600 font-medium">Example</th>
              </tr>
            </thead>
            <tbody>
              {fields.map(f => (
                <tr key={f.field} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 px-3 font-mono text-xs">{f.field}</td>
                  <td className="py-2 px-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeColor(f.sensitivity)}`}>{f.sensitivity}</span>
                  </td>
                  <td className="py-2 px-3 text-slate-600 text-xs">{f.maskingRule}</td>
                  <td className="py-2 px-3 font-mono text-xs text-slate-500">{f.example}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {secView === "audit" && (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">{auditTotal} total audit entries</p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 text-slate-600 font-medium">Time</th>
                  <th className="text-left py-2 px-3 text-slate-600 font-medium">Action</th>
                  <th className="text-left py-2 px-3 text-slate-600 font-medium">Key</th>
                  <th className="text-left py-2 px-3 text-slate-600 font-medium">User</th>
                  <th className="text-left py-2 px-3 text-slate-600 font-medium">Correlation ID</th>
                </tr>
              </thead>
              <tbody>
                {auditEntries.map(e => (
                  <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2 px-3 text-xs text-slate-500">{e.timestamp}</td>
                    <td className="py-2 px-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${e.action === "write" ? "bg-blue-100 text-blue-700" : e.action === "delete" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>
                        {e.action}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-mono text-xs">{e.secret_key}</td>
                    <td className="py-2 px-3 text-xs text-slate-500">{e.user_id || "-"}</td>
                    <td className="py-2 px-3 font-mono text-xs text-slate-400">{e.correlation_id.slice(0, 8)}...</td>
                  </tr>
                ))}
                {auditEntries.length === 0 && (
                  <tr><td colSpan={5} className="py-6 text-center text-sm text-slate-400">No audit entries yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {secView === "mask" && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Paste a JSON payload to see how PII fields are masked.</p>
          <textarea
            value={maskInput}
            onChange={e => setMaskInput(e.target.value)}
            rows={6}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button onClick={runMaskTest} disabled={loading}
            className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 cursor-pointer">
            {loading ? "Masking..." : "Test Masking"}
          </button>

          {maskResult && (
            <div className="space-y-3">
              <h4 className="font-medium text-slate-700 text-sm">Masked Output</h4>
              <pre className="bg-slate-50 rounded-lg p-3 text-xs font-mono overflow-x-auto border border-slate-200">
                {JSON.stringify(maskResult.masked, null, 2)}
              </pre>
              <h4 className="font-medium text-slate-700 text-sm">Field Details</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 px-3 text-slate-600 font-medium">Field</th>
                      <th className="text-left py-2 px-3 text-slate-600 font-medium">Sensitivity</th>
                      <th className="text-left py-2 px-3 text-slate-600 font-medium">Masked Value</th>
                      <th className="text-left py-2 px-3 text-slate-600 font-medium">Changed?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {maskResult.details.map(d => (
                      <tr key={d.field} className="border-b border-slate-100">
                        <td className="py-2 px-3 font-mono text-xs">{d.field}</td>
                        <td className="py-2 px-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeColor(d.sensitivity)}`}>{d.sensitivity}</span></td>
                        <td className="py-2 px-3 font-mono text-xs">{d.masked}</td>
                        <td className="py-2 px-3">{d.wasMasked ? <span className="text-green-600 text-xs font-medium">Masked</span> : <span className="text-slate-400 text-xs">No change</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
