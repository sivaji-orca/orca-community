import { useState, useEffect } from "react";
import { api } from "../../api/client";
import { Card } from "../../components/Card";

interface Environment {
  id: string;
  name: string;
  type: string;
  isProduction: boolean;
  organizationId?: string;
}

export function Environments() {
  const [envs, setEnvs] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<Environment[]>("/anypoint/environments")
      .then(setEnvs)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card title="Environments">
      {error && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-lg px-4 py-3 mb-4">
          {error}
        </div>
      )}
      {loading ? (
        <p className="text-slate-500 text-sm">Loading environments...</p>
      ) : envs.length === 0 && !error ? (
        <p className="text-slate-500 text-sm">No environments found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {envs.map((env) => (
            <div key={env.id} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-slate-800">{env.name}</h3>
                {env.isProduction ? (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Production</span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Sandbox</span>
                )}
              </div>
              <p className="text-xs text-slate-500">Type: {env.type}</p>
              <p className="text-xs text-slate-400 font-mono mt-1">{env.id}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
