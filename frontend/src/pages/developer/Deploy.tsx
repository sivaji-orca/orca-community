import { useState, useEffect, useCallback } from "react";
import { api } from "../../api/client";

/** Service rows from GET /runtime/status */
interface RuntimeServiceStatus {
  name: string;
  state: string;
  port: string;
  pid: number | null;
  startedAt: string | null;
}

/** Deployed app rows from GET /runtime/apps */
interface LocalDeployedApp {
  name: string;
  status: string;
  version?: string;
}

interface RuntimeActionResponse {
  message: string;
  details: string[];
}

/** CloudHub application from GET /anypoint/applications */
interface CloudHubApplication {
  id: string;
  name: string;
  status: string;
  target?: string;
  muleVersion?: string;
  publicUrl?: string;
  replicas?: number;
  vCores?: number;
  artifact?: { groupId: string; artifactId: string; version: string };
  lastModified?: number;
  environmentName?: string;
}

/** Anypoint environment from GET /anypoint/environments */
interface AnypointEnvironment {
  id: string;
  name: string;
  type: string;
  isProduction: boolean;
  organizationId?: string;
}

type DeploySection = "local" | "cloudhub" | "environments";

function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-600">
      <span
        className="inline-block size-5 shrink-0 rounded-full border-2 border-primary border-t-transparent animate-spin"
        aria-hidden
      />
      {label ? <span>{label}</span> : null}
    </div>
  );
}

function cloudHubStatusBadgeClass(status: string): string {
  const s = status.toUpperCase();
  if (s === "RUNNING") return "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200";
  if (s === "STARTED" || s === "STARTING") return "bg-amber-100 text-amber-800 ring-1 ring-amber-200";
  if (s === "FAILED" || s === "STOPPED") return "bg-red-100 text-red-800 ring-1 ring-red-200";
  return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
}

const SECTIONS: { id: DeploySection; label: string }[] = [
  { id: "local", label: "Local runtime" },
  { id: "cloudhub", label: "CloudHub" },
  { id: "environments", label: "Environments" },
];

