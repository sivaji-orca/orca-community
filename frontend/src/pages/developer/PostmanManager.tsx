import { useState, useEffect } from "react";
import { api } from "../../api/client";
import { Card } from "../../components/Card";
import { StatusBadge } from "../../components/StatusBadge";

interface WorkspaceStatus { connected: boolean; workspaceId: string | null; workspaceName: string | null }
interface SyncEntry { projectName: string; synced: boolean; collectionUid: string | null; lastSynced: string | null }

export function PostmanManager() {
  const [workspace, setWorkspace] = useState<WorkspaceStatus | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const loadData = async () => {
    try {
      const [ws, ss] = await Promise.all([
        api.get<WorkspaceStatus>("/postman/workspace"),
        api.get<SyncEntry[]>("/postman/sync-status"),
      ]);
      setWorkspace(ws);
      setSyncStatus(ss);
    } catch (e: any) { setError(e.message); }
  };

  useEffect(() => { loadData(); }, []);

  const connectWorkspace = async () => {
    setLoading(true); setError(""); setMsg("");
    try {
      const result = await api.post<{ message: string; workspaceId: string; workspaceName: string }>("/postman/workspace");
      setMsg(`Workspace "${result.workspaceName}" connected`);
      await loadData();
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  const syncProject = async (projectName: string) => {
    setSyncing(projectName); setError(""); setMsg("");
    try {
      const result = await api.post<{ message: string }>(`/postman/sync/${projectName}`);
      setMsg(result.message);
      await loadData();
    } catch (e: any) { setError(e.message); } finally { setSyncing(null); }
  };

  const syncAll = async () => {
    setLoading(true); setError(""); setMsg("");
    try {
      const result = await api.post<{ message: string; results: any[] }>("/postman/sync-all");
      setMsg(result.message);
      await loadData();
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  const removeProject = async (projectName: string) => {
    setSyncing(projectName); setError(""); setMsg("");
    try {
      const result = await api.delete<{ message: string }>(`/postman/collection/${projectName}`);
      setMsg(result.message);
      await loadData();
    } catch (e: any) { setError(e.message); } finally { setSyncing(null); }
  };

  const syncedCount = syncStatus.filter((s) => s.synced).length;

  return (
    <Card title="Postman Manager">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>}
      {msg && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3 mb-4">{msg}</div>}

      <div className="bg-slate-50 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-1">Postman Workspace</h3>
            {workspace?.connected ? (
              <div className="flex items-center gap-3">
                <StatusBadge status="STARTED" />
                <span className="text-sm text-slate-600">
                  <span className="font-medium">{workspace.workspaceName}</span>
                  <span className="text-xs text-slate-400 ml-2 font-mono">{workspace.workspaceId}</span>
                </span>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No workspace connected. Connect to create a "Orca" workspace in your Postman account.</p>
            )}
          </div>
          {!workspace?.connected && (
            <button onClick={connectWorkspace} disabled={loading}
              className="px-4 py-2 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 disabled:opacity-50 font-medium cursor-pointer">
              {loading ? "Connecting..." : "Connect Workspace"}
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-slate-700">Collections</h3>
          <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
            {syncedCount}/{syncStatus.length} synced
          </span>
        </div>
        <div className="flex gap-2">
          <button onClick={syncAll} disabled={loading || !workspace?.connected}
            className="px-4 py-2 bg-primary text-white text-xs rounded-lg hover:bg-primary-hover disabled:opacity-50 font-medium cursor-pointer">
            {loading ? "Syncing..." : "Sync All to Postman"}
          </button>
          <button onClick={loadData} className="px-3 py-2 bg-slate-200 text-slate-600 text-xs rounded-lg hover:bg-slate-300 cursor-pointer">
            Refresh
          </button>
        </div>
      </div>

      {syncStatus.length === 0 ? (
        <p className="text-sm text-slate-400">No projects found. Scaffold a project first, then sync it to Postman.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-2 px-3 text-slate-500 font-medium">Project</th>
              <th className="text-left py-2 px-3 text-slate-500 font-medium">Collection</th>
              <th className="text-left py-2 px-3 text-slate-500 font-medium">Status</th>
              <th className="text-left py-2 px-3 text-slate-500 font-medium">Last Synced</th>
              <th className="text-right py-2 px-3 text-slate-500 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {syncStatus.map((entry) => (
              <tr key={entry.projectName} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="py-3 px-3 font-medium text-slate-700">{entry.projectName}</td>
                <td className="py-3 px-3 text-xs font-mono text-slate-500">
                  {entry.synced ? `${entry.projectName} API Collection` : "--"}
                </td>
                <td className="py-3 px-3">
                  <StatusBadge status={entry.synced ? "DEPLOYED" : "UNDEPLOYED"} />
                </td>
                <td className="py-3 px-3 text-xs text-slate-400">
                  {entry.lastSynced ? new Date(entry.lastSynced).toLocaleString() : "--"}
                </td>
                <td className="py-3 px-3 text-right">
                  <div className="flex gap-1 justify-end">
                    <button
                      onClick={() => syncProject(entry.projectName)}
                      disabled={syncing === entry.projectName || !workspace?.connected}
                      className="px-3 py-1 bg-primary text-white text-xs rounded hover:bg-primary-hover disabled:opacity-50 cursor-pointer">
                      {syncing === entry.projectName ? "..." : entry.synced ? "Re-sync" : "Sync"}
                    </button>
                    {entry.synced && entry.collectionUid && (
                      <>
                        <a
                          href={`https://go.postman.co/collection/${entry.collectionUid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1 border border-orange-300 text-orange-600 text-xs rounded hover:bg-orange-50 cursor-pointer inline-block">
                          Open in Postman
                        </a>
                        <button
                          onClick={() => removeProject(entry.projectName)}
                          disabled={syncing === entry.projectName}
                          className="px-3 py-1 border border-red-300 text-red-600 text-xs rounded hover:bg-red-50 disabled:opacity-50 cursor-pointer">
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
        <p className="text-xs text-amber-700">
          Collections synced here appear in your Postman desktop app under the <strong>Orca</strong> workspace.
          Open Postman to run requests, add tests, and collaborate with your team.
        </p>
      </div>
    </Card>
  );
}
