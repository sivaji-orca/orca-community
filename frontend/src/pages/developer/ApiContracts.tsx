import { useState, useEffect } from "react";
import { api } from "../../api/client";
import { Card } from "../../components/Card";
import { StatusBadge } from "../../components/StatusBadge";

interface Contract {
  id: number;
  apiName: string;
  apiVersion: string;
  environmentName: string;
  applicationName?: string;
  status: string;
  tier?: string;
  requestedTier?: string;
}

export function ApiContracts() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<Contract[]>("/anypoint/api-contracts")
      .then(setContracts)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card title="API Manager Contracts">
      {error && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-lg px-4 py-3 mb-4">
          {error}
        </div>
      )}
      {loading ? (
        <p className="text-slate-500 text-sm">Loading contracts...</p>
      ) : contracts.length === 0 && !error ? (
        <p className="text-slate-500 text-sm">No API contracts found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-3 font-medium text-slate-500">API</th>
                <th className="text-left py-3 px-3 font-medium text-slate-500">Version</th>
                <th className="text-left py-3 px-3 font-medium text-slate-500">Environment</th>
                <th className="text-left py-3 px-3 font-medium text-slate-500">Consumer</th>
                <th className="text-left py-3 px-3 font-medium text-slate-500">SLA Tier</th>
                <th className="text-left py-3 px-3 font-medium text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => (
                <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="py-3 px-3 font-medium text-slate-800">{c.apiName}</td>
                  <td className="py-3 px-3 text-slate-600">{c.apiVersion}</td>
                  <td className="py-3 px-3 text-slate-600">{c.environmentName}</td>
                  <td className="py-3 px-3 text-slate-600">{c.applicationName || "—"}</td>
                  <td className="py-3 px-3 text-slate-600">{c.tier || c.requestedTier || "—"}</td>
                  <td className="py-3 px-3"><StatusBadge status={c.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