export function Deploy() {
  const [activeSection, setActiveSection] = useState<DeploySection>("local");

  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeServiceStatus[] | null>(null);
  const [localApps, setLocalApps] = useState<LocalDeployedApp[] | null>(null);
  const [localLoading, setLocalLoading] = useState(true);
  const [localError, setLocalError] = useState("");
  const [localAppsError, setLocalAppsError] = useState("");
  const [localActionLoading, setLocalActionLoading] = useState(false);
  const [localMessage, setLocalMessage] = useState("");

  const [cloudApps, setCloudApps] = useState<CloudHubApplication[] | null>(null);
  const [cloudLoading, setCloudLoading] = useState(true);
  const [cloudError, setCloudError] = useState("");

  const [envs, setEnvs] = useState<AnypointEnvironment[] | null>(null);
  const [envLoading, setEnvLoading] = useState(true);
  const [envError, setEnvError] = useState("");

  const fetchLocal = useCallback(async () => {
    setLocalLoading(true);
    setLocalError("");
    setLocalAppsError("");
    const results = await Promise.allSettled([
      api.get<RuntimeServiceStatus[]>("/runtime/status"),
      api.get<LocalDeployedApp[]>("/runtime/apps"),
    ]);

    const statusResult = results[0];
    const appsResult = results[1];

    if (statusResult.status === "fulfilled") {
      setRuntimeStatus(statusResult.value);
    } else {
      setRuntimeStatus(null);
      setLocalError(
        statusResult.reason instanceof Error
          ? statusResult.reason.message
          : "Failed to load runtime status"
      );
    }

    if (appsResult.status === "fulfilled") {
      setLocalApps(appsResult.value);
    } else {
      setLocalApps(null);
      setLocalAppsError(
        appsResult.reason instanceof Error
          ? appsResult.reason.message
          : "Failed to load deployed apps"
      );
    }

    setLocalLoading(false);
  }, []);

  const fetchCloud = useCallback(async () => {
    setCloudLoading(true);
    setCloudError("");
    try {
      const data = await api.get<CloudHubApplication[]>("/anypoint/applications");
      setCloudApps(data);
    } catch (err: unknown) {
      setCloudError(err instanceof Error ? err.message : "Failed to load CloudHub applications");
      setCloudApps(null);
    } finally {
      setCloudLoading(false);
    }
  }, []);

  const fetchEnvironments = useCallback(async () => {
    setEnvLoading(true);
    setEnvError("");
    try {
      const data = await api.get<AnypointEnvironment[]>("/anypoint/environments");
      setEnvs(data);
    } catch (err: unknown) {
      setEnvError(err instanceof Error ? err.message : "Failed to load environments");
      setEnvs(null);
    } finally {
      setEnvLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLocal();
  }, [fetchLocal]);

  useEffect(() => {
    void fetchCloud();
  }, [fetchCloud]);

  useEffect(() => {
    void fetchEnvironments();
  }, [fetchEnvironments]);

  const handleStartRuntime = async () => {
    setLocalActionLoading(true);
    setLocalMessage("");
    setLocalError("");
    try {
      const data = await api.post<RuntimeActionResponse>("/runtime/start");
      setLocalMessage(data.details.join(" · "));
      await fetchLocal();
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : "Start failed");
    } finally {
      setLocalActionLoading(false);
    }
  };

  const handleStopRuntime = async () => {
    setLocalActionLoading(true);
    setLocalMessage("");
    setLocalError("");
    try {
      const data = await api.post<RuntimeActionResponse>("/runtime/stop");
      setLocalMessage(data.details.join(" · "));
      await fetchLocal();
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : "Stop failed");
    } finally {
      setLocalActionLoading(false);
    }
  };

  const muleService = runtimeStatus?.find((s) => s.name.toLowerCase().includes("mule"));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Deploy</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Local Mule runtime, CloudHub deployments, and Anypoint environments in one place.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 p-1 bg-slate-100/80 rounded-xl w-fit shadow-sm ring-1 ring-slate-200/80">
        {SECTIONS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveSection(id)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeSection === id
                ? "bg-white text-primary-text shadow-md ring-1 ring-primary-bg"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeSection === "local" && (
        <div className="rounded-2xl bg-white shadow-lg shadow-slate-200/50 ring-1 ring-slate-200 p-6 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Local runtime</h3>
              <p className="text-xs text-slate-500 mt-1">Mule standalone and related process status</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={localActionLoading}
                onClick={() => void handleStartRuntime()}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary-hover disabled:opacity-50 shadow-sm"
              >
                {localActionLoading ? "Working…" : "Start"}
              </button>
              <button
                type="button"
                disabled={localActionLoading}
                onClick={() => void handleStopRuntime()}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-100 text-slate-800 hover:bg-slate-200 disabled:opacity-50 ring-1 ring-slate-200"
              >
                Stop
              </button>
              <button
                type="button"
                disabled={localLoading}
                onClick={() => void fetchLocal()}
                className="px-4 py-2 text-sm font-medium rounded-lg text-primary-text bg-primary-bg-subtle hover:bg-primary-bg ring-1 ring-primary-bg disabled:opacity-50"
              >
                Refresh
              </button>
            </div>
          </div>

          {localMessage ? (
            <div className="text-sm text-primary-text bg-primary-bg-subtle border border-primary-bg rounded-xl px-4 py-3">
              {localMessage}
            </div>
          ) : null}

          {localError ? (
            <div className="text-sm text-red-800 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              {localError}
            </div>
          ) : null}

          {localLoading ? (
            <Spinner label="Loading runtime status…" />
          ) : (
            <>
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Mule runtime</p>
                {muleService ? (
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-slate-500">State</dt>
                      <dd className="font-medium text-slate-900 capitalize">{muleService.state}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Port</dt>
                      <dd className="font-mono text-slate-800">{muleService.port}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">PID</dt>
                      <dd className="font-mono text-slate-800">{muleService.pid ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Started</dt>
                      <dd className="text-slate-800">
                        {muleService.startedAt ? new Date(muleService.startedAt).toLocaleString() : "—"}
                      </dd>
                    </div>
                  </dl>
                ) : runtimeStatus && runtimeStatus.length > 0 ? (
                  <ul className="space-y-2 text-sm">
                    {runtimeStatus.map((s) => (
                      <li key={s.name} className="flex justify-between gap-4 border-b border-slate-200/80 pb-2 last:border-0 last:pb-0">
                        <span className="font-medium text-slate-800">{s.name}</span>
                        <span className="text-slate-600 capitalize">{s.state}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">No status available.</p>
                )}
              </div>

              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Deployed apps</p>
                {localAppsError ? (
                  <div className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                    {localAppsError}
                  </div>
                ) : localApps === null ? (
                  <p className="text-sm text-slate-500">Could not load deployed applications.</p>
                ) : localApps.length === 0 ? (
                  <p className="text-sm text-slate-500">No deployed applications reported.</p>
                ) : (
                  <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                    {localApps.map((app) => (
                      <li key={app.name} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-white hover:bg-slate-50/80">
                        <span className="font-medium text-slate-900">{app.name}</span>
                        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 ring-1 ring-slate-200">
                          {app.status}
                        </span>
                        {app.version ? (
                          <span className="text-xs text-slate-500 w-full sm:w-auto sm:ml-auto">{app.version}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {activeSection === "cloudhub" && (
        <div className="rounded-2xl bg-white shadow-lg shadow-slate-200/50 ring-1 ring-slate-200 p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">CloudHub deployments</h3>
              <p className="text-xs text-slate-500 mt-1">Applications in Anypoint CloudHub 2.0</p>
            </div>
            <button
              type="button"
              disabled={cloudLoading}
              onClick={() => void fetchCloud()}
              className="text-sm font-medium px-3 py-1.5 rounded-lg bg-primary-bg-subtle text-primary-text hover:bg-primary-bg ring-1 ring-primary-bg disabled:opacity-50"
            >
              Refresh
            </button>
          </div>

          {cloudError ? (
            <div className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
              {cloudError}
              <p className="text-xs mt-2 text-amber-700/90">
                Confirm Anypoint credentials are configured under Admin → Secrets.
              </p>
            </div>
          ) : null}

          {cloudLoading ? (
            <Spinner label="Loading CloudHub applications…" />
          ) : cloudApps && cloudApps.length === 0 && !cloudError ? (
            <p className="text-sm text-slate-500">No CloudHub applications found.</p>
          ) : cloudApps && cloudApps.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {cloudApps.map((app) => (
                <div
                  key={app.id}
                  className="rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow bg-slate-50/30"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h4 className="font-semibold text-slate-900 text-sm leading-snug">{app.name}</h4>
                    <span className={`shrink-0 inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${cloudHubStatusBadgeClass(app.status)}`}>
                      {app.status}
                    </span>
                  </div>
                  <dl className="space-y-1.5 text-xs text-slate-600">
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">Runtime</dt>
                      <dd className="text-slate-800 font-medium text-right">{app.muleVersion ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">Last updated</dt>
                      <dd className="text-slate-800 text-right">
                        {app.lastModified ? new Date(app.lastModified).toLocaleString() : "—"}
                      </dd>
                    </div>
                    {app.environmentName ? (
                      <div className="flex justify-between gap-2">
                        <dt className="text-slate-500">Environment</dt>
                        <dd className="text-slate-800 text-right">{app.environmentName}</dd>
                      </div>
                    ) : null}
                  </dl>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {activeSection === "environments" && (
        <div className="rounded-2xl bg-white shadow-lg shadow-slate-200/50 ring-1 ring-slate-200 p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Anypoint environments</h3>
              <p className="text-xs text-slate-500 mt-1">Name, type, and organization environment ID</p>
            </div>
            <button
              type="button"
              disabled={envLoading}
              onClick={() => void fetchEnvironments()}
              className="text-sm font-medium px-3 py-1.5 rounded-lg bg-primary-bg-subtle text-primary-text hover:bg-primary-bg ring-1 ring-primary-bg disabled:opacity-50"
            >
              Refresh
            </button>
          </div>

          {envError ? (
            <div className="text-sm text-red-800 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{envError}</div>
          ) : null}

          {envLoading ? (
            <Spinner label="Loading environments…" />
          ) : envs && envs.length === 0 && !envError ? (
            <p className="text-sm text-slate-500">No environments found.</p>
          ) : envs && envs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {envs.map((env) => (
                <div
                  key={env.id}
                  className="rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-white to-slate-50/80"
                >
                  <h4 className="font-semibold text-slate-900 text-sm mb-2">{env.name}</h4>
                  <p className="text-xs text-slate-600">
                    <span className="text-slate-500">Type</span>{" "}
                    <span className="font-medium text-slate-800">{env.type}</span>
                  </p>
                  <p className="text-xs text-slate-400 font-mono mt-2 break-all">{env.id}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
