import { useState, useEffect } from "react";
import { api } from "../../api/client";
import { Card } from "../../components/Card";

interface TestResult { name: string; status: "passed" | "failed" | "error"; duration: string; message?: string }

export function TestRunner() {
  const [projects, setProjects] = useState<string[]>([]);
  const [selected, setSelected] = useState("");
  const [munitOutput, setMunitOutput] = useState("");
  const [pythonOutput, setPythonOutput] = useState("");
  const [munitResults, setMunitResults] = useState<TestResult[]>([]);
  const [pythonResults, setPythonResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState<"munit" | "python" | "scaffold-munit" | "scaffold-python" | null>(null);
  const [flowName, setFlowName] = useState("");
  const [endpoint, setEndpoint] = useState("/api/hello");
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState<"python" | "munit">("python");

  useEffect(() => { api.get<string[]>("/projects/list").then(setProjects).catch(() => {}); }, []);

  const runMunit = async () => {
    if (!selected) return; setLoading("munit"); setMsg("");
    try {
      const r = await api.post<{ output: string; results: TestResult[] }>("/testing/munit/run", { projectName: selected });
      setMunitOutput(r.output); setMunitResults(r.results);
    } catch (e: any) { setMunitOutput(e.message); } finally { setLoading(null); }
  };

  const runPython = async () => {
    if (!selected) return; setLoading("python"); setMsg("");
    try {
      const r = await api.post<{ output: string; results: TestResult[] }>("/testing/python/run", { projectName: selected });
      setPythonOutput(r.output); setPythonResults(r.results);
    } catch (e: any) { setPythonOutput(e.message); } finally { setLoading(null); }
  };

  const scaffoldMunit = async () => {
    if (!selected || !flowName) return; setLoading("scaffold-munit");
    try { const r = await api.post<{ message: string }>("/testing/munit/scaffold", { projectName: selected, flowName }); setMsg(r.message); } catch (e: any) { setMsg(e.message); }
    finally { setLoading(null); }
  };

  const scaffoldPython = async () => {
    if (!selected || !endpoint) return; setLoading("scaffold-python");
    try { const r = await api.post<{ message: string }>("/testing/python/scaffold", { projectName: selected, endpoint }); setMsg(r.message); } catch (e: any) { setMsg(e.message); }
    finally { setLoading(null); }
  };

  const passedCount = (r: TestResult[]) => r.filter((t) => t.status === "passed").length;
  const failedCount = (r: TestResult[]) => r.filter((t) => t.status !== "passed").length;

  return (
    <Card title="Test Runner">
      <div className="flex gap-3 mb-4 items-center">
        <select value={selected} onChange={(e) => setSelected(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none">
          <option value="">Select project</option>
          {projects.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {(["python", "munit"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-3 py-1 rounded text-xs font-medium cursor-pointer ${tab === t ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-200"}`}>
              {t === "python" ? "Python (pytest)" : "MUnit"}
            </button>
          ))}
        </div>
      </div>

      {msg && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3 mb-4">{msg}</div>}

      {tab === "python" && (
        <div className="space-y-4">
          <div className="flex gap-3 items-end">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Scaffold test for endpoint</label>
              <div className="flex gap-2">
                <input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="/api/hello" className="px-2 py-1 rounded border border-slate-300 text-xs outline-none font-mono w-40" />
                <button onClick={scaffoldPython} disabled={!selected || loading === "scaffold-python"}
                  className="px-3 py-1 bg-amber-600 text-white text-xs rounded hover:bg-amber-700 disabled:opacity-50 cursor-pointer">Generate</button>
              </div>
            </div>
            <button onClick={runPython} disabled={!selected || loading === "python"}
              className="px-5 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium cursor-pointer">
              {loading === "python" ? "Running..." : "Run Python Tests"}
            </button>
          </div>

          {pythonResults.length > 0 && (
            <div className="flex gap-3 items-center">
              <div className="bg-green-100 text-green-700 text-sm px-3 py-1 rounded-full font-medium">{passedCount(pythonResults)} passed</div>
              {failedCount(pythonResults) > 0 && <div className="bg-red-100 text-red-700 text-sm px-3 py-1 rounded-full font-medium">{failedCount(pythonResults)} failed</div>}
              <div className="flex-1 bg-slate-200 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: `${(passedCount(pythonResults) / pythonResults.length) * 100}%` }} />
              </div>
            </div>
          )}

          {pythonResults.length > 0 && (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-200">
                <th className="text-left py-2 px-2 text-slate-500 font-medium">Test</th>
                <th className="text-left py-2 px-2 text-slate-500 font-medium">Status</th>
              </tr></thead>
              <tbody>
                {pythonResults.map((r, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td className="py-2 px-2 text-xs font-mono">{r.name}</td>
                    <td className={`py-2 px-2 text-xs font-medium ${r.status === "passed" ? "text-green-600" : "text-red-600"}`}>{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {pythonOutput && <pre className="bg-slate-900 text-green-400 p-3 rounded-lg text-xs font-mono overflow-auto max-h-64 whitespace-pre-wrap">{pythonOutput}</pre>}
        </div>
      )}

      {tab === "munit" && (
        <div className="space-y-4">
          <div className="flex gap-3 items-end">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Scaffold MUnit test for flow</label>
              <div className="flex gap-2">
                <input value={flowName} onChange={(e) => setFlowName(e.target.value)} placeholder="hello-flow" className="px-2 py-1 rounded border border-slate-300 text-xs outline-none font-mono w-40" />
                <button onClick={scaffoldMunit} disabled={!selected || loading === "scaffold-munit"}
                  className="px-3 py-1 bg-amber-600 text-white text-xs rounded hover:bg-amber-700 disabled:opacity-50 cursor-pointer">Generate</button>
              </div>
            </div>
            <button onClick={runMunit} disabled={!selected || loading === "munit"}
              className="px-5 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium cursor-pointer">
              {loading === "munit" ? "Running..." : "Run MUnit Tests"}
            </button>
          </div>

          {munitResults.length > 0 && (
            <div className="flex gap-3 items-center">
              <div className="bg-green-100 text-green-700 text-sm px-3 py-1 rounded-full font-medium">{passedCount(munitResults)} passed</div>
              {failedCount(munitResults) > 0 && <div className="bg-red-100 text-red-700 text-sm px-3 py-1 rounded-full font-medium">{failedCount(munitResults)} failed</div>}
            </div>
          )}

          {munitOutput && <pre className="bg-slate-900 text-green-400 p-3 rounded-lg text-xs font-mono overflow-auto max-h-64 whitespace-pre-wrap">{munitOutput}</pre>}
        </div>
      )}
    </Card>
  );
}
