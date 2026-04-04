import { useState, useEffect, useRef, useMemo } from "react";
import { api } from "../../api/client";
import { Card } from "../../components/Card";

type SubTab = "logs" | "metrics" | "audit";
type LogLevelFilter = "ALL" | "INFO" | "WARN" | "ERROR";

interface NormalizedLogLine {
  id: string;
  timestamp: string;
  level: string;
  text: string;
}

interface NormalizedMetrics {
  totalRequests: number;
  avgResponseTime: number;
  errorRate: number;
  activeApis: number;
  requestCountsByApi: Array<{ name: string; count: number }>;
}

const LEVEL_TEXT: Record<string, string> = {
  INFO: "text-blue-400",
  WARN: "text-yellow-400",
  ERROR: "text-red-400",
  DEBUG: "text-slate-400",
};

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function extractLogsArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.lines)) return o.lines;
    if (Array.isArray(o.logs)) return o.logs;
    if (Array.isArray(o.entries)) return o.entries;
  }
  return [];
}

function parseLevelFromText(line: string): string {
  const m = line.match(/\b(INFO|WARN|ERROR|DEBUG)\b/i);
  return m ? m[1].toUpperCase() : "INFO";
}

function normalizeLogEntry(raw: unknown, index: number): NormalizedLogLine {
  const id = `log-${index}`;
  if (typeof raw === "string") {
    const tsMatch = raw.match(/^\[?([\d-T:.\sZ]+)\]?\s+/);
    let body = raw;
    let timestamp = "";
    if (tsMatch) {
      timestamp = tsMatch[1].trim();
      body = raw.slice(tsMatch[0].length);
    }
    const level = parseLevelFromText(body);
    return { id, timestamp, level, text: body };
  }
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const message = String(o.message ?? o.msg ?? o.text ?? o.line ?? "");
    const level = String(o.level ?? (message ? parseLevelFromText(message) : "INFO")).toUpperCase();
    const timestamp = String(o.timestamp ?? o.time ?? o.ts ?? "");
    const text =
      message ||
      [timestamp, level, o.logger, o.source].filter(Boolean).join(" ") ||
      JSON.stringify(o);
    return { id: String(o.id ?? id), timestamp, level, text };
  }
  return { id, timestamp: "", level: "INFO", text: String(raw) };
}

function normalizeLogsResponse(data: unknown): NormalizedLogLine[] {
  return extractLogsArray(data).map((item, i) => normalizeLogEntry(item, i));
}

function normalizeMetricsPayload(data: unknown): NormalizedMetrics {
  const empty: NormalizedMetrics = {
    totalRequests: 0,
    avgResponseTime: 0,
    errorRate: 0,
    activeApis: 0,
    requestCountsByApi: [],
  };
  if (!data || typeof data !== "object") return empty;
  const o = data as Record<string, unknown>;

  let requestCountsByApi: Array<{ name: string; count: number }> = [];
  const byApi = o.requestCountsByApi ?? o.byApi ?? o.requestsByApi ?? o.perApi;
  if (Array.isArray(byApi)) {
    requestCountsByApi = byApi.map((row) => {
      if (row && typeof row === "object") {
        const r = row as Record<string, unknown>;
        const name = String(r.api ?? r.name ?? r.apiName ?? r.endpoint ?? "API");
        const count = num(r.count ?? r.requests ?? r.total ?? r.calls);
        return { name, count };
      }
      return { name: "API", count: 0 };
    });
  }

  return {
    totalRequests: num(o.totalRequests ?? o.total_requests),
    avgResponseTime: num(o.avgResponseTime ?? o.avg_response_time_ms ?? o.avgResponseTimeMs),
    errorRate: num(o.errorRate ?? o.error_rate_percent ?? o.errorRatePercent),
    activeApis: num(o.activeApis ?? o.active_apis),
    requestCountsByApi,
  };
}

