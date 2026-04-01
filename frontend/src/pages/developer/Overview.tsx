import { useState, useEffect, useCallback } from "react";
import { api } from "../../api/client";

const API_DEFINITIONS = [
  { id: "customer-papi", title: "Customer PAPI", port: 8081 },
  { id: "customer-management-api", title: "Customer Management API", port: 8082 },
  { id: "customer-sf-sapi", title: "Customer SF SAPI", port: 8083 },
  { id: "customer-mock-service", title: "Customer Mock Service", port: 8084 },
] as const;

type ApiId = (typeof API_DEFINITIONS)[number]["id"];

interface ServiceInfo {
  name: string;
  state: string;
  port: string;
  pid: number | null;
  startedAt: string | null;
}

interface CloudHubApp {
  id: string;
  name: string;
  status: string;
  artifact?: { groupId: string; artifactId: string; version: string };
}

interface SalesforceHealthResponse {
  status: "CONNECTED" | "DISCONNECTED" | "NOT_CONFIGURED";
  message?: string;
  instanceUrl?: string;
  username?: string;
  orgId?: string;
}

type DirectHealth = "up" | "down" | "unknown";

interface ApiCardState {
  direct: DirectHealth;
  runtimeLine: string | null;
}

interface AnalyticsSummary {
  totalRequests: number;
  errorCount: number;
  successRate: number;
  avgResponseTime: number;
}

interface LogEntry {
  timestamp: string;
  level: string;
  logger: string;
  message: string;
  source: "mule" | "wiremock";
}

interface LogStats {
  total: number;
  error: number;
  warn: number;
  info: number;
  debug: number;
  lastError: string | null;
}

function statusDotClass(kind: "up" | "down" | "unknown"): string {
  if (kind === "up") return "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.25)]";
  if (kind === "down") return "bg-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.2)]";
  return "bg-amber-400 shadow-[0_0_0_3px_rgba(251,191,36,0.25)]";
}

function overallCardStatus(direct: DirectHealth, runtimeRunning: boolean): "up" | "down" | "unknown" {
  if (direct === "up") return "up";
  if (direct === "down") return "down";
  if (runtimeRunning) return "unknown";
  return "unknown";
}

async function probeDirectHealth(port: number): Promise<DirectHealth> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, {
      method: "GET",
      signal: AbortSignal.timeout(4500),
    });
    if (res.ok) return "up";
    return "down";
  } catch {
    return "unknown";
  }
}

function runtimeForPort(services: ServiceInfo[], port: number): ServiceInfo | undefined {
  return services.find((s) => s.port === String(port));
}

function appMatchesApi(app: CloudHubApp, apiId: string): boolean {
  const aid = app.artifact?.artifactId?.toLowerCase();
  if (aid === apiId.toLowerCase()) return true;
  const compact = (app.name || "").toLowerCase().replace(/\s+/g, "-");
  return compact.includes(apiId.toLowerCase());
}

function isDeployedOnCloudHub(apps: CloudHubApp[], apiId: string): boolean {
  return apps.some((a) => appMatchesApi(a, apiId));
}

function localDeploymentHint(
  direct: DirectHealth,
  port: number,
  services: ServiceInfo[]
): boolean {
  if (direct === "up") return true;
  const rt = runtimeForPort(services, port);
  return rt?.state === "running";
}

function orgDisplayName(sf: SalesforceHealthResponse): string {
  if (sf.status === "NOT_CONFIGURED") return sf.message || "Not configured";
  if (sf.instanceUrl) {
    try {
      const host = new URL(sf.instanceUrl).hostname;
      return host || sf.username || "Salesforce org";
    } catch {
      return sf.username || sf.instanceUrl;
    }
  }
  return sf.username || "Salesforce org";
}

function buildApiStates(
  services: ServiceInfo[],
  healthByPort: Record<number, DirectHealth>
): Record<ApiId, ApiCardState> {
  const next = {} as Record<ApiId, ApiCardState>;
  for (const def of API_DEFINITIONS) {
    const rt = runtimeForPort(services, def.port);
    next[def.id] = {
      direct: healthByPort[def.port] ?? "unknown",
      runtimeLine: rt ? `${rt.name}: ${rt.state} (port ${rt.port})` : null,
    };
  }
  return next;
}


