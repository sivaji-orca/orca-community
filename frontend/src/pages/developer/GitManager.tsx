import { useState, useEffect } from "react";
import { api } from "../../api/client";
import { Card } from "../../components/Card";

interface Commit { hash: string; message: string; author: string; date: string }
interface BranchInfo { branches: string[]; current: string }

export function GitManager() {
  const [projects, setProjects] = useState<string[]>([]);
  const [selected, setSelected] = useState("");
  const [branchInfo, setBranchInfo] = useState<BranchInfo | null>(null);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [diff, setDiff] = useState("");
  const [newBranch, setNewBranch] = useState("");
  const [commitMsg, setCommitMsg] = useState("");
  const [prTitle, setPrTitle] = useState("");
  const [prHead, setPrHead] = useState("");
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [mergeSrc, setMergeSrc] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDiff, setShowDiff] = useState(false);

  useEffect(() => { api.get<string[]>("/projects/list").then(setProjects).catch(() => {}); }, []);

  const refresh = async (name?: string) => {
    const p = name || selected; if (!p) return;
    setLoading(true); setError("");
    try {
      const [b, c] = await Promise.all([api.get<BranchInfo>(`/git/branches/${p}`), api.get<Commit[]>(`/git/log/${p}`)]);
      setBranchInfo(b); setCommits(c);
      const { conflicts: cf } = await api.get<{ conflicts: string[] }>(`/git/conflicts/${p}`);
      setConflicts(cf);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  const selectProject = (p: string) => { setSelected(p); refresh(p); };

  const doAction = async (fn: () => Promise<any>, successMsg?: string) => {
    setError(""); setMsg(""); setLoading(true);
    try { const r = await fn(); setMsg(successMsg || r.message || "Done"); await refresh(); } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  const viewDiff = async () => {
    try { const { diff: d } = await api.get<{ diff: string }>(`/git/diff/${selected}`); setDiff(d); setShowDiff(true); } catch (e: any) { setError(e.message); }
  };

  return (
    <Card title="Git Manager">
      <div className="flex gap-3 mb-4 items-center">
        <select value={selected} onChange={(e) => e.target.value && selectProject(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none">
          <option value="">Select project</option>
          {projects.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        {branchInfo && <span className="text-xs bg-primary-bg text-primary-text px-2 py-1 rounded-full font-mono">{branchInfo.current}</span>}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>}
      {msg && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3 mb-4">{msg}</div>}

      {selected && branchInfo && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-slate-600 mb-3">Branches</h3>
              <div className="space-y-1 max-h-40 overflow-y-auto mb-3">
                {branchInfo.branches.filter((b) => !b.includes("remotes/")).map((b) => (
                  <div key={b} className={`flex items-center justify-between px-2 py-1 rounded text-sm ${b === branchInfo.current ? "bg-primary-bg text-primary-text font-medium" : "text-slate-600"}`}>
                    <span className="font-mono text-xs">{b}</span>
                    {b !== branchInfo.current && (
                      <button onClick={() => doAction(() => api.post("/git/checkout", { projectName: selected, branchName: b }))} className="text-xs text-primary cursor-pointer">Switch</button>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={newBranch} onChange={(e) => setNewBranch(e.target.value)} placeholder="feature-name" className="flex-1 px-2 py-1 rounded border border-slate-300 text-xs outline-none" />
                <button onClick={() => { doAction(() => api.post("/git/branch", { projectName: selected, branchName: newBranch })); setNewBranch(""); }} disabled={!newBranch}
                  className="px-3 py-1 bg-primary text-white text-xs rounded hover:bg-primary-hover disabled:opacity-50 cursor-pointer">Create</button>
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-slate-600 mb-3">Actions</h3>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input value={commitMsg} onChange={(e) => setCommitMsg(e.target.value)} placeholder="Commit message" className="flex-1 px-2 py-1 rounded border border-slate-300 text-xs outline-none" />
                  <button onClick={() => { doAction(() => api.post("/git/commit", { projectName: selected, message: commitMsg })); setCommitMsg(""); }} disabled={!commitMsg || loading}
                    className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50 cursor-pointer">{loading ? "..." : "Commit"}</button>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => doAction(() => api.post("/git/push", { projectName: selected }))} className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 cursor-pointer">Push</button>
                  <button onClick={() => doAction(() => api.post("/git/pull", { projectName: selected }))} className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 cursor-pointer">Pull</button>
                  <button onClick={viewDiff} className="px-3 py-1 border border-slate-300 text-slate-600 text-xs rounded hover:bg-slate-100 cursor-pointer">View Diff</button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-slate-600 mb-3">Merge</h3>
              <div className="flex gap-2 mb-2">
                <select value={mergeSrc} onChange={(e) => setMergeSrc(e.target.value)} className="flex-1 px-2 py-1 rounded border border-slate-300 text-xs outline-none">
                  <option value="">Source branch</option>
                  {branchInfo.branches.filter((b) => b !== branchInfo.current && !b.includes("remotes/")).map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
                <button onClick={() => doAction(() => api.post("/git/merge", { projectName: selected, sourceBranch: mergeSrc }))} disabled={!mergeSrc}
                  className="px-3 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 disabled:opacity-50 cursor-pointer">Merge</button>
              </div>
              {conflicts.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-red-600 font-medium mb-1">Conflicts ({conflicts.length}):</p>
                  {conflicts.map((f) => (
                    <div key={f} className="flex items-center justify-between bg-red-50 px-2 py-1 rounded text-xs mb-1">
                      <span className="font-mono">{f}</span>
                      <div className="flex gap-1">
                        <button onClick={() => doAction(() => api.post("/git/resolve-conflict", { projectName: selected, filePath: f, resolution: "ours" }))} className="text-blue-600 cursor-pointer">Ours</button>
                        <button onClick={() => doAction(() => api.post("/git/resolve-conflict", { projectName: selected, filePath: f, resolution: "theirs" }))} className="text-purple-600 cursor-pointer">Theirs</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-slate-600 mb-3">Pull Request</h3>
              <div className="space-y-2">
                <input value={prTitle} onChange={(e) => setPrTitle(e.target.value)} placeholder="PR title" className="w-full px-2 py-1 rounded border border-slate-300 text-xs outline-none" />
                <select value={prHead} onChange={(e) => setPrHead(e.target.value)} className="w-full px-2 py-1 rounded border border-slate-300 text-xs outline-none">
                  <option value="">Head branch</option>
                  {branchInfo.branches.filter((b) => b !== "main" && !b.includes("remotes/")).map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
                <button onClick={() => doAction(() => api.post("/git/pull-request", { projectName: selected, title: prTitle, head: prHead, base: "main" }))} disabled={!prTitle || !prHead}
                  className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50 cursor-pointer">Create PR</button>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-slate-600 mb-3">Commit History</h3>
            {commits.length === 0 ? <p className="text-xs text-slate-400">No commits yet.</p> : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {commits.map((c, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs py-1 border-b border-slate-100">
                    <span className="font-mono text-primary w-16 shrink-0">{c.hash}</span>
                    <span className="flex-1 text-slate-700 truncate">{c.message}</span>
                    <span className="text-slate-400 shrink-0">{c.author}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {showDiff && (
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-600">Diff</h3>
                <button onClick={() => setShowDiff(false)} className="text-xs text-slate-500 cursor-pointer">Hide</button>
              </div>
              <pre className="bg-slate-900 text-green-400 p-3 rounded-lg text-xs font-mono overflow-auto max-h-64 whitespace-pre-wrap">{diff || "No changes"}</pre>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
