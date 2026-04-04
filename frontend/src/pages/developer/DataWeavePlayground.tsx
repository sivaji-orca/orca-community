import { useState, useEffect, useCallback } from "react";

interface DwExample {
  id: string;
  name: string;
  category: string;
  description: string;
  script: string;
  sampleInput: string;
  inputMimeType: string;
  outputMimeType: string;
}

interface DwSnippet {
  id: number;
  name: string;
  description: string;
  script: string;
  sample_input: string;
  input_mime: string;
  output_mime: string;
  tags: string;
  created_at: string;
}

interface DwHistoryItem {
  id: number;
  script: string;
  input_mime: string;
  output_mime: string;
  success: number;
  error_message: string | null;
  execution_time_ms: number;
  engine: string;
  executed_at: string;
}

interface EngineStatus {
  available: boolean;
  engine: "mule-cli" | "java-fallback" | "none";
  muleHome: string;
  javaAvailable: boolean;
}

interface ExecutionResult {
  id: number;
  output: string;
  mimeType: string;
  executionTimeMs: number;
  engine: string;
  success: boolean;
  error?: string;
}

type SidebarTab = "examples" | "snippets" | "history";

const MIME_TYPES = [
  "application/json",
  "application/xml",
  "application/csv",
  "text/plain",
];

const DEFAULT_SCRIPT = `%dw 2.0
output application/json
---
payload`;

const DEFAULT_INPUT = `{
  "message": "Hello, DataWeave!"
}`;

function headers() {
  const token = localStorage.getItem("orca_token");
  const wsId = localStorage.getItem("orca_active_workspace") || "1";
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "X-Workspace-Id": wsId,
  };
}

