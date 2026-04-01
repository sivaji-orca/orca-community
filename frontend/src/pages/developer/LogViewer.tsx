import { useState, useEffect, useRef } from "react";
import { api } from "../../api/client";
import { Card } from "../../components/Card";

interface LogEntry { timestamp: string; level: string; logger: string; message: string; source: "mule" | "wiremock" }
interface LogStats { total: number; error: number; warn: number; info: number; debug: number; lastError: string | null }

const LEVEL_COLORS: Record<string, string> = { ERROR: "text-red-400", WARN: "text-amber-400", INFO: "text-green-400", DEBUG: "text-blue-400" };
const LEVEL_BG: Record<string, string> = { ERROR: "bg-red-900/30", WARN: "bg-amber-900/20", INFO: "", DEBUG: "bg-blue-900/10" };

export function LogViewer() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [source, setSource] = useState("");
  const [level, setLevel] = useState("");
  const [search, setSearch] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const loadLogs = async () => {
    const params = new URLSearchParams();
    if (source) params.set("source", source);
    if (level) params.set("level", level);
    if (search) params.set("search", search);
    params.set("limit", "500");
    try {
      const [logs, s] = await Promise.all([api.get<LogEntry[]>(`/logs?${params}`), api.get<LogStats>("/logs/stats")]);
      setEntries(logs); setStats(s);
    } catch {}
  };

  useEffect(() => { loadLogs(); }, [source, level, search]);

  const toggleStream = () => {
    if (streaming && eventSourceRef.current) {
      eventSourceRef.current.close(); eventSourceRef.current = null; setStreaming(false); return;
    }
    const token = localStorage.getItem("orca_token");
    const es = new EventSource(`/api/logs/stream?token=${token}`);
    es.onmessage = (e) => {
      try {
        const entry: LogEntry = JSON.parse(e.data);
        if (source && entry.source !== source) return;
        if (level && entry.level !== level) return;
        setEntries((prev) => [...prev.slice(-999), entry]);
      } catch {}
    };
    es.onerror = () => { es.close(); setStreaming(false); };
    eventSourceRef.current = es;
    setStreaming(true);
  };

  useEffect(() => {
    if (autoScroll && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [entries, autoScroll]);

  useEffect(() => { return () => { eventSourceRef.current?.close(); }; }, []);

  return (
    <Card title="Log Viewer">
      {stats && (
        <div className="flex gap-3 mb-4">
          <div className="bg-slate-800 rounded-lg px-4 py-2 text-center"><p className="text-xs text-slate-400">Total (1h)</p><p className="text-lg text-white font-bold">{stats.total}</p></div>
          <div className="bg-red-900/30 rounded-lg px-4 py-2 text-center"><p className="text-xs text-red-400">Errors</p><p className="text-lg text-red-400 font-bold">{stats.error}</p></div>
          <div className="bg-amber-900/20 rounded-lg px-4 py-2 text-center"><p className="text-xs text-amber-400">Warnings</p><p className="text-lg text-amber-400 font-bold">{stats.warn}</p></div>
          <div className="bg-green-900/20 rounded-lg px-4 py-2 text-center"><p className="text-xs text-green-400">Info</p><p className="text-lg text-green-400 font-bold">{stats.info}</p></div>
          {stats.lastError && <div className="bg-slate-800 rounded-lg px-4 py-2"><p className="text-xs text-slate-400">Last Error</p><p className="text-xs text-red-400 font-mono mt-1">{stats.lastError}</p></div>}
        </div>
      )}

      <div className="flex gap-2 mb-4 items-center">
        <select value={source} onChange={(e) => setSource(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none">
          <option value="">All Sources</option>
          <option value="mule">Mule Runtime</option>
          <option value="wiremock">WireMock</option>
        </select>
        <div className="flex gap-1">
          {["", "ERROR", "WARN", "INFO", "DEBUG"].map((l) => (
            <button key={l} onClick={() => setLevel(l)}
              className={`px-2 py-1 text-xs rounded cursor-pointer ${level === l ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              {l || "ALL"}
            </button>
          ))}
        </div>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search logs..."
          className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none" />
        <button onClick={toggleStream} className={`px-3 py-2 text-sm rounded-lg font-medium cursor-pointer ${streaming ? "bg-red-600 text-white" : "bg-green-600 text-white hover:bg-green-700"}`}>
          {streaming ? "Stop Stream" : "Live Stream"}
        </button>
        <label className="flex items-center gap-1 text-xs text-slate-500">
          <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} /> Auto-scroll
        </label>
        <button onClick={loadLogs} className="px-3 py-2 bg-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-300 cursor-pointer">Refresh</button>
      </div>

      <div ref={logRef} className="bg-slate-900 rounded-lg p-4 font-mono text-xs overflow-auto max-h-[500px] min-h-[300px]">
        {entries.length === 0 ? <p className="text-slate-500">No log entries. Start the Mule runtime to see logs here.</p> : (
          <table className="w-full">
            <tbody>
              {entries.map((e, i) => (
                <tr key={i} className={`${LEVEL_BG[e.level] || ""} hover:bg-slate-800/50`}>
                  <td className="text-slate-500 py-0.5 pr-3 whitespace-nowrap align-top">{e.timestamp}</td>
                  <td className={`${LEVEL_COLORS[e.level] || "text-slate-400"} py-0.5 pr-3 whitespace-nowrap font-bold align-top w-14`}>{e.level}</td>
                  <td className="text-slate-400 py-0.5 whitespace-pre-wrap break-all">{e.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}
