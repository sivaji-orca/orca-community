import { useState, useEffect } from "react";

type ScanPhase = "input" | "scanning" | "results" | "migrate-plan" | "migrate-execute" | "migrate-done";

interface Finding {
  severity: "critical" | "warning" | "info";
  category: string;
  ruleId: string;
  file: string;
  line: number;
  message: string;
  recommendation: string;
  autoFixable: boolean;
}

interface ScanResult {
  id: number;
  projectName: string;
  sourceUrl: string | null;
  findings: Finding[];
  healthScore: number;
  totalFindings: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  migrationReady: boolean;
  inventory: {
    muleXmlFiles: string[];
    propertiesFiles: string[];
    dwlFiles: string[];
    ramlFiles: string[];
    pomFiles: string[];
    flows: { name: string; file: string; type: string; lineCount: number }[];
    connectors: string[];
    endpoints: { path: string; method: string; file: string }[];
    dependencies: string[];
  };
}

interface ScanHistoryItem {
  id: number;
  project_name: string;
  source_url: string | null;
  scanned_at: string;
  total_findings: number;
  critical_count: number;
  warning_count: number;
  info_count: number;
  health_score: number;
  migration_ready: number;
}

interface MigrationPlan {
  inventorySummary: { flowCount: number; connectorCount: number; endpointCount: number; fileCount: number };
  restructureProposal: { currentApp: string; proposedApp: string; layer: string; flows: string[]; port: number }[];
  namingFixes: MigrationStep[];
  securityFixes: MigrationStep[];
  commonLibAdditions: MigrationStep[];
  testDocGeneration: MigrationStep[];
  allSteps: MigrationStep[];
}

interface MigrationStep {
  step: string;
  action: string;
  source: string;
  target: string;
  description: string;
  autoApply: boolean;
  enabled: boolean;
}

interface MigrationResult {
  status: string;
  created: string[];
  modified: string[];
  moved: string[];
  errors: string[];
  healthScoreBefore: number;
  healthScoreAfter: number;
}

function HealthGauge({ score }: { score: number }) {
  const color = score >= 80 ? "text-emerald-500" : score >= 50 ? "text-amber-500" : "text-red-500";
  const bgColor = score >= 80 ? "bg-emerald-50 border-emerald-200" : score >= 50 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className={`flex flex-col items-center p-6 rounded-xl border ${bgColor}`}>
      <svg width="140" height="140" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="54" fill="none" stroke="#e2e8f0" strokeWidth="8" />
        <circle
          cx="60" cy="60" r="54" fill="none"
          stroke="currentColor" strokeWidth="8" strokeLinecap="round"
          className={color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 60 60)"
          style={{ transition: "stroke-dashoffset 1s ease-out" }}
        />
        <text x="60" y="55" textAnchor="middle" className={`text-3xl font-bold ${color}`} fill="currentColor">{score}</text>
        <text x="60" y="75" textAnchor="middle" className="text-xs text-slate-400" fill="currentColor">/ 100</text>
      </svg>
      <p className="mt-2 text-sm font-semibold text-slate-700">Health Score</p>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: "bg-red-100 text-red-700 border-red-200",
    warning: "bg-amber-100 text-amber-700 border-amber-200",
    info: "bg-blue-100 text-blue-700 border-blue-200",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase border ${colors[severity] || colors.info}`}>
      {severity}
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const colors: Record<string, string> = {
    security: "bg-red-50 text-red-600",
    naming: "bg-purple-50 text-purple-600",
    structure: "bg-blue-50 text-blue-600",
    "best-practice": "bg-emerald-50 text-emerald-600",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${colors[category] || "bg-slate-50 text-slate-600"}`}>
      {category}
    </span>
  );
}

