import { useState, useEffect } from "react";
import { api } from "../../api/client";
import { Card } from "../../components/Card";

interface Summary { totalRequests: number; errorCount: number; successRate: number; avgResponseTime: number }
interface TimelineEntry { hour: string; total: number; errors: number; avg_time: number }
interface EndpointEntry { endpoint: string; method: string; total_calls: number; avg_time: number; error_count: number }
interface ErrorEntry { id: number; timestamp: string; endpoint: string; method: string; status_code: number; response_time_ms: number }

export function Analytics() {
  const [projects, setProjects] = useState<string[]>([]);
  const [selected, setSelected] = useState("");
  const [hours, setHours] = useState(24);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [endpoints, setEndpoints] = useState<EndpointEntry[]>([]);
  const [errors, setErrors] = useState<ErrorEntry[]>([]);
  const [tab, setTab] = useState<"overview" | "endpoints" | "errors">("overview");

  useEffect(() => { api.get<string[]>("/projects/list").then(setProjects).catch(() => {}); }, []);

  const loadData = async () => {
    const params = new URLSearchParams();
    if (selected) params.set("project", selected);
    params.set("hours", String(hours));
    try {
      const [s, t, ep, er] = await Promise.all([
        api.get<Summary>(`/analytics/summary?${params}`),
        api.get<TimelineEntry[]>(`/analytics/timeline?${params}`),
        api.get<EndpointEntry[]>(`/analytics/endpoints?${new URLSearchParams(selected ? { project: selected } : {})}`),
        api.get<ErrorEntry[]>(`/analytics/errors?${params}`),
      ]);
      setSummary(s); setTimeline(t); setEndpoints(ep); setErrors(er);
    } catch {}
  };

  useEffect(() => { loadData(); }, [selected, hours]);

  const maxTotal = Math.max(...timeline.map((t) => t.total), 1);

  return (
    <Card title="API Analytics">
      <div className="flex gap-3 mb-4 items-center">
        <select value={selected} onChange={(e) => setSelected(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none">
          <option value="">All Projects</option>
          {projects.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={hours} onChange={(e) => setHours(Number(e.target.value))} className="px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none">
          <option value={1}>Last hour</option>
          <option value={6}>Last 6 hours</option>
          <option value={24}>Last 24 hours</option>
          <option value={168}>Last 7 days</option>
        </select>
        <button onClick={loadData} className="px-3 py-2 bg-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-300 cursor-pointer">Refresh</button>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 ml-auto">
          {(["overview", "endpoints", "errors"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-3 py-1 rounded text-xs font-medium cursor-pointer ${tab === t ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-200"}`}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-indigo-50 rounded-lg p-4 text-center"><p className="text-xs text-indigo-500">Total Requests</p><p className="text-2xl font-bold text-indigo-700">{summary.totalRequests}</p></div>
          <div className="bg-green-50 rounded-lg p-4 text-center"><p className="text-xs text-green-500">Success Rate</p><p className="text-2xl font-bold text-green-700">{summary.successRate}%</p></div>
          <div className="bg-blue-50 rounded-lg p-4 text-center"><p className="text-xs text-blue-500">Avg Response</p><p className="text-2xl font-bold text-blue-700">{summary.avgResponseTime}ms</p></div>
          <div className="bg-red-50 rounded-lg p-4 text-center"><p className="text-xs text-red-500">Errors</p><p className="text-2xl font-bold text-red-700">{summary.errorCount}</p></div>
        </div>
      )}

      {tab === "overview" && (
        <div>
          <h3 className="text-sm font-semibold text-slate-600 mb-3">Request Timeline</h3>
          {timeline.length === 0 ? <p className="text-sm text-slate-400">No data yet. Make some API requests to see analytics.</p> : (
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="flex items-end gap-1" style={{ height: "160px" }}>
                {timeline.map((t, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                    <div className="w-full flex flex-col items-center gap-0.5" style={{ height: "140px", justifyContent: "flex-end" }}>
                      {t.errors > 0 && (
                        <div className="w-full bg-red-400 rounded-t" style={{ height: `${Math.max((t.errors / maxTotal) * 140, 2)}px` }} />
                      )}
                      <div className="w-full bg-indigo-500 rounded-t" style={{ height: `${Math.max(((t.total - t.errors) / maxTotal) * 140, 2)}px` }} />
                    </div>
                    <span className="text-[9px] text-slate-400 -rotate-45 origin-top-left whitespace-nowrap">{t.hour.split(" ")[1] || t.hour}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-4 mt-3 justify-center text-xs">
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-indigo-500 rounded" /> Success</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-400 rounded" /> Errors</span>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "endpoints" && (
        <div>
          <h3 className="text-sm font-semibold text-slate-600 mb-3">Endpoint Breakdown</h3>
          {endpoints.length === 0 ? <p className="text-sm text-slate-400">No endpoint data yet.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-200">
                <th className="text-left py-2 px-2 text-slate-500 font-medium">Method</th>
                <th className="text-left py-2 px-2 text-slate-500 font-medium">Endpoint</th>
                <th className="text-left py-2 px-2 text-slate-500 font-medium">Calls</th>
                <th className="text-left py-2 px-2 text-slate-500 font-medium">Avg Time</th>
                <th className="text-left py-2 px-2 text-slate-500 font-medium">Errors</th>
              </tr></thead>
              <tbody>
                {endpoints.map((ep, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td className="py-2 px-2"><span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded font-mono">{ep.method}</span></td>
                    <td className="py-2 px-2 font-mono text-xs">{ep.endpoint}</td>
                    <td className="py-2 px-2">{ep.total_calls}</td>
                    <td className="py-2 px-2 text-slate-500">{Math.round(ep.avg_time)}ms</td>
                    <td className={`py-2 px-2 ${ep.error_count > 0 ? "text-red-600 font-medium" : "text-slate-400"}`}>{ep.error_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "errors" && (
        <div>
          <h3 className="text-sm font-semibold text-slate-600 mb-3">Recent Errors</h3>
          {errors.length === 0 ? <p className="text-sm text-slate-400">No errors recorded.</p> : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {errors.map((e) => (
                <div key={e.id} className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="bg-red-200 text-red-700 text-xs px-2 py-0.5 rounded font-mono font-bold">{e.status_code}</span>
                    <span className="font-mono text-xs text-slate-600">{e.method} {e.endpoint}</span>
                    <span className="text-xs text-slate-400 ml-auto">{e.timestamp}</span>
                    <span className="text-xs text-slate-400">{e.response_time_ms}ms</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