export function DataWeavePlayground() {
  const [script, setScript] = useState(DEFAULT_SCRIPT);
  const [input, setInput] = useState(DEFAULT_INPUT);
  const [inputMime, setInputMime] = useState("application/json");
  const [outputMime, setOutputMime] = useState("application/json");
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [running, setRunning] = useState(false);

  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("examples");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [examples, setExamples] = useState<DwExample[]>([]);
  const [snippets, setSnippets] = useState<DwSnippet[]>([]);
  const [history, setHistory] = useState<DwHistoryItem[]>([]);
  const [engineStatus, setEngineStatus] = useState<EngineStatus | null>(null);

  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveDesc, setSaveDesc] = useState("");

  useEffect(() => {
    fetchExamples();
    fetchSnippets();
    fetchHistory();
    fetchEngineStatus();
  }, []);

  const fetchExamples = async () => {
    try {
      const res = await fetch("/api/dataweave/examples", { headers: headers() });
      if (res.ok) setExamples(await res.json());
    } catch {}
  };

  const fetchSnippets = async () => {
    try {
      const res = await fetch("/api/dataweave/snippets", { headers: headers() });
      if (res.ok) setSnippets(await res.json());
    } catch {}
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/dataweave/history", { headers: headers() });
      if (res.ok) setHistory(await res.json());
    } catch {}
  };

  const fetchEngineStatus = async () => {
    try {
      const res = await fetch("/api/dataweave/status", { headers: headers() });
      if (res.ok) setEngineStatus(await res.json());
    } catch {}
  };

  const runScript = useCallback(async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/dataweave/execute", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ script, input, inputMimeType: inputMime, outputMimeType: outputMime }),
      });
      const data = await res.json();
      setResult(data);
      fetchHistory();
    } catch (err: any) {
      setResult({ id: 0, output: "", mimeType: outputMime, executionTimeMs: 0, engine: "unknown", success: false, error: err.message });
    }
    setRunning(false);
  }, [script, input, inputMime, outputMime]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        runScript();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [runScript]);

  const loadExample = (ex: DwExample) => {
    setScript(ex.script);
    setInput(ex.sampleInput);
    setInputMime(ex.inputMimeType);
    setOutputMime(ex.outputMimeType);
    setResult(null);
  };

  const loadSnippet = (s: DwSnippet) => {
    setScript(s.script);
    setInput(s.sample_input);
    setInputMime(s.input_mime);
    setOutputMime(s.output_mime);
    setResult(null);
  };

  const loadHistoryItem = async (h: DwHistoryItem) => {
    try {
      const res = await fetch(`/api/dataweave/share/${h.id}`, { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        setScript(data.script);
        setInput(data.input_data || "{}");
        setInputMime(data.input_mime);
        setOutputMime(data.output_mime);
        if (data.output_data) {
          setResult({ id: data.id, output: data.output_data, mimeType: data.output_mime, executionTimeMs: data.execution_time_ms, engine: data.engine, success: !!data.success, error: data.error_message || undefined });
        }
      }
    } catch {}
  };

  const handleSave = async () => {
    if (!saveName.trim()) return;
    try {
      await fetch("/api/dataweave/snippets", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ name: saveName.trim(), description: saveDesc.trim(), script, sampleInput: input, inputMime, outputMime }),
      });
      fetchSnippets();
      setSaveModalOpen(false);
      setSaveName("");
      setSaveDesc("");
    } catch {}
  };

  const handleDeleteSnippet = async (id: number) => {
    try {
      await fetch(`/api/dataweave/snippets/${id}`, { method: "DELETE", headers: headers() });
      fetchSnippets();
    } catch {}
  };

  const handleShare = () => {
    if (result?.id) {
      const url = `${window.location.origin}?dwShare=${result.id}`;
      navigator.clipboard.writeText(url).catch(() => {});
    }
  };

  const groupedExamples = examples.reduce((acc, ex) => {
    if (!acc[ex.category]) acc[ex.category] = [];
    acc[ex.category].push(ex);
    return acc;
  }, {} as Record<string, DwExample[]>);

  const engineLabel = engineStatus?.engine === "mule-cli" ? "Mule CLI" : engineStatus?.engine === "java-fallback" ? "Java" : "Simulated";
  const engineColor = engineStatus?.engine === "mule-cli" ? "bg-emerald-100 text-emerald-700" : engineStatus?.engine === "java-fallback" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">DataWeave Playground</h2>
          <p className="text-sm text-slate-500">Write, test, and experiment with DataWeave transformations</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-[10px] px-2 py-1 rounded-full font-semibold ${engineColor}`}>
            Engine: {engineLabel}
          </span>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-sm text-slate-500 hover:text-slate-700 cursor-pointer px-2 py-1 rounded border border-slate-200 hover:bg-slate-50"
          >
            {sidebarOpen ? "Hide Sidebar" : "Show Sidebar"}
          </button>
        </div>
      </div>

      <div className="flex gap-4" style={{ minHeight: "600px" }}>
        {/* Sidebar */}
        {sidebarOpen && (
          <div className="w-64 shrink-0 bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden">
            <div className="flex border-b border-slate-100">
              {(["examples", "snippets", "history"] as SidebarTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSidebarTab(tab)}
                  className={`flex-1 px-2 py-2.5 text-xs font-medium capitalize cursor-pointer transition-colors ${
                    sidebarTab === tab ? "text-primary border-b-2 border-primary bg-primary-bg-subtle" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {sidebarTab === "examples" && (
                <div className="space-y-4">
                  {Object.entries(groupedExamples).map(([cat, exs]) => (
                    <div key={cat}>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">{cat}</p>
                      <div className="space-y-1">
                        {exs.map((ex) => (
                          <button
                            key={ex.id}
                            onClick={() => loadExample(ex)}
                            className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer group"
                          >
                            <span className="text-sm font-medium text-slate-700 group-hover:text-primary">{ex.name}</span>
                            <p className="text-[11px] text-slate-400 leading-tight mt-0.5">{ex.description}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {sidebarTab === "snippets" && (
                <div className="space-y-1">
                  {snippets.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-4">No saved snippets yet</p>
                  ) : (
                    snippets.map((s) => (
                      <div key={s.id} className="flex items-start justify-between px-2.5 py-2 rounded-lg hover:bg-slate-50 group">
                        <button onClick={() => loadSnippet(s)} className="text-left flex-1 cursor-pointer">
                          <span className="text-sm font-medium text-slate-700 group-hover:text-primary">{s.name}</span>
                          {s.description && <p className="text-[11px] text-slate-400 leading-tight mt-0.5">{s.description}</p>}
                        </button>
                        <button
                          onClick={() => handleDeleteSnippet(s.id)}
                          className="text-slate-300 hover:text-red-500 cursor-pointer ml-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {sidebarTab === "history" && (
                <div className="space-y-1">
                  {history.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-4">No execution history</p>
                  ) : (
                    history.map((h) => (
                      <button
                        key={h.id}
                        onClick={() => loadHistoryItem(h)}
                        className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${h.success ? "bg-emerald-500" : "bg-red-500"}`} />
                          <span className="text-[11px] text-slate-500">{h.execution_time_ms}ms</span>
                          <span className="text-[10px] text-slate-400">{h.engine}</span>
                        </div>
                        <p className="text-xs text-slate-600 font-mono truncate mt-0.5" style={{ maxWidth: "200px" }}>
                          {h.script.split("---").pop()?.trim().substring(0, 50) || h.script.substring(0, 50)}
                        </p>
                        <p className="text-[10px] text-slate-300 mt-0.5">{new Date(h.executed_at).toLocaleString()}</p>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main editor area */}
        <div className="flex-1 flex gap-4 min-w-0">
          {/* Script + Input (left) */}
          <div className="flex-1 flex flex-col gap-3 min-w-0">
            {/* Script editor */}
            <div className="flex-1 bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-slate-50">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Script</span>
                <div className="flex items-center gap-2">
                  <label className="text-[11px] text-slate-400">Output:</label>
                  <select
                    value={outputMime}
                    onChange={(e) => setOutputMime(e.target.value)}
                    className="text-xs px-2 py-1 rounded border border-slate-200 bg-white text-slate-600 cursor-pointer"
                  >
                    {MIME_TYPES.map((m) => <option key={m} value={m}>{m.replace("application/", "")}</option>)}
                  </select>
                </div>
              </div>
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                className="flex-1 px-4 py-3 font-mono text-sm text-slate-800 resize-none outline-none leading-relaxed"
                spellCheck={false}
                placeholder="%dw 2.0&#10;output application/json&#10;---&#10;payload"
              />
            </div>

            {/* Input panel */}
            <div className="h-48 bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-slate-50">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Input</span>
                <select
                  value={inputMime}
                  onChange={(e) => setInputMime(e.target.value)}
                  className="text-xs px-2 py-1 rounded border border-slate-200 bg-white text-slate-600 cursor-pointer"
                >
                  {MIME_TYPES.map((m) => <option key={m} value={m}>{m.replace("application/", "")}</option>)}
                </select>
              </div>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="flex-1 px-4 py-3 font-mono text-sm text-slate-800 resize-none outline-none leading-relaxed"
                spellCheck={false}
                placeholder='{ "key": "value" }'
              />
            </div>
          </div>

          {/* Output + actions (right) */}
          <div className="w-[380px] shrink-0 flex flex-col gap-3">
            {/* Output panel */}
            <div className="flex-1 bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-slate-50">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Output</span>
                {result && (
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${result.success ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
                      {result.success ? "OK" : "Error"}
                    </span>
                    <span className="text-[10px] text-slate-400">{result.executionTimeMs}ms</span>
                  </div>
                )}
              </div>
              <div className="flex-1 overflow-auto">
                {running ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="w-6 h-6 border-2 border-primary-bg border-t-primary rounded-full animate-spin" />
                  </div>
                ) : result ? (
                  result.success ? (
                    <pre className="px-4 py-3 font-mono text-sm text-slate-800 whitespace-pre-wrap break-all">{result.output}</pre>
                  ) : (
                    <div className="px-4 py-3">
                      <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                        <p className="text-xs font-semibold text-red-700 mb-1">Execution Error</p>
                        <pre className="text-xs text-red-600 font-mono whitespace-pre-wrap break-all">{result.error}</pre>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-300">
                    <div className="text-center">
                      <svg className="w-10 h-10 mx-auto mb-2 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                      </svg>
                      <p className="text-sm">Press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-xs font-mono border border-slate-200">{navigator.platform.includes("Mac") ? "Cmd" : "Ctrl"}+Enter</kbd> to run</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={runScript}
                disabled={running}
                className="flex-1 px-4 py-2.5 bg-primary text-white text-sm rounded-lg font-semibold hover:bg-primary-hover transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {running ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Running...</>
                ) : (
                  <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" /></svg>Run</>
                )}
              </button>
              <button
                onClick={() => { setSaveName(""); setSaveDesc(""); setSaveModalOpen(true); }}
                className="px-4 py-2.5 border border-slate-200 text-sm rounded-lg font-medium text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                Save
              </button>
              {result?.id ? (
                <button
                  onClick={handleShare}
                  className="px-4 py-2.5 border border-slate-200 text-sm rounded-lg font-medium text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors"
                  title="Copy shareable link"
                >
                  Share
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Save Modal */}
      {saveModalOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setSaveModalOpen(false)}>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Save Snippet</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="e.g. Transform contacts to CSV"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-primary focus:ring-2 focus:ring-primary-ring outline-none"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleSave()}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description <span className="text-slate-400 font-normal">(optional)</span></label>
                <input
                  type="text"
                  value={saveDesc}
                  onChange={(e) => setSaveDesc(e.target.value)}
                  placeholder="Brief description of what this does"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-primary focus:ring-2 focus:ring-primary-ring outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setSaveModalOpen(false)} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 cursor-pointer">Cancel</button>
              <button onClick={handleSave} disabled={!saveName.trim()} className="px-5 py-2 bg-primary text-white text-sm rounded-lg font-semibold hover:bg-primary-hover cursor-pointer disabled:opacity-50">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
