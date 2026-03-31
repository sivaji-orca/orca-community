import { useState, useEffect } from "react";
import { api } from "../../api/client";
import { Card } from "../../components/Card";
import { StatusBadge } from "../../components/StatusBadge";

interface App {
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

export function CloudHubApps() {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchApps = () => {
    setLoading(true);
    api.get<App[]>("/anypoint/applications")
      .then(setApps)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchApps(); }, []);

  return (
    <Card title="CloudHub 2.0 Applications">
      <div className="flex justify-between items-center mb-4">
        <p className="text-xs text-slate-500">
          Applications deployed to Anypoint CloudHub 2.0
        </p>
        <button
          onClick={fetchApps}
          className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-md transition-colors"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-lg px-4 py-3 mb-4">
          {error}
          <p className="text-xs mt-1">Make sure Anypoint Platform credentials are configured in Admin &gt; Secrets.</p>
        </div>
      )}

      {loading ? (
        <p className="text-slate-500 text-sm">Loading applications...</p>
      ) : apps.length === 0 && !error ? (
        <p className="text-slate-500 text-sm">No applications deployed to CloudHub.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {apps.map((app) => (
            <div key={app.id} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-slate-800 text-sm">{app.name}</h3>
                <StatusBadge status={app.status} />
              </div>

              <div className="space-y-1.5 text-xs text-slate-500">
                {app.muleVersion && (
                  <div className="flex justify-between">
                    <span>Runtime</span>
                    <span className="text-slate-700 font-medium">{app.muleVersion}</span>
                  </div>
                )}
                {app.target && (
                  <div className="flex justify-between">
                    <span>Region</span>
                    <span className="text-slate-700 font-medium">{app.target}</span>
                  </div>
                )}
                {app.vCores != null && (
                  <div className="flex justify-between">
                    <span>vCores</span>
                    <span className="text-slate-700 font-medium">{app.vCores}</span>
                  </div>
                )}
                {app.replicas != null && (
                  <div className="flex justify-between">
                    <span>Replicas</span>
                    <span className="text-slate-700 font-medium">{app.replicas}</span>
                  </div>
                )}
                {app.environmentName && (
                  <div className="flex justify-between">
                    <span>Environment</span>
                    <span className="text-slate-700 font-medium">{app.environmentName}</span>
                  </div>
                )}
                {app.artifact && (
                  <div className="flex justify-between">
                    <span>Version</span>
                    <span className="text-slate-700 font-medium">{app.artifact.artifactId} v{app.artifact.version}</span>
                  </div>
                )}
                {app.lastModified && (
                  <div className="flex justify-between">
                    <span>Last Updated</span>
                    <span className="text-slate-700 font-medium">{new Date(app.lastModified).toLocaleString()}</span>
                  </div>
                )}
              </div>

              {app.publicUrl && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <a
                    href={app.publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-600 hover:text-indigo-800 break-all"
                  >
                    {app.publicUrl}
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
