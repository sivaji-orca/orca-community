import { useState, useEffect, useCallback, useRef } from "react";

type SubTab = "schema" | "soql" | "records" | "org";

interface SchemaObject {
  name: string;
  label: string;
  keyPrefix: string | null;
  isCustom: boolean;
  isQueryable: boolean;
  isCreateable: boolean;
  isUpdateable: boolean;
  isDeletable: boolean;
}

interface SchemaField {
  fieldName: string;
  label: string;
  type: string;
  length: number;
  precision: number;
  scale: number;
  referenceTo: string[];
  picklistValues: { label: string; value: string; active: boolean }[];
  isRequired: boolean;
  isUnique: boolean;
  isCustom: boolean;
  isCreateable: boolean;
  isUpdateable: boolean;
  isFormula: boolean;
  formula: string | null;
  defaultValue: string | null;
  description: string | null;
}

interface RelationshipData {
  parents: { fieldName: string; referenceTo: string; relationshipName: string | null; type: string }[];
  children: { objectName: string; fieldName: string; relationshipName: string | null }[];
}

interface ErdData {
  nodes: { name: string; label: string; fields: { name: string; type: string; referenceTo?: string }[] }[];
  edges: { from: string; to: string; field: string; type: string }[];
}

interface SoqlHistoryItem {
  id: number;
  query_text: string;
  nlp_prompt: string | null;
  execution_time_ms: number;
  row_count: number;
  success: number;
  error_message: string | null;
  executed_at: string;
}

interface SoqlFavorite {
  id: number;
  name: string;
  description: string;
  query_text: string;
  tags: string;
  created_at: string;
}

interface QueryTemplate {
  name: string;
  description: string;
  soql: string;
  category: string;
}

interface NlpResult {
  soql: string;
  explanation: string;
  confidence: number;
  engine: string;
  suggestions?: string[];
}

interface LimitsData {
  [key: string]: { Max: number; Remaining: number };
}

interface RecordCount {
  name: string;
  label: string;
  count: number;
}