export function Monitoring() {
  const [subTab, setSubTab] = useState<SubTab>("logs");

  const [logs, setLogs] = useState<NormalizedLogLine[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [logLevel, setLogLevel] = useState<LogLevelFilter>("ALL");
  const [logSearch, setLogSearch] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const stickBottomRef = useRef(true);

  const [metrics, setMetrics] = useState<NormalizedMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  const filteredLogs = useMemo(() => {
    const q = logSearch.trim().toLowerCase();
    return logs.filter((line) => {
      if (logLevel !== "ALL" && line.level !== logLevel) return false;
      if (!q) return true;
      return line.text.toLowerCase().includes(q);
    });
  }, [logs, logLevel, logSearch]);

  const maxApiCount = useMemo(
    () => Math.max(1, ...((metrics?.requestCountsByApi ?? []).map((x) => x.count))),
    [metrics]
  );

  useEffect(() => {
    if (subTab !== "logs") return;

    let cancelled = false;

    const fetchLogs = async (silent: boolean) => {
      if (!silent) {
        setLogsLoading(true);
        setLogsError(null);
      }
      try {
        const data = await api.get<unknown>("/logs/recent?lines=200");
        if (cancelled) return;
        setLogs(normalizeLogsResponse(data));
        setLogsError(null);
      } catch (e) {
        if (cancelled) return;
        setLogsError(e instanceof Error ? e.message : "Failed to load logs");
      } finally {
        if (!cancelled && !silent) setLogsLoading(false);
      }
    };

    void fetchLogs(false);

    if (!autoRefresh) {
      return () => {
        cancelled = true;
      };
    }

    const interval = window.setInterval(() => void fetchLogs(true), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [subTab, autoRefresh]);

  useEffect(() => {
    if (subTab !== "metrics") return;

    let cancelled = false;
    setMetricsLoading(true);
    setMetricsError(null);

    void (async () => {
      try {
        const data = await api.get<unknown>("/analytics/metrics");
        if (cancelled) return;
        setMetrics(normalizeMetricsPayload(data));
      } catch (e) {
        if (cancelled) return;
        setMetricsError(e instanceof Error ? e.message : "Failed to load metrics");
        setMetrics(null);
      } finally {
        if (!cancelled) setMetricsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [subTab]);

  const onLogScroll = () => {
    const el = logContainerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    stickBottomRef.current = nearBottom;
  };

  useEffect(() => {
    if (!autoRefresh || !stickBottomRef.current) return;
    const el = logContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [filteredLogs, autoRefresh]);

  const refreshLogs = () => {
    setLogsLoading(true);
    setLogsError(null);
    void (async () => {
      try {
        const data = await api.get<unknown>("/logs/recent?lines=200");
        setLogs(normalizeLogsResponse(data));
      } catch (e) {
        setLogsError(e instanceof Error ? e.message : "Failed to load logs");
      } finally {
        setLogsLoading(false);
      }
    })();
  };

  const subTabBtn = (tab: SubTab, label: string) => (
    <button
      type="button"
      onClick={() => setSubTab(tab)}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
        subTab === tab
          ? "bg-primary text-white shadow-sm"
          : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {label}
    </button>
  );

  return (
    <Card
      title="Monitoring"
      action={
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {subTabBtn("logs", "Logs")}
          {subTabBtn("metrics", "Metrics")}
          {subTabBtn("audit", "Audit")}
        </div>
      }
    >
      {subTab === "logs" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-slate-300 text-primary focus:ring-primary"
              />
              Auto-refresh (3s)
            </label>
            <button
              type="button"
              onClick={refreshLogs}
              disabled={logsLoading}
              className="px-3 py-1.5 text-sm rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 disabled:opacity-50 cursor-pointer"
            >
              Refresh
            </button>
            <select
              value={logLevel}
              onChange={(e) => setLogLevel(e.target.value as LogLevelFilter)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm text-slate-800 bg-white outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="ALL">ALL</option>
              <option value="INFO">INFO</option>
              <option value="WARN">WARN</option>
              <option value="ERROR">ERROR</option>
            </select>
            <input
              type="search"
              value={logSearch}
              onChange={(e) => setLogSearch(e.target.value)}
              placeholder="Search logs…"
              className="flex-1 min-w-[160px] px-3 py-1.5 rounded-lg border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {logsError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {logsError}
            </div>
          )}

          {logsLoading && logs.length === 0 ? (
            <p className="text-sm text-slate-500">Loading logs…</p>
          ) : (
            <div
              ref={logContainerRef}
              onScroll={onLogScroll}
              className="bg-slate-900 rounded-lg p-4 font-mono text-xs text-slate-200 overflow-auto max-h-[min(520px,70vh)] min-h-[280px] border border-slate-700"
            >
              {filteredLogs.length === 0 ? (
                <p className="text-slate-500">
                  {logs.length === 0 ? "No log lines returned." : "No lines match your filters."}
                </p>
              ) : (
                <ul className="space-y-1">
                  {filteredLogs.map((line) => (
                    <li key={line.id} className="break-all whitespace-pre-wrap leading-relaxed">
                      {line.timestamp && (
                        <span className="text-slate-500 mr-2">{line.timestamp}</span>
                      )}
                      <span
                        className={`font-semibold mr-2 ${LEVEL_TEXT[line.level] ?? "text-slate-300"}`}
                      >
                        [{line.level}]
                      </span>
                      <span className="text-slate-200">{line.text}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {subTab === "metrics" && (
        <div className="space-y-6">
          {metricsError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {metricsError}
            </div>
          )}
          {metricsLoading && !metrics ? (
            <p className="text-sm text-slate-500">Loading metrics…</p>
          ) : metrics ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-primary-bg-subtle to-white p-4">
                  <p className="text-xs font-medium text-primary uppercase tracking-wide">
                    Total Requests
                  </p>
                  <p className="mt-2 text-2xl font-bold text-slate-800">{metrics.totalRequests}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Avg Response Time
                  </p>
                  <p className="mt-2 text-2xl font-bold text-slate-800">
                    {metrics.avgResponseTime.toFixed(1)}
                    <span className="text-sm font-normal text-slate-500 ml-1">ms</span>
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-amber-50/80 to-white p-4">
                  <p className="text-xs font-medium text-amber-700 uppercase tracking-wide">
                    Error Rate
                  </p>
                  <p className="mt-2 text-2xl font-bold text-slate-800">
                    {metrics.errorRate.toFixed(2)}
                    <span className="text-sm font-normal text-slate-500 ml-1">%</span>
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-primary-bg-subtle/50 to-white p-4">
                  <p className="text-xs font-medium text-primary uppercase tracking-wide">
                    Active APIs
                  </p>
                  <p className="mt-2 text-2xl font-bold text-slate-800">{metrics.activeApis}</p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Requests by API</h3>
                {metrics.requestCountsByApi.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No per-API breakdown in the response yet.
                  </p>
                ) : (
                  <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                    {metrics.requestCountsByApi.map((row) => (
                      <div key={row.name} className="flex items-center gap-3">
                        <span
                          className="text-xs font-mono text-slate-600 w-[40%] sm:w-1/3 truncate shrink-0"
                          title={row.name}
                        >
                          {row.name}
                        </span>
                        <div className="flex-1 h-7 bg-slate-200 rounded-md overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-md transition-[width] duration-300"
                            style={{ width: `${(row.count / maxApiCount) * 100}%` }}
                            title={`${row.count} requests`}
                          />
                        </div>
                        <span className="text-xs tabular-nums text-slate-600 w-12 text-right shrink-0">
                          {row.count}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            !metricsError && <p className="text-sm text-slate-500">No metrics data.</p>
          )}
        </div>
      )}

      {subTab === "audit" && (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-semibold text-slate-800">Audit Trail</h3>
            <p className="mt-2 text-sm text-slate-600 max-w-2xl">
              Audit events from the Process API will appear here once sync operations are performed.
            </p>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-slate-100 text-slate-600 border-b border-slate-200">
                  <th className="px-4 py-3 font-medium">Timestamp</th>
                  <th className="px-4 py-3 font-medium">Operation</th>
                  <th className="px-4 py-3 font-medium">Entity</th>
                  <th className="px-4 py-3 font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100">
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400 italic">
                    No audit events yet.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}
