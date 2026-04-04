import { useState, useEffect } from "react";
import { api } from "../../api/client";
import { Card } from "../../components/Card";

interface CredStatus {
  anypoint: { client_id: boolean; client_secret: boolean };
  salesforce: { instance_url: boolean; username: boolean; password: boolean; security_token: boolean };
  neon: { database_url: boolean };
  github: { token: boolean };
  postman: { api_key: boolean };
}

interface UseCase {
  id: string;
  title: string;
  description: string;
  templateId: string;
  requiredCredentials: { key: string; label: string; setupUrl: string; setupLabel: string }[];
  ports: { name: string; port: number; description: string }[];
  features: string[];
  syncMechanism: string;
}

const USE_CASES: UseCase[] = [
  {
    id: "sf-postgres-sync",
    title: "Salesforce-Postgres Bidirectional Sync",
    description:
      "Real-time bidirectional synchronization of Contacts and Accounts between Salesforce and Neon PostgreSQL via three MuleSoft APIs following API-led connectivity pattern.",
    templateId: "sf-postgres-sync",
    requiredCredentials: [
      { key: "anypoint", label: "Anypoint Platform", setupUrl: "https://anypoint.mulesoft.com", setupLabel: "Create Connected App" },
      { key: "salesforce", label: "Salesforce", setupUrl: "https://developer.salesforce.com/signup", setupLabel: "Developer Account" },
      { key: "neon", label: "Neon PostgreSQL", setupUrl: "https://neon.tech", setupLabel: "Free Database" },
    ],
    ports: [
      { name: "sync-process-api", port: 8081, description: "Orchestrator — CDC listener + scheduler" },
      { name: "sf-system-api", port: 8082, description: "Salesforce CRUD via Connector" },
      { name: "db-system-api", port: 8083, description: "PostgreSQL CRUD via DB Connector" },
    ],
    features: [
      "Salesforce CDC for real-time SF→Postgres sync",
      "Polling scheduler (15s) for Postgres→SF sync",
      "DataWeave field mappings for Contacts & Accounts",
      "SQL migration scripts with indexes & triggers",
      "Automated Postman collections for all endpoints",
      "30-second SLA for bidirectional sync",
    ],
    syncMechanism: "CDC + Polling",
  },
];

function isCredReady(key: string, status: CredStatus | null): boolean {
  if (!status) return false;
  switch (key) {
    case "anypoint": return status.anypoint.client_id && status.anypoint.client_secret;
    case "salesforce": return status.salesforce.instance_url && status.salesforce.username;
    case "neon": return status.neon.database_url;
    default: return false;
  }
}

interface UseCaseGalleryProps {
  onNavigate: (tab: string) => void;
}

export function UseCaseGallery({ onNavigate }: UseCaseGalleryProps) {
  const [credStatus, setCredStatus] = useState<CredStatus | null>(null);

  useEffect(() => {
    api.get<CredStatus>("/system/configure/status").then(setCredStatus).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <Card title="Use Case Gallery">
        <p className="text-sm text-slate-500 mb-6">
          Pre-packaged integration patterns ready to scaffold and deploy. Each use case generates fully-functional MuleSoft applications with RAML specs, DataWeave mappings, tests, and Postman collections.
        </p>

        {USE_CASES.map((uc) => {
          const allReady = uc.requiredCredentials.every((c) => isCredReady(c.key, credStatus));
          const readyCount = uc.requiredCredentials.filter((c) => isCredReady(c.key, credStatus)).length;

          return (
            <div key={uc.id} className="border border-slate-200 rounded-xl overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-primary-bg/50 to-slate-50 p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">{uc.title}</h3>
                    <p className="text-sm text-slate-500 mt-1 max-w-xl">{uc.description}</p>
                  </div>
                  <span className="px-3 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-700">
                    {uc.syncMechanism}
                  </span>
                </div>
              </div>

              {/* Architecture diagram */}
              <div className="px-6 py-4 bg-slate-50 border-y border-slate-200">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Architecture</p>
                <div className="flex items-center justify-center gap-2 text-xs">
                  <div className="bg-blue-100 text-blue-700 rounded-lg px-3 py-2 text-center min-w-[100px]">
                    <div className="font-bold">Salesforce</div>
                    <div className="text-blue-500 mt-0.5">Contacts / Accounts</div>
                  </div>
                  <div className="flex flex-col items-center text-slate-400">
                    <span>CDC events</span>
                    <svg className="w-6 h-3" viewBox="0 0 24 12"><path d="M0 6h20m0 0l-4-4m4 4l-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
                  </div>
                  <div className="bg-primary-bg text-primary-text rounded-lg px-3 py-2 text-center min-w-[140px]">
                    <div className="font-bold">MuleSoft</div>
                    <div className="mt-0.5 space-y-0.5">
                      {uc.ports.map((p) => (
                        <div key={p.name} className="text-xs opacity-80">{p.name} :{p.port}</div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col items-center text-slate-400">
                    <span>SQL upsert</span>
                    <svg className="w-6 h-3" viewBox="0 0 24 12"><path d="M0 6h20m0 0l-4-4m4 4l-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
                  </div>
                  <div className="bg-green-100 text-green-700 rounded-lg px-3 py-2 text-center min-w-[100px]">
                    <div className="font-bold">Neon PG</div>
                    <div className="text-green-500 mt-0.5">contacts / accounts</div>
                  </div>
                </div>
                <div className="flex items-center justify-center mt-1 text-xs text-slate-400">
                  <svg className="w-6 h-3 rotate-180 mr-2" viewBox="0 0 24 12"><path d="M0 6h20m0 0l-4-4m4 4l-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
                  Poll every 15s (pending changes)
                  <svg className="w-6 h-3 rotate-180 ml-2" viewBox="0 0 24 12"><path d="M0 6h20m0 0l-4-4m4 4l-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
                </div>
              </div>

              {/* Features + Credentials */}
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Features</p>
                  <ul className="space-y-1.5">
                    {uc.features.map((f, i) => (
                      <li key={i} className="text-xs text-slate-600 flex items-start gap-2">
                        <svg className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Prerequisites ({readyCount}/{uc.requiredCredentials.length} ready)
                  </p>
                  <div className="space-y-2">
                    {uc.requiredCredentials.map((cred) => {
                      const ready = isCredReady(cred.key, credStatus);
                      return (
                        <div key={cred.key} className={`flex items-center justify-between p-2 rounded-lg border ${ready ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
                          <div className="flex items-center gap-2">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-xs ${ready ? "bg-green-500" : "bg-amber-500"}`}>
                              {ready ? "\u2713" : "!"}
                            </div>
                            <span className={`text-xs font-medium ${ready ? "text-green-700" : "text-amber-700"}`}>{cred.label}</span>
                          </div>
                          {!ready && (
                            <a href={cred.setupUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-amber-600 hover:text-amber-800 underline">
                              {cred.setupLabel}
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* CTA */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  {allReady ? "All prerequisites configured. Ready to deploy!" : "Configure missing credentials to deploy."}
                </p>
                <button
                  onClick={() => onNavigate("new-project")}
                  className={`px-5 py-2 text-sm rounded-lg font-medium cursor-pointer transition-colors ${
                    allReady
                      ? "bg-primary text-white hover:bg-primary-hover"
                      : "bg-slate-200 text-slate-500"
                  }`}
                >
                  Deploy This Use Case
                </button>
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
