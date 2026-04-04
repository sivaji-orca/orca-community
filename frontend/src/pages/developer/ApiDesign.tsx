import { useState, useEffect } from "react";
import { api } from "../../api/client";
import { StatusBadge } from "../../components/StatusBadge";

interface ApiContract {
  id: number;
  apiName: string;
  apiVersion: string;
  environmentName: string;
  applicationName?: string;
  status: string;
  tier?: string;
  requestedTier?: string;
  [key: string]: unknown;
}

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

interface LocalEndpoint {
  method: HttpMethod;
  path: string;
}

interface LocalApiProject {
  projectId: string;
  port: number;
  role: string;
  apiTitle: string;
  version: string;
  baseUri: string;
  endpoints: LocalEndpoint[];
}

const METHOD_BADGE: Record<HttpMethod, string> = {
  GET: "bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-600/20",
  POST: "bg-blue-100 text-blue-800 ring-1 ring-inset ring-blue-600/20",
  PUT: "bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-600/25",
  DELETE: "bg-red-100 text-red-800 ring-1 ring-inset ring-red-600/20",
};

const CARD_DISPLAY_KEYS = new Set([
  "id",
  "apiName",
  "apiVersion",
  "status",
  "environmentName",
  "applicationName",
  "tier",
  "requestedTier",
]);

const LOCAL_API_PROJECTS: LocalApiProject[] = [
  {
    projectId: "customer-papi",
    port: 8081,
    role: "Process API",
    apiTitle: "Customer Process API",
    version: "v1",
    baseUri: "http://localhost:8081/api",
    endpoints: [
      { method: "GET", path: "/customers" },
      { method: "POST", path: "/customers" },
      { method: "GET", path: "/customers/{id}" },
      { method: "PUT", path: "/customers/{id}" },
      { method: "DELETE", path: "/customers/{id}" },
      { method: "POST", path: "/sync/to-salesforce" },
      { method: "POST", path: "/sync/from-salesforce" },
      { method: "GET", path: "/sync/status" },
      { method: "GET", path: "/health" },
      { method: "GET", path: "/audit" },
    ],
  },
  {
    projectId: "customer-management-api",
    port: 8082,
    role: "System API (Object Store)",
    apiTitle: "Customer Management API",
    version: "v1",
    baseUri: "http://localhost:8082/api",
    endpoints: [
      { method: "GET", path: "/customers" },
      { method: "POST", path: "/customers" },
      { method: "GET", path: "/customers/{id}" },
      { method: "PUT", path: "/customers/{id}" },
      { method: "DELETE", path: "/customers/{id}" },
      { method: "GET", path: "/health" },
    ],
  },
  {
    projectId: "customer-sf-sapi",
    port: 8083,
    role: "System API (Salesforce)",
    apiTitle: "Customer Salesforce System API",
    version: "v1",
    baseUri: "http://localhost:8083/api",
    endpoints: [
      { method: "GET", path: "/accounts" },
      { method: "POST", path: "/accounts" },
      { method: "GET", path: "/accounts/{id}" },
      { method: "PUT", path: "/accounts/{id}" },
      { method: "DELETE", path: "/accounts/{id}" },
      { method: "GET", path: "/health" },
    ],
  },
  {
    projectId: "customer-mock-service",
    port: 8084,
    role: "Mock Service",
    apiTitle: "Customer Mock Service",
    version: "v1",
    baseUri: "http://localhost:8084/api",
    endpoints: [
      { method: "GET", path: "/accounts" },
      { method: "POST", path: "/accounts" },
      { method: "GET", path: "/accounts/{id}" },
      { method: "PUT", path: "/accounts/{id}" },
      { method: "DELETE", path: "/accounts/{id}" },
      { method: "GET", path: "/health" },
    ],
  },
];

function formatDetailValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function MethodBadge({ method }: { method: HttpMethod }) {
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[3.25rem] px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide ${METHOD_BADGE[method]}`}
    >
      {method}
    </span>
  );
}

function ContractAssetDetails({ contract }: { contract: ApiContract }) {
  const extras = Object.entries(contract).filter(
    ([key, value]) =>
      !CARD_DISPLAY_KEYS.has(key) &&
      value !== null &&
      value !== undefined &&
      value !== ""
  );

  if (extras.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-slate-200/80">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-primary/90 mb-2">
        Asset details
      </p>
      <dl className="space-y-1.5 text-xs">
        {extras.map(([key, value]) => (
          <div key={key} className="grid grid-cols-[minmax(0,7.5rem)_1fr] gap-x-2 gap-y-0.5">
            <dt className="text-slate-500 truncate" title={key}>
              {key}
            </dt>
            <dd className="text-slate-700 font-mono text-[11px] break-all">
              {formatDetailValue(value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function ApiDesign() {
  const [contracts, setContracts] = useState<ApiContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    api
      .get<ApiContract[]>("/anypoint/api-contracts")
      .then((data) => {
        if (!cancelled) setContracts(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-10">
      <section>
        <div className="flex items-end justify-between gap-4 mb-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 tracking-tight">
              API contracts
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              RAML-backed APIs and contracts from Anypoint API Manager
            </p>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 text-red-800 text-sm px-4 py-3 mb-6"
          >
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white/80 px-6 py-12 text-center text-slate-500 text-sm">
            Loading API contracts from Anypoint…
          </div>
        ) : contracts.length === 0 && !error ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-10 text-center text-slate-500 text-sm">
            No API contracts returned for this organization.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {contracts.map((c) => (
              <article
                key={`${c.id}-${c.apiName}-${c.apiVersion}-${c.environmentName}`}
                className="rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/5 p-5 flex flex-col ring-1 ring-slate-900/5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-900 truncate" title={c.apiName}>
                      {c.apiName}
                    </h3>
                    <p className="text-sm text-primary font-medium mt-0.5">
                      {c.apiVersion}
                    </p>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
                <ul className="mt-4 space-y-2 text-sm text-slate-600">
                  <li className="flex justify-between gap-2">
                    <span className="text-slate-500">Environment</span>
                    <span className="font-medium text-slate-800 text-right">{c.environmentName}</span>
                  </li>
                  {c.applicationName ? (
                    <li className="flex justify-between gap-2">
                      <span className="text-slate-500">Application</span>
                      <span className="font-medium text-slate-800 text-right truncate" title={c.applicationName}>
                        {c.applicationName}
                      </span>
                    </li>
                  ) : null}
                  {(c.tier || c.requestedTier) ? (
                    <li className="flex justify-between gap-2">
                      <span className="text-slate-500">SLA tier</span>
                      <span className="font-medium text-slate-800">{c.tier || c.requestedTier}</span>
                    </li>
                  ) : null}
                </ul>
                <ContractAssetDetails contract={c} />
              </article>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900 tracking-tight mb-1">
          Local RAML specs
        </h2>
        <p className="text-sm text-slate-500 mb-6">
          Reference endpoints for workspace API projects (static RAML layout)
        </p>

        <div className="space-y-8">
          {LOCAL_API_PROJECTS.map((proj) => (
            <div
              key={proj.projectId}
              className="rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/5 overflow-hidden ring-1 ring-slate-900/5"
            >
              <div className="bg-gradient-to-r from-primary-bg-subtle/90 to-slate-50 border-b border-slate-200/80 px-5 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">{proj.apiTitle}</h3>
                    <p className="text-xs text-primary-text font-medium mt-0.5">
                      {proj.projectId} · port {proj.port} · {proj.role}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-slate-600 bg-white/80 px-2.5 py-1 rounded-md ring-1 ring-slate-200/80">
                    {proj.version}
                  </span>
                </div>
                <p className="mt-3 text-xs text-slate-600">
                  <span className="text-slate-500 font-medium">baseUri</span>{" "}
                  <code className="ml-1 text-primary-text bg-white/70 px-1.5 py-0.5 rounded font-mono text-[11px]">
                    {proj.baseUri}
                  </code>
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80">
                      <th className="text-left py-3 px-5 font-medium text-slate-500 w-28">Method</th>
                      <th className="text-left py-3 px-3 font-medium text-slate-500">Path</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proj.endpoints.map((row, idx) => (
                      <tr
                        key={`${proj.projectId}-${row.method}-${row.path}-${idx}`}
                        className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                      >
                        <td className="py-2.5 px-5 align-middle">
                          <MethodBadge method={row.method} />
                        </td>
                        <td className="py-2.5 px-3 align-middle">
                          <code className="text-slate-800 font-mono text-[13px]">{row.path}</code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