export function CodeScanner() {
  const [phase, setPhase] = useState<ScanPhase>("input");
  const [source, setSource] = useState("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [error, setError] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(["security", "naming", "structure", "best-practice"]));
  const [migrationPlan, setMigrationPlan] = useState<MigrationPlan | null>(null);
  const [migrationId, setMigrationId] = useState<number | null>(null);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [migrationError, setMigrationError] = useState("");

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem("orca_token");
      const res = await fetch("/api/scanner/history", {
        headers: { Authorization: `Bearer ${token}`, "X-Workspace-Id": localStorage.getItem("orca_active_workspace") || "1" },
      });
      if (res.ok) setHistory(await res.json());
    } catch { /* ignore */ }
  };

  const runScan = async () => {
    if (!source.trim()) return;
    setError("");
    setPhase("scanning");
    try {
      const token = localStorage.getItem("orca_token");
      const res = await fetch("/api/scanner/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "X-Workspace-Id": localStorage.getItem("orca_active_workspace") || "1" },
        body: JSON.stringify({ source: source.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Scan failed");
      }
      const data = await res.json();
      setScanResult(data);
      setPhase("results");
      fetchHistory();
    } catch (err: any) {
      setError(err.message);
      setPhase("input");
    }
  };

  const exportReport = () => {
    if (!scanResult) return;
    const blob = new Blob([JSON.stringify(scanResult, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${scanResult.projectName}-scan-report.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const startMigration = async () => {
    if (!scanResult) return;
    setMigrationError("");
    try {
      const token = localStorage.getItem("orca_token");
      const res = await fetch("/api/scanner/migrate/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "X-Workspace-Id": localStorage.getItem("orca_active_workspace") || "1" },
        body: JSON.stringify({ scanId: scanResult.id, sourcePath: source.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate plan");
      }
      const data = await res.json();
      setMigrationId(data.id);
      setMigrationPlan(data.plan);
      setPhase("migrate-plan");
    } catch (err: any) {
      setMigrationError(err.message);
    }
  };

  const executeMigrate = async () => {
    if (!migrationId) return;
    setMigrationError("");
    setPhase("migrate-execute");
    try {
      const token = localStorage.getItem("orca_token");
      const res = await fetch("/api/scanner/migrate/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "X-Workspace-Id": localStorage.getItem("orca_active_workspace") || "1" },
        body: JSON.stringify({ migrationId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Migration failed");
      }
      const result = await res.json();
      setMigrationResult(result);
      setPhase("migrate-done");
    } catch (err: any) {
      setMigrationError(err.message);
      setPhase("migrate-plan");
    }
  };

  const toggleStepEnabled = (index: number) => {
    if (!migrationPlan) return;
    const updated = { ...migrationPlan };
    updated.allSteps = [...updated.allSteps];
    updated.allSteps[index] = { ...updated.allSteps[index], enabled: !updated.allSteps[index].enabled };
    setMigrationPlan(updated);
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const groupedFindings = scanResult
    ? scanResult.findings.reduce((acc, f) => {
        if (!acc[f.category]) acc[f.category] = [];
        acc[f.category].push(f);
        return acc;
      }, {} as Record<string, Finding[]>)
    : {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Code Scanner</h2>
          <p className="text-sm text-slate-500">Analyze MuleSoft projects for security, naming, and structural issues</p>
        </div>
        {phase !== "input" && phase !== "scanning" && (
          <button
            onClick={() => { setPhase("input"); setScanResult(null); setMigrationPlan(null); setMigrationResult(null); setError(""); }}
            className="text-sm text-primary hover:text-primary-hover font-medium cursor-pointer"
          >
            New Scan
          </button>
        )}
      </div>

      {/* INPUT PHASE */}
      {phase === "input" && (
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Scan a MuleSoft Project</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Project Source</label>
                <input
                  type="text"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="/path/to/mule-project or https://github.com/org/repo.git"
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:border-primary focus:ring-2 focus:ring-primary-ring outline-none transition-all font-mono"
                  onKeyDown={(e) => e.key === "Enter" && runScan()}
                />
                <p className="text-xs text-slate-400 mt-1.5">Enter a local file path or a Git repository URL</p>
              </div>
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
              )}
              <button
                onClick={runScan}
                disabled={!source.trim()}
                className="px-6 py-2.5 bg-primary text-white rounded-lg font-semibold hover:bg-primary-hover transition-colors cursor-pointer disabled:opacity-50"
              >
                Scan Project
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Scan History</h3>
            {history.length === 0 ? (
              <p className="text-sm text-slate-400">No previous scans</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {history.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => setSource(h.source_url || h.project_name)}
                    className="w-full text-left px-3 py-2 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700 truncate">{h.project_name}</span>
                      <span className={`text-xs font-bold ${h.health_score >= 80 ? "text-emerald-600" : h.health_score >= 50 ? "text-amber-600" : "text-red-600"}`}>
                        {h.health_score}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-slate-400">{new Date(h.scanned_at).toLocaleDateString()}</span>
                      {h.critical_count > 0 && <span className="text-[10px] text-red-500">{h.critical_count} critical</span>}
                      {h.warning_count > 0 && <span className="text-[10px] text-amber-500">{h.warning_count} warnings</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SCANNING PHASE */}
      {phase === "scanning" && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="w-12 h-12 border-4 border-primary-bg border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-1">Scanning Project...</h3>
          <p className="text-sm text-slate-400">Analyzing Mule XML, properties, RAML, and DataWeave files</p>
        </div>
      )}

      {/* RESULTS PHASE */}
      {phase === "results" && scanResult && (
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <HealthGauge score={scanResult.healthScore} />
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Findings</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-red-600 font-medium">Critical</span>
                  <span className="text-lg font-bold text-red-600">{scanResult.criticalCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-amber-600 font-medium">Warning</span>
                  <span className="text-lg font-bold text-amber-600">{scanResult.warningCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-blue-600 font-medium">Info</span>
                  <span className="text-lg font-bold text-blue-600">{scanResult.infoCount}</span>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Inventory</p>
              <div className="space-y-1.5 text-sm">
                <p className="text-slate-600"><span className="font-medium">{scanResult.inventory.flows.length}</span> flows</p>
                <p className="text-slate-600"><span className="font-medium">{scanResult.inventory.connectors.length}</span> connectors</p>
                <p className="text-slate-600"><span className="font-medium">{scanResult.inventory.endpoints.length}</span> endpoints</p>
                <p className="text-slate-600"><span className="font-medium">{scanResult.inventory.muleXmlFiles.length}</span> XML files</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Actions</p>
              </div>
              <div className="space-y-2">
                <button
                  onClick={exportReport}
                  className="w-full px-3 py-2 border border-slate-200 text-sm rounded-lg font-medium text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  Export Report
                </button>
                <button
                  onClick={startMigration}
                  className="w-full px-3 py-2 bg-primary text-white text-sm rounded-lg font-semibold hover:bg-primary-hover cursor-pointer transition-colors"
                >
                  Migrate This Project
                </button>
                {migrationError && <p className="text-xs text-red-500">{migrationError}</p>}
              </div>
            </div>
          </div>

          {Object.keys(groupedFindings).length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-700">Findings by Category</h3>
              </div>
              {Object.entries(groupedFindings).map(([category, findings]) => (
                <div key={category} className="border-b border-slate-100 last:border-0">
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <CategoryBadge category={category} />
                      <span className="text-sm font-medium text-slate-700 capitalize">{category.replace("-", " ")}</span>
                      <span className="text-xs text-slate-400">{findings.length} finding{findings.length !== 1 ? "s" : ""}</span>
                    </div>
                    <svg className={`w-4 h-4 text-slate-400 transition-transform ${expandedCategories.has(category) ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {expandedCategories.has(category) && (
                    <div className="px-5 pb-4">
                      <div className="space-y-2">
                        {findings.map((f, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                            <SeverityBadge severity={f.severity} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono text-slate-400">{f.ruleId}</span>
                                {f.autoFixable && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-200 font-medium">auto-fixable</span>
                                )}
                              </div>
                              <p className="text-sm text-slate-700 mt-0.5">{f.message}</p>
                              <p className="text-xs text-slate-400 mt-1">{f.file}{f.line > 0 ? `:${f.line}` : ""}</p>
                              <p className="text-xs text-primary mt-1">{f.recommendation}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MIGRATION PLAN PHASE */}
      {phase === "migrate-plan" && migrationPlan && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-1">Migration Plan</h3>
            <p className="text-sm text-slate-500 mb-6">Review and customize the migration steps before executing.</p>

            <div className="grid grid-cols-4 gap-3 mb-6">
              <div className="bg-slate-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-slate-700">{migrationPlan.inventorySummary.flowCount}</p>
                <p className="text-xs text-slate-400">Flows</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-slate-700">{migrationPlan.inventorySummary.connectorCount}</p>
                <p className="text-xs text-slate-400">Connectors</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-slate-700">{migrationPlan.inventorySummary.endpointCount}</p>
                <p className="text-xs text-slate-400">Endpoints</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-slate-700">{migrationPlan.inventorySummary.fileCount}</p>
                <p className="text-xs text-slate-400">Files</p>
              </div>
            </div>

            {migrationPlan.restructureProposal.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-slate-700 mb-3">Restructure Proposal (API-led Layers)</h4>
                <div className="space-y-2">
                  {migrationPlan.restructureProposal.map((r, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-blue-50 border border-blue-100">
                      <div>
                        <span className="text-sm font-medium text-blue-800">{r.proposedApp}</span>
                        <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 font-semibold uppercase">{r.layer}</span>
                      </div>
                      <span className="text-xs text-blue-500">{r.flows.length} flows{r.port > 0 ? `, port ${r.port}` : ""}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-6">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Migration Steps ({migrationPlan.allSteps.filter(s => s.enabled).length} / {migrationPlan.allSteps.length} enabled)</h4>
              <div className="space-y-1.5 max-h-80 overflow-y-auto">
                {migrationPlan.allSteps.map((step, i) => (
                  <label key={i} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${step.enabled ? "bg-white border-slate-200" : "bg-slate-50 border-slate-100 opacity-60"}`}>
                    <input
                      type="checkbox"
                      checked={step.enabled}
                      onChange={() => toggleStepEnabled(i)}
                      className="mt-0.5 accent-primary"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase ${
                          step.step === "security" ? "bg-red-50 text-red-600" :
                          step.step === "naming" ? "bg-purple-50 text-purple-600" :
                          step.step === "common-libs" ? "bg-blue-50 text-blue-600" :
                          "bg-emerald-50 text-emerald-600"
                        }`}>{step.step}</span>
                        <span className="text-[10px] text-slate-400 uppercase">{step.action}</span>
                      </div>
                      <p className="text-sm text-slate-700 mt-0.5">{step.description}</p>
                      {step.source && step.target && step.source !== step.target && (
                        <p className="text-xs text-slate-400 mt-0.5 font-mono">{step.source} → {step.target}</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {migrationError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 mb-4">{migrationError}</div>
            )}

            <div className="flex items-center justify-between">
              <button onClick={() => setPhase("results")} className="text-sm text-slate-500 hover:text-slate-700 cursor-pointer">
                Back to Results
              </button>
              <button
                onClick={executeMigrate}
                className="px-6 py-2.5 bg-primary text-white rounded-lg font-semibold hover:bg-primary-hover transition-colors cursor-pointer"
              >
                Execute Migration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MIGRATION EXECUTING PHASE */}
      {phase === "migrate-execute" && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="w-12 h-12 border-4 border-primary-bg border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-1">Executing Migration...</h3>
          <p className="text-sm text-slate-400">Applying changes and generating files</p>
        </div>
      )}

      {/* MIGRATION DONE PHASE */}
      {phase === "migrate-done" && migrationResult && (
        <div className="space-y-6">
          <div className={`bg-white rounded-xl border p-6 ${migrationResult.status === "completed" ? "border-emerald-200" : "border-red-200"}`}>
            <div className="flex items-center gap-3 mb-6">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${migrationResult.status === "completed" ? "bg-emerald-500" : "bg-red-500"} text-white`}>
                {migrationResult.status === "completed" ? (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Migration {migrationResult.status === "completed" ? "Complete" : "Failed"}</h3>
                <p className="text-sm text-slate-500">{migrationResult.created.length} created, {migrationResult.modified.length} modified, {migrationResult.moved.length} moved</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-50 rounded-lg p-4 text-center">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Before</p>
                <p className={`text-3xl font-bold ${migrationResult.healthScoreBefore >= 60 ? "text-amber-500" : "text-red-500"}`}>{migrationResult.healthScoreBefore}</p>
              </div>
              <div className="bg-emerald-50 rounded-lg p-4 text-center">
                <p className="text-xs text-emerald-500 uppercase tracking-wider mb-1">After</p>
                <p className="text-3xl font-bold text-emerald-600">{migrationResult.healthScoreAfter}</p>
              </div>
            </div>

            {migrationResult.created.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Created Files</h4>
                <div className="space-y-1">
                  {migrationResult.created.map((f, i) => (
                    <p key={i} className="text-xs font-mono text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded">+ {f}</p>
                  ))}
                </div>
              </div>
            )}

            {migrationResult.moved.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Moved / Renamed</h4>
                <div className="space-y-1">
                  {migrationResult.moved.map((m, i) => (
                    <p key={i} className="text-xs font-mono text-blue-600 bg-blue-50 px-3 py-1.5 rounded">{m}</p>
                  ))}
                </div>
              </div>
            )}

            {migrationResult.errors.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-red-700 mb-2">Errors</h4>
                <div className="space-y-1">
                  {migrationResult.errors.map((e, i) => (
                    <p key={i} className="text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded">{e}</p>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => { setPhase("input"); setScanResult(null); setMigrationPlan(null); setMigrationResult(null); }}
              className="mt-4 px-6 py-2.5 bg-primary text-white rounded-lg font-semibold hover:bg-primary-hover transition-colors cursor-pointer"
            >
              Start New Scan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