export function Overview() {
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [runtimeServices, setRuntimeServices] = useState<ServiceInfo[]>([]);
  const [runtimeError, setRuntimeError] = useState("");

  const [apiStates, setApiStates] = useState<Record<ApiId, ApiCardState> | null>(null);

  const [salesforce, setSalesforce] = useState<SalesforceHealthResponse | null>(null);
  const [salesforceError, setSalesforceError] = useState("");

  const [cloudApps, setCloudApps] = useState<CloudHubApp[]>([]);
  const [cloudError, setCloudError] = useState("");

  const [analyticsSummary, setAnalyticsSummary] = useState<AnalyticsSummary | null>(null);
  const [logStats, setLogStats] = useState<LogStats | null>(null);
  const [recentLogs, setRecentLogs] = useState<LogEntry[]>([]);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setPageError("");
    setRuntimeError("");
    setSalesforceError("");
    setCloudError("");

    let services: ServiceInfo[] = [];

    try {
      const [runtimeResult, cloudResult, sfResult, analyticsResult, logStatsResult, recentLogsResult, ...healthOutcomes] = await Promise.allSettled([
        api.get<ServiceInfo[]>("/runtime/status"),
        api.get<CloudHubApp[]>("/anypoint/applications"),
        api.get<SalesforceHealthResponse>("/salesforce/health"),
        api.get<AnalyticsSummary>("/analytics/summary?hours=24"),
        api.get<LogStats>("/logs/stats"),
        api.get<LogEntry[]>("/logs?limit=10&level=ERROR,WARN"),
        ...API_DEFINITIONS.map((d) => probeDirectHealth(d.port)),
      ]);

      if (runtimeResult.status === "fulfilled") {
        services = runtimeResult.value;
        setRuntimeServices(services);
      } else {
        setRuntimeError(
          runtimeResult.reason instanceof Error
            ? runtimeResult.reason.message
            : "Runtime status unavailable"
        );
        setRuntimeServices([]);
      }

      if (cloudResult.status === "fulfilled") {
        setCloudApps(cloudResult.value);
      } else {
        setCloudApps([]);
        setCloudError(
          cloudResult.reason instanceof Error
            ? cloudResult.reason.message
            : "CloudHub applications unavailable"
        );
      }

      if (sfResult.status === "fulfilled") {
        setSalesforce(sfResult.value);
      } else {
        setSalesforce(null);
        setSalesforceError(
          sfResult.reason instanceof Error
            ? sfResult.reason.message
            : "Salesforce health unavailable"
        );
      }

      if (analyticsResult.status === "fulfilled") {
        setAnalyticsSummary(analyticsResult.value);
      } else {
        setAnalyticsSummary(null);
      }

      if (logStatsResult.status === "fulfilled") {
        setLogStats(logStatsResult.value);
      } else {
        setLogStats(null);
      }

      if (recentLogsResult.status === "fulfilled") {
        setRecentLogs(recentLogsResult.value);
      } else {
        setRecentLogs([]);
      }

      const healthByPort: Record<number, DirectHealth> = {};
      API_DEFINITIONS.forEach((def, i) => {
        const outcome = healthOutcomes[i];
        healthByPort[def.port] =
          outcome.status === "fulfilled" ? outcome.value : "unknown";
      });

      setApiStates(buildApiStates(services, healthByPort));
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Failed to load overview");
      setApiStates(buildApiStates(services, {}));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const sfDot: "up" | "down" | "unknown" = salesforceError
    ? "unknown"
    : !salesforce
      ? "unknown"
      : salesforce.status === "CONNECTED"
        ? "up"
        : salesforce.status === "NOT_CONFIGURED"
          ? "unknown"
          : "down";

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-50 to-indigo-50/40 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-10">
        <header className="flex flex-col gap-4 border-b border-indigo-100/80 pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
              Orca Community · Developer
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Overview
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              At-a-glance health for Customer APIs, Salesforce, CloudHub deployments, and workstation runtime.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadOverview()}
            disabled={loading}
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-md transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </header>

        {pageError && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-sm"
          >
            {pageError}
          </div>
        )}

        {!apiStates && loading ? (
          <div className="rounded-xl border border-slate-200 bg-white/80 px-6 py-12 text-center text-slate-500 shadow-md">
            Loading dashboard…
          </div>
        ) : null}

        {apiStates ? (
          <>
        <section aria-labelledby="api-health-heading">
          <div className="mb-4 flex items-center gap-2">
            <h2 id="api-health-heading" className="text-lg font-semibold text-slate-900">
              API health
            </h2>
            {runtimeError ? (
              <span className="text-xs text-amber-700">Runtime status partial</span>
            ) : null}
          </div>
          {runtimeError ? (
            <p className="mb-4 text-xs text-amber-800">{runtimeError}</p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {API_DEFINITIONS.map((def) => {
              const state = apiStates?.[def.id];
              const direct = state?.direct ?? "unknown";
              const rt = runtimeForPort(runtimeServices, def.port);
              const runtimeRunning = rt?.state === "running";
              const overall = overallCardStatus(direct, runtimeRunning);

              return (
                <article
                  key={def.id}
                  className="flex flex-col rounded-xl border border-slate-200/90 bg-white p-5 shadow-md shadow-slate-200/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{def.title}</h3>
                      <p className="mt-0.5 font-mono text-xs text-slate-500">
                        {def.id}:{def.port}
                      </p>
                    </div>
                    <span
                      className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${statusDotClass(overall)}`}
                      title={
                        overall === "up"
                          ? "UP"
                          : overall === "down"
                            ? "DOWN"
                            : "Unknown / not verified"
                      }
                      aria-hidden
                    />
                  </div>
                  <dl className="mt-4 space-y-2 text-xs text-slate-600">
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">Direct /api/health</dt>
                      <dd className="flex items-center gap-1.5 font-medium text-slate-800">
                        <span
                          className={`h-2 w-2 rounded-full ${statusDotClass(
                            direct === "up" ? "up" : direct === "down" ? "down" : "unknown"
                          )}`}
                        />
                        {direct === "up" ? "UP" : direct === "down" ? "DOWN" : "Unknown"}
                      </dd>
                    </div>
                    <div className="border-t border-slate-100 pt-2">
                      <dt className="text-slate-500">Runtime (dashboard)</dt>
                      <dd className="mt-0.5 text-slate-700">
                        {state?.runtimeLine ?? "No process mapped to this port"}
                      </dd>
                    </div>
                  </dl>
                  {direct === "unknown" ? (
                    <p className="mt-3 text-[11px] leading-snug text-slate-400">
                      If this stays unknown, the browser may be blocked from localhost ports (CORS) or the API is
                      stopped.
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>

        <section
          aria-labelledby="sf-heading"
          className="rounded-xl border border-slate-200/90 bg-white p-6 shadow-md shadow-slate-200/50"
        >
          <h2 id="sf-heading" className="text-lg font-semibold text-slate-900">
            Salesforce connection
          </h2>
          {salesforceError ? (
            <p className="mt-2 text-sm text-amber-800">{salesforceError}</p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${statusDotClass(sfDot)}`} aria-hidden />
              <span className="text-sm font-medium text-slate-800">
                {!salesforce && !salesforceError
                  ? "Loading…"
                  : salesforce?.status === "CONNECTED"
                    ? "Connected"
                    : salesforce?.status === "NOT_CONFIGURED"
                      ? "Not configured"
                      : "Disconnected"}
              </span>
            </div>
            {salesforce ? (
              <div className="text-sm text-slate-600">
                <span className="text-slate-500">Org / instance: </span>
                <span className="font-medium text-indigo-950">{orgDisplayName(salesforce)}</span>
                {salesforce.username ? (
                  <span className="ml-2 text-slate-500">({salesforce.username})</span>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        <section aria-labelledby="deploy-heading">
          <h2 id="deploy-heading" className="mb-4 text-lg font-semibold text-slate-900">
            Deployment summary
          </h2>
          {cloudError ? (
            <p className="mb-4 text-sm text-amber-800">{cloudError}</p>
          ) : null}
          <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-md shadow-slate-200/50">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-indigo-50/80 text-xs font-semibold uppercase tracking-wide text-indigo-900">
                <tr>
                  <th className="px-5 py-3">API</th>
                  <th className="px-5 py-3">Local</th>
                  <th className="px-5 py-3">CloudHub 2.0</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {API_DEFINITIONS.map((def) => {
                  const st = apiStates?.[def.id];
                  const localOn = localDeploymentHint(st?.direct ?? "unknown", def.port, runtimeServices);
                  const cloudOn = isDeployedOnCloudHub(cloudApps, def.id);
                  return (
                    <tr key={def.id} className="bg-white hover:bg-slate-50/80">
                      <td className="px-5 py-3 font-medium text-slate-900">{def.title}</td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-2">
                          <span
                            className={`h-2 w-2 rounded-full ${statusDotClass(localOn ? "up" : "down")}`}
                          />
                          {localOn ? "Reachable / runtime" : "Not detected"}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {cloudError ? (
                          <span className="inline-flex items-center gap-2 text-slate-600">
                            <span className={`h-2 w-2 rounded-full ${statusDotClass("unknown")}`} />
                            Could not load CloudHub data
                          </span>
                        ) : cloudApps.length === 0 ? (
                          <span className="text-slate-500">—</span>
                        ) : (
                          <span className="inline-flex items-center gap-2">
                            <span
                              className={`h-2 w-2 rounded-full ${statusDotClass(cloudOn ? "up" : "down")}`}
                            />
                            {cloudOn ? "Listed in Anypoint" : "Not listed"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="metrics-heading">
          <h2 id="metrics-heading" className="mb-4 text-lg font-semibold text-slate-900">
            API Metrics (last 24h)
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-md shadow-slate-200/50">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total Requests</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{analyticsSummary?.totalRequests ?? 0}</p>
            </div>
            <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-md shadow-slate-200/50">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Success Rate</p>
              <p className="mt-1 text-2xl font-bold text-emerald-600">{analyticsSummary ? `${analyticsSummary.successRate.toFixed(1)}%` : "—"}</p>
            </div>
            <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-md shadow-slate-200/50">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Errors</p>
              <p className="mt-1 text-2xl font-bold text-red-600">{analyticsSummary?.errorCount ?? 0}</p>
            </div>
            <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-md shadow-slate-200/50">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Avg Response Time</p>
              <p className="mt-1 text-2xl font-bold text-indigo-600">{analyticsSummary ? `${analyticsSummary.avgResponseTime.toFixed(0)}ms` : "—"}</p>
            </div>
          </div>
        </section>

        <section aria-labelledby="log-heading">
          <h2 id="log-heading" className="mb-4 text-lg font-semibold text-slate-900">
            Runtime Log Summary
          </h2>
          <div className="rounded-xl border border-slate-200/90 bg-white p-6 shadow-md shadow-slate-200/50">
            {logStats ? (
              <div className="grid gap-4 sm:grid-cols-5 mb-6">
                <div className="text-center">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">{logStats.total}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs font-medium uppercase tracking-wider text-red-500">Errors</p>
                  <p className="mt-1 text-xl font-bold text-red-600">{logStats.error}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs font-medium uppercase tracking-wider text-amber-500">Warnings</p>
                  <p className="mt-1 text-xl font-bold text-amber-600">{logStats.warn}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs font-medium uppercase tracking-wider text-emerald-500">Info</p>
                  <p className="mt-1 text-xl font-bold text-emerald-600">{logStats.info}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs font-medium uppercase tracking-wider text-blue-500">Debug</p>
                  <p className="mt-1 text-xl font-bold text-blue-600">{logStats.debug}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Log statistics unavailable. Start Mule Runtime to see log data.</p>
            )}

            {recentLogs.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Recent Errors &amp; Warnings</h3>
                <div className="bg-slate-900 rounded-lg p-4 max-h-48 overflow-y-auto space-y-1">
                  {recentLogs.map((entry, i) => (
                    <p key={i} className={`font-mono text-xs ${entry.level === "ERROR" ? "text-red-400" : "text-amber-400"}`}>
                      <span className="text-slate-500">{entry.timestamp}</span>{" "}
                      <span className="font-semibold">[{entry.level}]</span>{" "}
                      {entry.message.slice(0, 200)}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {recentLogs.length === 0 && logStats && (
              <p className="text-sm text-emerald-600">No recent errors or warnings detected.</p>
            )}
          </div>
        </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
