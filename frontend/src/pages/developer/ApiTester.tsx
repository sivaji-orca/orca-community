import { useState, useEffect } from "react";
import { api } from "../../api/client";
import { Card } from "../../components/Card";
import { StatusBadge } from "../../components/StatusBadge";

interface TestResponse { status: number; statusText: string; headers: Record<string, string>; body: string; timeMs: number }
interface HistoryItem { id: number; project_name: string; run_at: string; total: number; passed: number; failed: number }

export function ApiTester() {
  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState("http://localhost:8081/api/hello");
  const [headersText, setHeadersText] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [response, setResponse] = useState<TestResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [projects, setProjects] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [collectionResults, setCollectionResults] = useState<any[] | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [tab, setTab] = useState<"request" | "collection" | "history">("request");

  useEffect(() => { api.get<string[]>("/projects/list").then(setProjects).catch(() => {}); }, []);
  useEffect(() => { if (selectedProject) api.get<HistoryItem[]>(`/test/history/${selectedProject}`).then(setHistory).catch(() => {}); }, [selectedProject]);

  const sendRequest = async () => {
    setLoading(true); setError(""); setResponse(null);
    try {
      let headers: Record<string, string> = {};
      if (headersText.trim()) { try { headers = JSON.parse(headersText); } catch { setError("Invalid headers JSON"); setLoading(false); return; } }
      const resp = await api.post<TestResponse>("/test/run-request", { method, url, headers, body: bodyText || undefined });
      setResponse(resp);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  const runCollection = async () => {
    if (!selectedProject) return; setLoading(true); setError(""); setCollectionResults(null);
    try {
      const colResp = await api.post<{ message: string; collection: any }>("/postman/generate", { projectName: selectedProject });
      const result = await api.post<{ results: any[]; total: number; passed: number; failed: number }>("/test/run-collection", { collection: colResp.collection, projectName: selectedProject });
      setCollectionResults(result.results);
      if (selectedProject) api.get<HistoryItem[]>(`/test/history/${selectedProject}`).then(setHistory).catch(() => {});
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  const formatBody = (body: string) => { try { return JSON.stringify(JSON.parse(body), null, 2); } catch { return body; } };

  return (
    <Card title="API Tester">
      <div className="flex gap-2 mb-4">
        <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none">
          <option value="">Select project</option>
          {projects.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {(["request", "collection", "history"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-3 py-1 rounded text-xs font-medium cursor-pointer ${tab === t ? "bg-primary text-white" : "text-slate-600 hover:bg-slate-200"}`}>
              {t === "request" ? "Request" : t === "collection" ? "Collection" : "History"}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>}

      {tab === "request" && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-300 text-sm font-medium w-28 outline-none">
              {["GET", "POST", "PUT", "DELETE", "PATCH"].map((m) => <option key={m}>{m}</option>)}
            </select>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://localhost:8081/api/..." className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none font-mono" />
            <button onClick={sendRequest} disabled={loading || !url} className="px-5 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary-hover disabled:opacity-50 font-medium cursor-pointer">
              {loading ? "Sending..." : "Send"}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Headers (JSON)</label>
              <textarea value={headersText} onChange={(e) => setHeadersText(e.target.value)} rows={3} placeholder='{"Content-Type": "application/json"}'
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono outline-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Body</label>
              <textarea value={bodyText} onChange={(e) => setBodyText(e.target.value)} rows={3} placeholder="Request body..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono outline-none" />
            </div>
          </div>
          {response && (
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <StatusBadge status={response.status >= 200 && response.status < 400 ? "STARTED" : "FAILED"} />
                <span className="text-sm font-mono font-medium">{response.status} {response.statusText}</span>
                <span className="text-xs text-slate-400">{response.timeMs}ms</span>
              </div>
              <pre className="bg-slate-900 text-green-400 p-3 rounded-lg text-xs font-mono overflow-auto max-h-64 whitespace-pre-wrap">{formatBody(response.body)}</pre>
            </div>
          )}
        </div>
      )}

      {tab === "collection" && (
        <div>
          <button onClick={runCollection} disabled={loading || !selectedProject}
            className="px-5 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary-hover disabled:opacity-50 font-medium cursor-pointer mb-4">
            {loading ? "Running..." : "Run Collection"}
          </button>
          {collectionResults && (
            <div className="space-y-2">
              {collectionResults.map((r, i) => (
                <div key={i} className={`flex items-center justify-between rounded-lg px-4 py-3 ${r.passed ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                  <div>
                    <span className={`text-sm font-medium ${r.passed ? "text-green-700" : "text-red-700"}`}>{r.passed ? "\u2713" : "\u2717"} {r.name}</span>
                    <span className="ml-2 text-xs text-slate-500">{r.response.status} - {r.response.timeMs}ms</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "history" && (
        <div>
          {history.length === 0 ? <p className="text-sm text-slate-400">No test runs yet.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-200">
                <th className="text-left py-2 px-2 text-slate-500 font-medium">Date</th>
                <th className="text-left py-2 px-2 text-slate-500 font-medium">Total</th>
                <th className="text-left py-2 px-2 text-slate-500 font-medium">Passed</th>
                <th className="text-left py-2 px-2 text-slate-500 font-medium">Failed</th>
              </tr></thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-b border-slate-50">
                    <td className="py-2 px-2 text-xs text-slate-600">{h.run_at}</td>
                    <td className="py-2 px-2">{h.total}</td>
                    <td className="py-2 px-2 text-green-600">{h.passed}</td>
                    <td className="py-2 px-2 text-red-600">{h.failed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </Card>
  );
}
