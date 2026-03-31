import { useState, useEffect } from "react";
import { api } from "../../api/client";
import { Card } from "../../components/Card";

interface ServiceInfo {
  name: string;
  state: string;
  port: string;
  pid: number | null;
  startedAt: string | null;
}

interface SetupStatus {
  muleInstalled: boolean;
  wiremockInstalled: boolean;
  javaAvailable: boolean;
  javaVersion: string;
}

export function WorkstationSetup() {
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [logs, setLogs] = useState("");
  const [showLogs, setShowLogs] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const [svcData, setupData] = await Promise.all([
        api.get<ServiceInfo[]>("/runtime/status"),
        api.get<SetupStatus>("/runtime/setup-status"),
      ]);
      setServices(svcData);
      setSetupStatus(setupData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStatus(); }, []);

  const handleStartAll = async () => {
    setActionLoading(true);
    setError("");
    setMessage("");
    try {
      const data = await api.post<{ message: string; details: string[] }>("/runtime/start");
      setMessage(data.details.join(" | "));
      await fetchStatus();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStopAll = async () => {
    setActionLoading(true);
    setError("");
    setMessage("");
    try {
      const data = await api.post<{ message: string; details: string[] }>("/runtime/stop");
      setMessage(data.details.join(" | "));
      await fetchStatus();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartService = async (name: string) => {
    setActionLoading(true);
    setError("");
    setMessage("");
    const endpoint = name.includes("Mule") ? "/runtime/start/mule" : "/runtime/start/wiremock";
    try {
      const data = await api.post<{ message: string }>(endpoint);
      setMessage(data.message);
      await fetchStatus();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStopService = async (name: string) => {
    setActionLoading(true);
    setError("");
    setMessage("");
    const endpoint = name.includes("Mule") ? "/runtime/stop/mule" : "/runtime/stop/wiremock";
    try {
      const data = await api.post<{ message: string }>(endpoint);
      setMessage(data.message);
      await fetchStatus();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const data = await api.get<{ logs: string }>("/runtime/logs/mule?lines=80");
      setLogs(data.logs);
      setShowLogs(true);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const allReady = setupStatus?.muleInstalled && setupStatus?.wiremockInstalled && setupStatus?.javaAvailable;

  return (
    <Card title="Local Workstation Setup">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
          {error}
        </div>
      )}
      {message && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3 mb-4">
          {message}
        </div>
      )}

      {setupStatus && (
        <div className="bg-slate-50 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-semibold text-slate-600 mb-3">Prerequisites</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className={`border rounded-lg p-3 ${setupStatus.javaAvailable ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${setupStatus.javaAvailable ? "text-green-700" : "text-red-700"}`}>
                  {setupStatus.javaAvailable ? "\u2713" : "\u2717"} Java 17
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">{setupStatus.javaVersion}</p>
            </div>
            <div className={`border rounded-lg p-3 ${setupStatus.muleInstalled ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
              <span className={`text-sm font-medium ${setupStatus.muleInstalled ? "text-green-700" : "text-red-700"}`}>
                {setupStatus.muleInstalled ? "\u2713" : "\u2717"} MuleSoft Runtime
              </span>
              <p className="text-xs text-slate-500 mt-1">{setupStatus.muleInstalled ? "4.11.2 Standalone" : "Not extracted"}</p>
            </div>
            <div className={`border rounded-lg p-3 ${setupStatus.wiremockInstalled ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
              <span className={`text-sm font-medium ${setupStatus.wiremockInstalled ? "text-green-700" : "text-red-700"}`}>
                {setupStatus.wiremockInstalled ? "\u2713" : "\u2717"} WireMock
              </span>
              <p className="text-xs text-slate-500 mt-1">{setupStatus.wiremockInstalled ? "Standalone JAR" : "Not downloaded"}</p>
            </div>
          </div>
        </div>
      )}

      {!allReady && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-lg px-4 py-3 mb-4">
          Some prerequisites are missing. Ensure the MuleSoft Runtime is extracted and WireMock jar is downloaded in the <code className="bg-amber-100 px-1 rounded">softwares/</code> directory.
        </div>
      )}

      <div className="flex gap-3 mb-6">
        <button
          onClick={handleStartAll}
          disabled={actionLoading || !allReady}
          className="px-5 py-2.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium cursor-pointer"
        >
          {actionLoading ? "Working..." : "Start All Services"}
        </button>
        <button
          onClick={handleStopAll}
          disabled={actionLoading}
          className="px-5 py-2.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium cursor-pointer"
        >
          Stop All Services
        </button>
        <button
          onClick={fetchStatus}
          disabled={loading}
          className="px-5 py-2.5 border border-slate-300 text-slate-600 text-sm rounded-lg hover:bg-slate-100 disabled:opacity-50 font-medium cursor-pointer"
        >
          Refresh
        </button>
        <button
          onClick={fetchLogs}
          className="px-5 py-2.5 border border-slate-300 text-slate-600 text-sm rounded-lg hover:bg-slate-100 font-medium cursor-pointer"
        >
          View Mule Logs
        </button>
      </div>

      <h3 className="text-sm font-semibold text-slate-600 mb-3">Service Status</h3>
      {loading ? (
        <p className="text-slate-500 text-sm">Checking services...</p>
      ) : services.length === 0 ? (
        <div className="bg-slate-50 rounded-lg p-6 text-center">
          <p className="text-slate-500 text-sm">No services detected.</p>
          <p className="text-slate-400 text-xs mt-1">
            Click "Start All Services" to launch MuleSoft Runtime and WireMock.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {services.map((svc) => (
            <div key={svc.name} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3">
              <div className="flex items-center gap-3">
                <div>
                  <span className="font-medium text-slate-800 text-sm">{svc.name}</span>
                  <span className="ml-2 text-xs text-slate-400">port {svc.port}</span>
                  {svc.pid && <span className="ml-2 text-xs text-slate-400">PID {svc.pid}</span>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  svc.state === "running" ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-600"
                }`}>
                  {svc.state}
                </span>
                {svc.state === "running" ? (
                  <button
                    onClick={() => handleStopService(svc.name)}
                    disabled={actionLoading}
                    className="text-xs text-red-600 hover:text-red-700 font-medium cursor-pointer"
                  >
                    Stop
                  </button>
                ) : (
                  <button
                    onClick={() => handleStartService(svc.name)}
                    disabled={actionLoading || !allReady}
                    className="text-xs text-green-600 hover:text-green-700 font-medium cursor-pointer"
                  >
                    Start
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showLogs && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-slate-600">MuleSoft Runtime Logs</h3>
            <button
              onClick={() => setShowLogs(false)}
              className="text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
            >
              Hide
            </button>
          </div>
          <div className="bg-slate-900 rounded-lg p-4 max-h-72 overflow-y-auto">
            <pre className="font-mono text-xs text-green-400 whitespace-pre-wrap">{logs || "No logs available yet."}</pre>
          </div>
        </div>
      )}

      <div className="mt-6 bg-slate-50 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-slate-600 mb-2">Services</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="border border-slate-200 rounded-lg p-3 bg-white">
            <h4 className="font-medium text-slate-800 text-sm">MuleSoft Runtime 4.11.2</h4>
            <p className="text-xs text-slate-500 mt-1">Standalone runtime on port 8081 for deploying and testing Mule applications locally</p>
          </div>
          <div className="border border-slate-200 rounded-lg p-3 bg-white">
            <h4 className="font-medium text-slate-800 text-sm">WireMock</h4>
            <p className="text-xs text-slate-500 mt-1">HTTP mock server on port 9090 for simulating external API dependencies</p>
          </div>
        </div>
      </div>
    </Card>
  );
}