function api(path: string, options?: RequestInit) {
  const token = localStorage.getItem("orca_token");
  return fetch(`/api/sf-devtools${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...options?.headers },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════

export function SalesforceDevTools() {
  const [subTab, setSubTab] = useState<SubTab>("soql");
  const [connectionStatus, setConnectionStatus] = useState<string>("checking");

  useEffect(() => {
    api("/org/health").then((r) => r.json()).then((d) => setConnectionStatus(d.status || "UNKNOWN")).catch(() => setConnectionStatus("ERROR"));
  }, []);

  const statusColor = connectionStatus === "CONNECTED" ? "bg-emerald-500" : connectionStatus === "NOT_CONFIGURED" ? "bg-amber-500" : "bg-red-500";

  const subTabs: { key: SubTab; label: string }[] = [
    { key: "soql", label: "SOQL Workbench" },
    { key: "schema", label: "Schema Explorer" },
    { key: "records", label: "Record Browser" },
    { key: "org", label: "Org Inspector" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Salesforce DevTools</h2>
          <p className="text-sm text-slate-500 mt-0.5">Schema explorer, SOQL workbench, record browser, and org inspector</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${statusColor}`} />
          <span className="text-xs text-slate-500">{connectionStatus}</span>
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {subTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              subTab === t.key ? "border-blue-500 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === "soql" && <SOQLWorkbench />}
      {subTab === "schema" && <SchemaExplorer />}
      {subTab === "records" && <RecordBrowser />}
      {subTab === "org" && <OrgInspector />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SOQL Workbench
// ═══════════════════════════════════════════════════════════════════════════

function SOQLWorkbench() {
  const [soql, setSoql] = useState("SELECT Id, Name, Industry, Phone FROM Account ORDER BY Name LIMIT 25");
  const [nlpQuery, setNlpQuery] = useState("");
  const [results, setResults] = useState<any>(null);
  const [nlpResult, setNlpResult] = useState<NlpResult | null>(null);
  const [executing, setExecuting] = useState(false);
  const [generatingNlp, setGeneratingNlp] = useState(false);
  const [error, setError] = useState("");
  const [executionTime, setExecutionTime] = useState(0);
  const [history, setHistory] = useState<SoqlHistoryItem[]>([]);
  const [favorites, setFavorites] = useState<SoqlFavorite[]>([]);
  const [templates, setTemplates] = useState<QueryTemplate[]>([]);
  const [sidePanel, setSidePanel] = useState<"history" | "favorites" | "templates" | null>(null);
  const [llmConfigured, setLlmConfigured] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    api("/soql/templates").then((r) => r.json()).then((d) => setTemplates(d.templates || []));
    api("/soql/llm-status").then((r) => r.json()).then((d) => setLlmConfigured(d.configured));
    loadHistory();
    loadFavorites();
  }, []);

  const loadHistory = () => api("/soql/history").then((r) => r.json()).then((d) => setHistory(d.history || []));
  const loadFavorites = () => api("/soql/favorites").then((r) => r.json()).then((d) => setFavorites(d.favorites || []));

  const executeQuery = useCallback(async () => {
    if (!soql.trim()) return;
    setExecuting(true);
    setError("");
    setResults(null);
    try {
      const res = await api("/soql/execute", { method: "POST", body: JSON.stringify({ soql }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.details?.join(", ") || "Query failed");
      setResults(data);
      setExecutionTime(data.executionTimeMs || 0);
      loadHistory();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setExecuting(false);
    }
  }, [soql]);

  const generateFromNlp = useCallback(async () => {
    if (!nlpQuery.trim()) return;
    setGeneratingNlp(true);
    setNlpResult(null);
    try {
      const res = await api("/soql/nlp", { method: "POST", body: JSON.stringify({ query: nlpQuery }) });
      const data = await res.json();
      setNlpResult(data);
      if (data.soql) setSoql(data.soql);
    } catch (e: any) {
      setNlpResult({ soql: "", explanation: e.message, confidence: 0, engine: "error" });
    } finally {
      setGeneratingNlp(false);
    }
  }, [nlpQuery]);

  const saveFavorite = async () => {
    const name = prompt("Name for this query:");
    if (!name) return;
    await api("/soql/favorites", { method: "POST", body: JSON.stringify({ name, queryText: soql }) });
    loadFavorites();
  };

  const deleteFavorite = async (id: number) => {
    await api(`/soql/favorites/${id}`, { method: "DELETE" });
    loadFavorites();
  };

  const exportResults = (format: "csv" | "json") => {
    if (!results?.records?.length) return;
    let content: string;
    let mime: string;
    if (format === "json") {
      content = JSON.stringify(results.records, null, 2);
      mime = "application/json";
    } else {
      const keys = Object.keys(results.records[0]).filter((k) => k !== "attributes");
      const lines = [keys.join(",")];
      for (const rec of results.records) {
        lines.push(keys.map((k) => `"${String(rec[k] ?? "").replace(/"/g, '""')}"`).join(","));
      }
      content = lines.join("\n");
      mime = "text/csv";
    }
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `query-results.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        executeQuery();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [executeQuery]);

  const resultKeys = results?.records?.[0] ? Object.keys(results.records[0]).filter((k) => k !== "attributes") : [];

  return (
    <div className="flex gap-3" style={{ height: "calc(100vh - 220px)" }}>
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        {/* NLP Input */}
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={nlpQuery}
                onChange={(e) => setNlpQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && generateFromNlp()}
                placeholder="Describe what you want to query in plain English... (e.g. 'show all contacts created this month')"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 pr-16"
              />
              {!llmConfigured && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Template</span>
              )}
            </div>
            <button
              onClick={generateFromNlp}
              disabled={generatingNlp || !nlpQuery.trim()}
              className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 whitespace-nowrap"
            >
              {generatingNlp ? "Generating..." : "Generate SOQL"}
            </button>
          </div>
          {nlpResult && (
            <div className="mt-2 text-xs">
              {nlpResult.confidence > 0 && (
                <span className={`inline-block px-1.5 py-0.5 rounded mr-2 ${nlpResult.confidence >= 0.8 ? "bg-emerald-100 text-emerald-700" : nlpResult.confidence >= 0.5 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                  {Math.round(nlpResult.confidence * 100)}% confidence
                </span>
              )}
              <span className="text-slate-500">{nlpResult.explanation}</span>
              {nlpResult.suggestions?.map((s, i) => <p key={i} className="text-slate-400 mt-1">{s}</p>)}
            </div>
          )}
        </div>

        {/* SOQL Editor */}
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-slate-50">
            <span className="text-xs font-medium text-slate-600">SOQL Query</span>
            <div className="flex items-center gap-2">
              <button onClick={saveFavorite} className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded border border-slate-200 hover:bg-white">Save</button>
              <button
                onClick={executeQuery}
                disabled={executing || !soql.trim()}
                className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {executing ? "Running..." : "Run (Cmd+Enter)"}
              </button>
            </div>
          </div>
          <textarea
            ref={textareaRef}
            value={soql}
            onChange={(e) => setSoql(e.target.value)}
            className="flex-1 p-3 text-sm font-mono text-slate-800 resize-none focus:outline-none min-h-[100px]"
            spellCheck={false}
            placeholder="SELECT Id, Name FROM Account LIMIT 10"
          />
        </div>

        {/* Results */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden min-h-0">
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-slate-600">Results</span>
              {results && (
                <>
                  <span className="text-xs text-slate-400">{results.totalSize ?? 0} records</span>
                  <span className="text-xs text-slate-400">{executionTime}ms</span>
                </>
              )}
            </div>
            {results?.records?.length > 0 && (
              <div className="flex items-center gap-1">
                <button onClick={() => exportResults("csv")} className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded border border-slate-200 hover:bg-white">CSV</button>
                <button onClick={() => exportResults("json")} className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded border border-slate-200 hover:bg-white">JSON</button>
              </div>
            )}
          </div>
          <div className="flex-1 overflow-auto">
            {error && <div className="p-3 text-sm text-red-600 bg-red-50">{error}</div>}
            {results?.records?.length > 0 ? (
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    {resultKeys.map((k) => (
                      <th key={k} className="px-3 py-2 text-left font-medium text-slate-600 border-b border-slate-200 whitespace-nowrap">{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.records.map((rec: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50 border-b border-slate-100">
                      {resultKeys.map((k) => (
                        <td key={k} className="px-3 py-1.5 text-slate-700 whitespace-nowrap max-w-[200px] truncate">
                          {typeof rec[k] === "object" && rec[k] !== null ? JSON.stringify(rec[k]) : String(rec[k] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : results && !error ? (
              <div className="p-4 text-sm text-slate-400 text-center">No records returned</div>
            ) : !error ? (
              <div className="p-4 text-sm text-slate-400 text-center">Run a query to see results</div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Side Panel */}
      <div className="w-64 shrink-0 bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden">
        <div className="flex border-b border-slate-200">
          {(["templates", "favorites", "history"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setSidePanel(sidePanel === tab ? null : tab)}
              className={`flex-1 px-2 py-2 text-[11px] font-medium capitalize ${sidePanel === tab ? "text-blue-600 border-b-2 border-blue-500" : "text-slate-500 hover:text-slate-700"}`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-auto p-2">
          {(sidePanel === null || sidePanel === "templates") && templates.length > 0 && (
            <div className="space-y-1">
              {templates.map((t, i) => (
                <button
                  key={i}
                  onClick={() => setSoql(t.soql)}
                  className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <p className="text-xs font-medium text-slate-700">{t.name}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{t.description}</p>
                </button>
              ))}
            </div>
          )}
          {sidePanel === "favorites" && (
            <div className="space-y-1">
              {favorites.length === 0 && <p className="text-xs text-slate-400 p-2">No saved favorites yet</p>}
              {favorites.map((f) => (
                <div key={f.id} className="flex items-start justify-between px-2.5 py-2 rounded-lg hover:bg-slate-50 group">
                  <button onClick={() => setSoql(f.query_text)} className="text-left flex-1">
                    <p className="text-xs font-medium text-slate-700">{f.name}</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">{f.query_text}</p>
                  </button>
                  <button onClick={() => deleteFavorite(f.id)} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 ml-1 text-xs">x</button>
                </div>
              ))}
            </div>
          )}
          {sidePanel === "history" && (
            <div className="space-y-1">
              {history.length === 0 && <p className="text-xs text-slate-400 p-2">No query history yet</p>}
              {history.map((h) => (
                <button
                  key={h.id}
                  onClick={() => setSoql(h.query_text)}
                  className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${h.success ? "bg-emerald-500" : "bg-red-500"}`} />
                    <span className="text-[10px] text-slate-400">{h.row_count} rows / {h.execution_time_ms}ms</span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">{h.query_text}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Schema Explorer
// ═══════════════════════════════════════════════════════════════════════════

function SchemaExplorer() {
  const [objects, setObjects] = useState<SchemaObject[]>([]);
  const [filteredObjects, setFilteredObjects] = useState<SchemaObject[]>([]);
  const [selectedObject, setSelectedObject] = useState<string | null>(null);
  const [fields, setFields] = useState<SchemaField[]>([]);
  const [relationships, setRelationships] = useState<RelationshipData | null>(null);
  const [erdData, setErdData] = useState<ErdData | null>(null);
  const [searchObj, setSearchObj] = useState("");
  const [searchField, setSearchField] = useState("");
  const [showCustomOnly, setShowCustomOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [erdObjects, setErdObjects] = useState<string[]>(["Account", "Contact", "Opportunity"]);
  const [showErd, setShowErd] = useState(false);
  const [fieldSort, setFieldSort] = useState<{ key: string; asc: boolean }>({ key: "fieldName", asc: true });

  useEffect(() => {
    loadObjects();
  }, []);

  const loadObjects = async () => {
    setLoading(true);
    try {
      const res = await api("/schema/objects");
      const data = await res.json();
      setObjects(data.objects || []);
      setFilteredObjects(data.objects || []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => {
    let filtered = objects;
    if (searchObj) {
      const q = searchObj.toLowerCase();
      filtered = filtered.filter((o) => o.name.toLowerCase().includes(q) || o.label.toLowerCase().includes(q));
    }
    if (showCustomOnly) filtered = filtered.filter((o) => o.isCustom);
    setFilteredObjects(filtered);
  }, [searchObj, showCustomOnly, objects]);

  const selectObject = async (name: string) => {
    setSelectedObject(name);
    setFields([]);
    setRelationships(null);
    try {
      const res = await api(`/schema/objects/${name}`);
      const data = await res.json();
      setFields(data.fields || []);
      setRelationships(data.relationships || null);
    } catch {}
  };

  const refreshSchema = async () => {
    setRefreshing(true);
    try {
      await api("/schema/refresh", { method: "POST" });
      await loadObjects();
    } catch {} finally { setRefreshing(false); }
  };

  const loadErd = async () => {
    if (erdObjects.length === 0) return;
    try {
      const res = await api(`/schema/erd?objects=${erdObjects.join(",")}`);
      const data = await res.json();
      setErdData(data);
      setShowErd(true);
    } catch {}
  };

  const toggleErdObject = (name: string) => {
    setErdObjects((prev) => prev.includes(name) ? prev.filter((o) => o !== name) : prev.length < 20 ? [...prev, name] : prev);
  };

  const sortedFields = [...fields].sort((a: any, b: any) => {
    const valA = a[fieldSort.key] ?? "";
    const valB = b[fieldSort.key] ?? "";
    const cmp = String(valA).localeCompare(String(valB));
    return fieldSort.asc ? cmp : -cmp;
  });

  const filteredFields = searchField
    ? sortedFields.filter((f) => f.fieldName.toLowerCase().includes(searchField.toLowerCase()) || f.label.toLowerCase().includes(searchField.toLowerCase()))
    : sortedFields;

  const toggleSort = (key: string) => {
    setFieldSort((prev) => ({ key, asc: prev.key === key ? !prev.asc : true }));
  };

  return (
    <div className="flex gap-3" style={{ height: "calc(100vh - 220px)" }}>
      {/* Object List */}
      <div className="w-72 shrink-0 bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600">Objects ({filteredObjects.length})</span>
            <button onClick={refreshSchema} disabled={refreshing} className="text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50">
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
          <input
            type="text"
            value={searchObj}
            onChange={(e) => setSearchObj(e.target.value)}
            placeholder="Search objects..."
            className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-300"
          />
          <label className="flex items-center gap-1.5 text-[10px] text-slate-500 cursor-pointer">
            <input type="checkbox" checked={showCustomOnly} onChange={(e) => setShowCustomOnly(e.target.checked)} className="rounded" />
            Custom objects only
          </label>
        </div>
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="p-4 text-xs text-slate-400 text-center">Loading objects...</div>
          ) : (
            filteredObjects.map((obj) => (
              <button
                key={obj.name}
                onClick={() => selectObject(obj.name)}
                className={`w-full text-left px-3 py-2 border-b border-slate-50 hover:bg-slate-50 transition-colors ${selectedObject === obj.name ? "bg-blue-50 border-l-2 border-l-blue-500" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-700">{obj.name}</span>
                  <div className="flex items-center gap-1">
                    {obj.isCustom && <span className="text-[9px] px-1 py-0.5 bg-purple-100 text-purple-600 rounded">Custom</span>}
                    <input
                      type="checkbox"
                      checked={erdObjects.includes(obj.name)}
                      onChange={() => toggleErdObject(obj.name)}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded w-3 h-3"
                      title="Include in ERD"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">{obj.label}</p>
              </button>
            ))
          )}
        </div>
        <div className="px-3 py-2 border-t border-slate-100 bg-slate-50">
          <button
            onClick={loadErd}
            disabled={erdObjects.length === 0}
            className="w-full px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            View ERD ({erdObjects.length} objects)
          </button>
        </div>
      </div>

      {/* Field Details / ERD */}
      <div className="flex-1 bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden min-w-0">
        {showErd && erdData ? (
          <>
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-slate-50">
              <span className="text-xs font-medium text-slate-600">Entity Relationship Diagram</span>
              <button onClick={() => setShowErd(false)} className="text-xs text-slate-500 hover:text-slate-700">Close ERD</button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <ErdRenderer data={erdData} />
            </div>
          </>
        ) : selectedObject ? (
          <>
            <div className="px-4 py-2 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">{selectedObject}</span>
                <span className="text-xs text-slate-400">{fields.length} fields</span>
              </div>
              <input
                type="text"
                value={searchField}
                onChange={(e) => setSearchField(e.target.value)}
                placeholder="Search fields..."
                className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-300"
              />
            </div>

            {/* Relationships Summary */}
            {relationships && (relationships.parents.length > 0 || relationships.children.length > 0) && (
              <div className="px-4 py-2 border-b border-slate-100 bg-blue-50">
                <p className="text-[10px] font-medium text-blue-700 mb-1">Relationships</p>
                <div className="flex flex-wrap gap-1">
                  {relationships.parents.map((p, i) => (
                    <button key={i} onClick={() => selectObject(p.referenceTo)} className="text-[10px] px-1.5 py-0.5 bg-white border border-blue-200 rounded text-blue-600 hover:bg-blue-100">
                      {p.referenceTo} ({p.type})
                    </button>
                  ))}
                  {relationships.children.map((c, i) => (
                    <button key={i} onClick={() => selectObject(c.objectName)} className="text-[10px] px-1.5 py-0.5 bg-white border border-emerald-200 rounded text-emerald-600 hover:bg-emerald-100">
                      {c.objectName} (child)
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Fields Table */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    {[
                      { key: "fieldName", label: "Field" },
                      { key: "label", label: "Label" },
                      { key: "type", label: "Type" },
                      { key: "isRequired", label: "Req" },
                      { key: "isCustom", label: "Custom" },
                    ].map((col) => (
                      <th
                        key={col.key}
                        onClick={() => toggleSort(col.key)}
                        className="px-3 py-2 text-left font-medium text-slate-600 border-b border-slate-200 cursor-pointer hover:text-slate-800 whitespace-nowrap"
                      >
                        {col.label} {fieldSort.key === col.key && (fieldSort.asc ? "^" : "v")}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-left font-medium text-slate-600 border-b border-slate-200">Ref To</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600 border-b border-slate-200">Info</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFields.map((f) => (
                    <tr key={f.fieldName} className="hover:bg-slate-50 border-b border-slate-100">
                      <td className="px-3 py-1.5 font-mono text-slate-700">{f.fieldName}</td>
                      <td className="px-3 py-1.5 text-slate-500">{f.label}</td>
                      <td className="px-3 py-1.5">
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px]">{f.type}</span>
                        {f.length > 0 && <span className="text-[10px] text-slate-400 ml-1">({f.length})</span>}
                      </td>
                      <td className="px-3 py-1.5">{f.isRequired && <span className="text-red-500">*</span>}</td>
                      <td className="px-3 py-1.5">{f.isCustom && <span className="text-purple-500">C</span>}</td>
                      <td className="px-3 py-1.5 text-blue-500">{f.referenceTo.join(", ")}</td>
                      <td className="px-3 py-1.5 text-slate-400 max-w-[150px] truncate">
                        {f.isFormula && "Formula "}
                        {f.picklistValues.length > 0 && `Picklist(${f.picklistValues.length})`}
                        {f.description || ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
            Select an object to explore its fields and relationships
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ERD Renderer
// ═══════════════════════════════════════════════════════════════════════════

function ErdRenderer({ data }: { data: ErdData }) {
  if (data.nodes.length === 0) return <p className="text-sm text-slate-400 text-center">No objects to display</p>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.nodes.map((node) => (
          <div key={node.name} className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-blue-600 text-white text-xs font-medium">{node.name}</div>
            <div className="divide-y divide-slate-100 max-h-48 overflow-auto">
              {node.fields.slice(0, 20).map((f) => (
                <div key={f.name} className="px-3 py-1 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-700">{f.name}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-slate-400">{f.type}</span>
                    {f.referenceTo && <span className="text-[9px] text-blue-500">FK</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {data.edges.length > 0 && (
        <div className="bg-slate-50 rounded-lg p-3">
          <p className="text-xs font-medium text-slate-600 mb-2">Relationships</p>
          <div className="space-y-1">
            {data.edges.map((e, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="font-medium text-slate-700">{e.from}</span>
                <span className="text-slate-400">.{e.field}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] ${e.type === "master-detail" ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"}`}>
                  {e.type === "master-detail" ? "M-D" : "Lookup"}
                </span>
                <span className="font-medium text-slate-700">{e.to}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Record Browser
// ═══════════════════════════════════════════════════════════════════════════

function RecordBrowser() {
  const [objectName, setObjectName] = useState("Account");
  const [objectSearch, setObjectSearch] = useState("");
  const [objects, setObjects] = useState<SchemaObject[]>([]);
  const [fields, setFields] = useState<SchemaField[]>([]);
  const [selectedFields, setSelectedFields] = useState<string[]>(["Id", "Name"]);
  const [records, setRecords] = useState<any[]>([]);
  const [totalSize, setTotalSize] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [offset, setOffset] = useState(0);
  const [limit] = useState(50);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<any>(null);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [createValues, setCreateValues] = useState<Record<string, string>>({});
  const [showObjectPicker, setShowObjectPicker] = useState(false);

  useEffect(() => {
    api("/schema/objects").then((r) => r.json()).then((d) => setObjects(d.objects || [])).catch(() => {});
  }, []);

  useEffect(() => {
    loadFields();
  }, [objectName]);

  useEffect(() => {
    loadRecords();
  }, [objectName, selectedFields, offset]);

  const loadFields = async () => {
    try {
      const res = await api(`/schema/objects/${objectName}/fields`);
      const data = await res.json();
      const f = data.fields || [];
      setFields(f);
      const defaultFields = f.filter((fi: SchemaField) => ["Id", "Name", "Email", "Phone", "CreatedDate"].includes(fi.fieldName)).map((fi: SchemaField) => fi.fieldName);
      if (defaultFields.length < 2) defaultFields.push("Id");
      setSelectedFields(defaultFields.length > 0 ? defaultFields : ["Id"]);
    } catch {}
  };

  const loadRecords = async () => {
    setLoading(true);
    setError("");
    try {
      const fieldStr = selectedFields.join(", ");
      const res = await api(`/records/${objectName}?fields=${encodeURIComponent(fieldStr)}&limit=${limit}&offset=${offset}&orderBy=${selectedFields.includes("Name") ? "Name" : "Id"}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load records");
      setRecords(data.records || []);
      setTotalSize(data.totalSize || 0);
    } catch (e: any) {
      setError(e.message);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const globalSearch = async () => {
    if (!searchTerm.trim()) return;
    try {
      const res = await api(`/search?q=${encodeURIComponent(searchTerm)}`);
      const data = await res.json();
      setSearchResults(data);
    } catch {}
  };

  const toggleField = (fieldName: string) => {
    setSelectedFields((prev) => prev.includes(fieldName) ? prev.filter((f) => f !== fieldName) : [...prev, fieldName]);
    setOffset(0);
  };

  const startEdit = (record: any) => {
    setEditingRecord(record);
    const vals: Record<string, string> = {};
    for (const key of Object.keys(record)) {
      if (key !== "attributes" && key !== "Id") vals[key] = String(record[key] ?? "");
    }
    setEditValues(vals);
  };

  const saveEdit = async () => {
    if (!editingRecord) return;
    try {
      await api(`/records/${objectName}/${editingRecord.Id}`, { method: "PATCH", body: JSON.stringify(editValues) });
      setEditingRecord(null);
      loadRecords();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const deleteRecord = async (id: string) => {
    if (!confirm(`Delete this ${objectName} record?`)) return;
    try {
      await api(`/records/${objectName}/${id}`, { method: "DELETE" });
      loadRecords();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const createRecord = async () => {
    try {
      await api(`/records/${objectName}`, { method: "POST", body: JSON.stringify(createValues) });
      setShowCreate(false);
      setCreateValues({});
      loadRecords();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const filteredObjectList = objectSearch ? objects.filter((o) => o.name.toLowerCase().includes(objectSearch.toLowerCase())) : objects.slice(0, 50);

  return (
    <div className="space-y-3" style={{ height: "calc(100vh - 220px)" }}>
      {/* Top Bar */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            onClick={() => setShowObjectPicker(!showObjectPicker)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white hover:bg-slate-50 min-w-[180px] text-left"
          >
            {objectName}
          </button>
          {showObjectPicker && (
            <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-80 flex flex-col">
              <div className="p-2 border-b border-slate-100">
                <input
                  type="text"
                  value={objectSearch}
                  onChange={(e) => setObjectSearch(e.target.value)}
                  placeholder="Search objects..."
                  className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-300"
                  autoFocus
                />
              </div>
              <div className="flex-1 overflow-auto">
                {filteredObjectList.map((o) => (
                  <button
                    key={o.name}
                    onClick={() => { setObjectName(o.name); setShowObjectPicker(false); setOffset(0); }}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 border-b border-slate-50"
                  >
                    <span className="font-medium text-slate-700">{o.name}</span>
                    <span className="text-slate-400 ml-2">{o.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-1">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && globalSearch()}
            placeholder="Global SOSL search..."
            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <button onClick={globalSearch} className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Search</button>
        </div>

        <button onClick={() => setShowCreate(true)} className="px-3 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">New Record</button>
        <button onClick={loadRecords} className="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Reload</button>
      </div>

      {/* Field Picker */}
      <div className="flex flex-wrap gap-1 bg-white rounded-lg border border-slate-200 p-2">
        <span className="text-[10px] text-slate-500 mr-1 self-center">Columns:</span>
        {fields.slice(0, 40).map((f) => (
          <button
            key={f.fieldName}
            onClick={() => toggleField(f.fieldName)}
            className={`text-[10px] px-1.5 py-0.5 rounded border ${selectedFields.includes(f.fieldName) ? "bg-blue-100 border-blue-300 text-blue-700" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"}`}
          >
            {f.fieldName}
          </button>
        ))}
      </div>

      {error && <div className="p-2 text-sm text-red-600 bg-red-50 rounded-lg">{error}</div>}

      {/* SOSL Search Results */}
      {searchResults && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-purple-700">Search Results</span>
            <button onClick={() => setSearchResults(null)} className="text-xs text-purple-500 hover:text-purple-700">Close</button>
          </div>
          <pre className="text-xs text-slate-700 overflow-auto max-h-40">{JSON.stringify(searchResults, null, 2)}</pre>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-700">New {objectName}</span>
            <button onClick={() => setShowCreate(false)} className="text-xs text-slate-500 hover:text-slate-700">Cancel</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {fields.filter((f) => f.isCreateable && !["Id"].includes(f.fieldName)).slice(0, 20).map((f) => (
              <div key={f.fieldName}>
                <label className="text-[10px] text-slate-500">{f.label} {f.isRequired && <span className="text-red-500">*</span>}</label>
                {f.picklistValues.length > 0 ? (
                  <select
                    value={createValues[f.fieldName] || ""}
                    onChange={(e) => setCreateValues((prev) => ({ ...prev, [f.fieldName]: e.target.value }))}
                    className="w-full px-2 py-1 text-xs border border-slate-200 rounded-md"
                  >
                    <option value="">--</option>
                    {f.picklistValues.filter((p) => p.active).map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={createValues[f.fieldName] || ""}
                    onChange={(e) => setCreateValues((prev) => ({ ...prev, [f.fieldName]: e.target.value }))}
                    className="w-full px-2 py-1 text-xs border border-slate-200 rounded-md"
                    placeholder={f.type}
                  />
                )}
              </div>
            ))}
          </div>
          <button onClick={createRecord} className="mt-3 px-4 py-1.5 text-xs bg-emerald-600 text-white rounded-md hover:bg-emerald-700">Create</button>
        </div>
      )}

      {/* Edit Modal */}
      {editingRecord && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-700">Edit {objectName} - {editingRecord.Id}</span>
            <button onClick={() => setEditingRecord(null)} className="text-xs text-slate-500 hover:text-slate-700">Cancel</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(editValues).map(([key, val]) => {
              const fieldMeta = fields.find((f) => f.fieldName === key);
              if (!fieldMeta?.isUpdateable) return null;
              return (
                <div key={key}>
                  <label className="text-[10px] text-slate-500">{fieldMeta?.label || key}</label>
                  <input
                    type="text"
                    value={val}
                    onChange={(e) => setEditValues((prev) => ({ ...prev, [key]: e.target.value }))}
                    className="w-full px-2 py-1 text-xs border border-slate-200 rounded-md"
                  />
                </div>
              );
            })}
          </div>
          <button onClick={saveEdit} className="mt-3 px-4 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700">Save</button>
        </div>
      )}

      {/* Records Table */}
      <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col" style={{ minHeight: "300px" }}>
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-slate-50">
          <span className="text-xs font-medium text-slate-600">{objectName} Records ({totalSize} total)</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setOffset(Math.max(0, offset - limit))} disabled={offset === 0} className="text-xs text-slate-500 hover:text-slate-700 disabled:opacity-30">Prev</button>
            <span className="text-[10px] text-slate-400">{offset + 1}-{Math.min(offset + limit, totalSize)}</span>
            <button onClick={() => setOffset(offset + limit)} disabled={offset + limit >= totalSize} className="text-xs text-slate-500 hover:text-slate-700 disabled:opacity-30">Next</button>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="p-4 text-xs text-slate-400 text-center">Loading...</div>
          ) : records.length > 0 ? (
            <table className="w-full text-xs">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  {selectedFields.map((k) => (
                    <th key={k} className="px-3 py-2 text-left font-medium text-slate-600 border-b border-slate-200 whitespace-nowrap">{k}</th>
                  ))}
                  <th className="px-3 py-2 text-right font-medium text-slate-600 border-b border-slate-200">Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map((rec, i) => (
                  <tr key={rec.Id || i} className="hover:bg-slate-50 border-b border-slate-100">
                    {selectedFields.map((k) => (
                      <td key={k} className="px-3 py-1.5 text-slate-700 whitespace-nowrap max-w-[200px] truncate">
                        {typeof rec[k] === "object" && rec[k] !== null ? JSON.stringify(rec[k]) : String(rec[k] ?? "")}
                      </td>
                    ))}
                    <td className="px-3 py-1.5 text-right whitespace-nowrap">
                      <button onClick={() => startEdit(rec)} className="text-blue-500 hover:text-blue-700 mr-2">Edit</button>
                      <button onClick={() => deleteRecord(rec.Id)} className="text-red-400 hover:text-red-600">Del</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-4 text-sm text-slate-400 text-center">No records found</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Org Inspector
// ═══════════════════════════════════════════════════════════════════════════

function OrgInspector() {
  const [orgInfo, setOrgInfo] = useState<any>(null);
  const [limits, setLimits] = useState<LimitsData | null>(null);
  const [recordCounts, setRecordCounts] = useState<RecordCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<"limits" | "records" | "info">("limits");

  useEffect(() => {
    Promise.all([
      api("/org/info").then((r) => r.json()).then(setOrgInfo).catch(() => null),
      api("/org/limits").then((r) => r.json()).then(setLimits).catch(() => null),
    ]).then(() => setLoading(false));
  }, []);

  const loadRecordCounts = async () => {
    if (recordCounts.length > 0) return;
    try {
      const res = await api("/org/record-counts");
      const data = await res.json();
      setRecordCounts(data.counts || []);
    } catch {}
  };

  useEffect(() => {
    if (activeSection === "records") loadRecordCounts();
  }, [activeSection]);

  const keyLimits = limits
    ? Object.entries(limits)
        .filter(([_, v]) => v && typeof v.Max === "number" && v.Max > 0)
        .sort((a, b) => {
          const usedA = a[1].Max - a[1].Remaining;
          const usedB = b[1].Max - b[1].Remaining;
          return (usedB / b[1].Max) - (usedA / a[1].Max);
        })
    : [];

  if (loading) return <div className="p-8 text-center text-slate-400">Loading org information...</div>;

  return (
    <div className="space-y-4">
      {/* Org Summary */}
      {orgInfo && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-[10px] text-slate-400 uppercase">Organization</p>
              <p className="text-sm font-medium text-slate-700">{orgInfo.organization?.Name || "N/A"}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase">Type</p>
              <p className="text-sm font-medium text-slate-700">{orgInfo.organization?.OrganizationType || "N/A"}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase">Instance</p>
              <p className="text-sm font-medium text-slate-700">{orgInfo.organization?.InstanceName || "N/A"}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase">Sandbox</p>
              <p className="text-sm font-medium text-slate-700">{orgInfo.organization?.IsSandbox ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase">API Version</p>
              <p className="text-sm font-medium text-slate-700">{orgInfo.apiVersion || "N/A"}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase">User</p>
              <p className="text-sm font-medium text-slate-700">{orgInfo.identity?.display_name || "N/A"}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase">Instance URL</p>
              <p className="text-sm font-medium text-blue-600 truncate">{orgInfo.instanceUrl || "N/A"}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase">Namespace</p>
              <p className="text-sm font-medium text-slate-700">{orgInfo.organization?.NamespacePrefix || "None"}</p>
            </div>
          </div>
        </div>
      )}

      {/* Section Tabs */}
      <div className="flex gap-1">
        {(["limits", "records", "info"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setActiveSection(s)}
            className={`px-4 py-2 text-sm font-medium rounded-lg capitalize ${activeSection === s ? "bg-blue-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}
          >
            {s === "limits" ? "API Limits" : s === "records" ? "Record Counts" : "Full Info"}
          </button>
        ))}
      </div>

      {/* API Limits */}
      {activeSection === "limits" && limits && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-100 bg-slate-50">
            <span className="text-xs font-medium text-slate-600">API Limits ({keyLimits.length} metrics)</span>
          </div>
          <div className="divide-y divide-slate-100 max-h-[500px] overflow-auto">
            {keyLimits.map(([name, val]) => {
              const used = val.Max - val.Remaining;
              const pct = val.Max > 0 ? (used / val.Max) * 100 : 0;
              const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500";
              return (
                <div key={name} className="px-4 py-2.5 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-700 truncate">{name}</p>
                    <p className="text-[10px] text-slate-400">{used.toLocaleString()} / {val.Max.toLocaleString()} used</p>
                  </div>
                  <div className="w-32 shrink-0">
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                  </div>
                  <span className={`text-xs font-medium w-12 text-right ${pct >= 90 ? "text-red-600" : pct >= 70 ? "text-amber-600" : "text-emerald-600"}`}>
                    {pct.toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Record Counts */}
      {activeSection === "records" && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-100 bg-slate-50">
            <span className="text-xs font-medium text-slate-600">Record Counts by Object</span>
          </div>
          {recordCounts.length === 0 ? (
            <div className="p-4 text-xs text-slate-400 text-center">Loading record counts...</div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[500px] overflow-auto">
              {recordCounts.filter((c) => c.count > 0).map((c) => (
                <div key={c.name} className="px-4 py-2 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-medium text-slate-700">{c.name}</span>
                    <span className="text-[10px] text-slate-400 ml-2">{c.label}</span>
                  </div>
                  <span className="text-xs font-mono text-slate-600">{c.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Full Org Info */}
      {activeSection === "info" && orgInfo && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-100 bg-slate-50">
            <span className="text-xs font-medium text-slate-600">Raw Org Details</span>
          </div>
          <pre className="p-4 text-xs text-slate-700 overflow-auto max-h-[500px]">{JSON.stringify(orgInfo, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
