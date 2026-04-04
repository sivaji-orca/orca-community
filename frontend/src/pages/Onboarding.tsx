import { useState, useEffect, useCallback } from "react";

interface Prerequisite {
  name: string;
  label: string;
  required: boolean;
  installed: boolean;
  version: string;
  meetsMinimum: boolean;
  description: string;
  installCommand: Record<string, string>;
}

interface PrereqResponse {
  os: string;
  prerequisites: Prerequisite[];
  requiredPassed: boolean;
  allPassed: boolean;
}

interface InstallGuide {
  tool: string;
  os: string;
  steps: string[];
  command: string;
  docs: string;
}

interface OnboardingProps {
  onComplete: () => void;
}

type Step = "brand" | "welcome" | "check" | "install" | "configure" | "ready";

const STEPS: { id: Step; label: string }[] = [
  { id: "brand", label: "Brand" },
  { id: "welcome", label: "Welcome" },
  { id: "check", label: "Prerequisites" },
  { id: "install", label: "Install" },
  { id: "configure", label: "Configure" },
  { id: "ready", label: "Ready" },
];

function StepIndicator({ current, onNavigate }: { current: Step; onNavigate: (s: Step) => void }) {
  const currentIdx = STEPS.findIndex((s) => s.id === current);
  return (
    <div className="flex items-center justify-center gap-2 mb-10">
      {STEPS.map((step, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        const clickable = done;
        return (
          <div key={step.id} className="flex items-center gap-2">
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onNavigate(step.id)}
              title={clickable ? `Go back to ${step.label}` : step.label}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                done
                  ? "bg-emerald-500 text-white hover:bg-emerald-600 cursor-pointer"
                  : active
                    ? "bg-primary text-white ring-4 ring-primary-bg cursor-default"
                    : "bg-slate-200 text-slate-500 cursor-default"
              }`}
            >
              {done ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                i + 1
              )}
            </button>
            {i < STEPS.length - 1 && (
              <div className={`w-8 h-0.5 ${i < currentIdx ? "bg-emerald-400" : "bg-slate-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* fallback ignored */ }
  };
  return (
    <button
      onClick={handleCopy}
      className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-md bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors cursor-pointer"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState<Step>("brand");
  const [prereqs, setPrereqs] = useState<PrereqResponse | null>(null);
  const [checking, setChecking] = useState(false);
  const [guides, setGuides] = useState<Record<string, InstallGuide>>({});

  const [brandName, setBrandName] = useState("");
  const [brandDescription, setBrandDescription] = useState("");
  const [brandLogoPreview, setBrandLogoPreview] = useState<string | null>(null);
  const [brandSaving, setBrandSaving] = useState(false);
  const [loadingGuide, setLoadingGuide] = useState<string | null>(null);

  const [configForm, setConfigForm] = useState({
    anypoint_client_id: "",
    anypoint_client_secret: "",
    anypoint_org_id: "",
    github_token: "",
    postman_api_key: "",
    salesforce_instance_url: "",
    salesforce_username: "",
    salesforce_password: "",
    salesforce_security_token: "",
    neon_database_url: "",
    kafka_bootstrap_servers: "",
    kafka_api_key: "",
    kafka_api_secret: "",
    kafka_schema_registry_url: "",
    kafka_sr_api_key: "",
    kafka_sr_api_secret: "",
  });
  const [configSaving, setConfigSaving] = useState(false);
  const [configResult, setConfigResult] = useState<{ success: boolean; message: string; details: string[] } | null>(null);
  const [configSection, setConfigSection] = useState<"anypoint" | "salesforce" | "neon" | "kafka" | "more">("anypoint");
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [neonTesting, setNeonTesting] = useState(false);
  const [neonTestResult, setNeonTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [kafkaTesting, setKafkaTesting] = useState(false);
  const [kafkaTestResult, setKafkaTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const checkPrereqs = useCallback(async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/system/prerequisites");
      const data: PrereqResponse = await res.json();
      setPrereqs(data);
    } catch {
      // retry silently
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (step === "check") {
      checkPrereqs();
    }
  }, [step, checkPrereqs]);

  const fetchGuide = async (tool: string) => {
    if (guides[tool]) return;
    setLoadingGuide(tool);
    try {
      const res = await fetch("/api/system/install-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool }),
      });
      const data: InstallGuide = await res.json();
      setGuides((prev) => ({ ...prev, [tool]: data }));
    } catch { /* ignored */ }
    finally { setLoadingGuide(null); }
  };

  const saveCredentials = async () => {
    setConfigSaving(true);
    setConfigResult(null);
    try {
      const body: Record<string, Record<string, string>> = {};
      if (configForm.anypoint_client_id || configForm.anypoint_client_secret || configForm.anypoint_org_id) {
        body.anypoint = {};
        if (configForm.anypoint_client_id) body.anypoint.client_id = configForm.anypoint_client_id;
        if (configForm.anypoint_client_secret) body.anypoint.client_secret = configForm.anypoint_client_secret;
        if (configForm.anypoint_org_id) body.anypoint.org_id = configForm.anypoint_org_id;
      }
      if (configForm.github_token) body.github = { token: configForm.github_token };
      if (configForm.postman_api_key) body.postman = { api_key: configForm.postman_api_key };
      if (configForm.salesforce_instance_url || configForm.salesforce_username || configForm.salesforce_password || configForm.salesforce_security_token) {
        body.salesforce = {};
        if (configForm.salesforce_instance_url) body.salesforce.instance_url = configForm.salesforce_instance_url;
        if (configForm.salesforce_username) body.salesforce.username = configForm.salesforce_username;
        if (configForm.salesforce_password) body.salesforce.password = configForm.salesforce_password;
        if (configForm.salesforce_security_token) body.salesforce.security_token = configForm.salesforce_security_token;
      }
      if (configForm.neon_database_url) {
        body.neon = { database_url: configForm.neon_database_url };
      }
      if (configForm.kafka_bootstrap_servers || configForm.kafka_api_key || configForm.kafka_api_secret || configForm.kafka_schema_registry_url || configForm.kafka_sr_api_key || configForm.kafka_sr_api_secret) {
        body.kafka = {};
        if (configForm.kafka_bootstrap_servers) body.kafka.bootstrap_servers = configForm.kafka_bootstrap_servers;
        if (configForm.kafka_api_key) body.kafka.api_key = configForm.kafka_api_key;
        if (configForm.kafka_api_secret) body.kafka.api_secret = configForm.kafka_api_secret;
        if (configForm.kafka_schema_registry_url) body.kafka.schema_registry_url = configForm.kafka_schema_registry_url;
        if (configForm.kafka_sr_api_key) body.kafka.schema_registry_api_key = configForm.kafka_sr_api_key;
        if (configForm.kafka_sr_api_secret) body.kafka.schema_registry_api_secret = configForm.kafka_sr_api_secret;
      }

      const res = await fetch("/api/system/configure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setConfigResult(data);
    } catch {
      setConfigResult({ success: false, message: "Network error — is the backend running?", details: [] });
    } finally {
      setConfigSaving(false);
    }
  };

  const toggleSecret = (field: string) =>
    setShowSecrets((prev) => ({ ...prev, [field]: !prev[field] }));

  const hasAnyCredential =
    configForm.anypoint_client_id.trim() !== "" || configForm.anypoint_client_secret.trim() !== "";

  const failingRequired = prereqs?.prerequisites.filter(
    (p) => p.required && (!p.installed || !p.meetsMinimum)
  ) ?? [];

  const failingOptional = prereqs?.prerequisites.filter(
    (p) => !p.required && !p.installed
  ) ?? [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-bg-subtle via-white to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <StepIndicator current={step} onNavigate={setStep} />

        {/* ===== STEP 0: BRAND YOUR APP ===== */}
        {step === "brand" && (
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-10">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary-bg">
                <span className="text-white font-bold text-2xl">{brandName?.[0]?.toUpperCase() || "O"}</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-800 mb-1">Brand Your App</h1>
              <p className="text-sm text-slate-500">
                Give your instance a name and identity, or keep the defaults.
              </p>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">App Name</label>
                <input
                  type="text"
                  placeholder="e.g. Dhurandhar, Apex Tools, MyOrg Integrations"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:border-primary focus:ring-2 focus:ring-primary-ring outline-none transition-all"
                  autoFocus
                />
                <p className="text-xs text-slate-400 mt-1">This will appear in the header, login screen, and page title.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
                <textarea
                  placeholder="MuleSoft Developer Productivity Tool"
                  value={brandDescription}
                  onChange={(e) => setBrandDescription(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:border-primary focus:ring-2 focus:ring-primary-ring outline-none transition-all resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Logo <span className="text-slate-400 font-normal">(optional SVG)</span>
                </label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 px-4 py-2 border border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-primary hover:text-primary cursor-pointer transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Upload SVG
                    <input
                      type="file"
                      accept=".svg"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => setBrandLogoPreview(reader.result as string);
                        reader.readAsText(file);
                      }}
                    />
                  </label>
                  {brandLogoPreview && (
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden bg-white" dangerouslySetInnerHTML={{ __html: brandLogoPreview }} />
                      <button onClick={() => setBrandLogoPreview(null)} className="text-xs text-red-500 hover:text-red-600 cursor-pointer">Remove</button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-8">
              <button
                onClick={() => setStep("welcome")}
                className="text-sm text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                Skip (use Orca defaults)
              </button>
              <button
                onClick={async () => {
                  if (!brandName.trim()) {
                    setStep("welcome");
                    return;
                  }
                  setBrandSaving(true);
                  try {
                    await fetch("/api/branding", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        appName: brandName.trim(),
                        description: brandDescription.trim() || undefined,
                        logoSvg: brandLogoPreview || undefined,
                      }),
                    });
                  } catch { /* best-effort */ }
                  setBrandSaving(false);
                  setStep("welcome");
                }}
                disabled={brandSaving}
                className="px-6 py-2.5 bg-primary text-white rounded-lg font-semibold hover:bg-primary-hover transition-colors cursor-pointer disabled:opacity-50"
              >
                {brandSaving ? "Saving..." : "Continue"}
              </button>
            </div>
          </div>
        )}

        {/* ===== STEP 1: WELCOME ===== */}
        {step === "welcome" && (
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-10 text-center">
            <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary-bg">
              <span className="text-white font-bold text-3xl">O</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-800 mb-2">
              Welcome to Orca Community Edition
            </h1>
            <p className="text-slate-500 mb-2">
              The open-source MuleSoft developer productivity toolkit
            </p>
            <p className="text-sm text-slate-400 mb-8 max-w-md mx-auto">
              Let's get you set up in under 5 minutes. We'll check your system,
              install any missing tools, and have you building your first API in no time.
            </p>
            <button
              onClick={() => setStep("check")}
              className="px-8 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary-hover transition-colors shadow-md shadow-primary-bg cursor-pointer text-lg"
            >
              Let's Go
            </button>
            <button
              onClick={onComplete}
              className="block mx-auto mt-4 text-sm text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              Skip setup — I know what I'm doing
            </button>
          </div>
        )}

        {/* ===== STEP 2: PREREQUISITE CHECK ===== */}
        {step === "check" && (
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
            <h2 className="text-xl font-bold text-slate-800 mb-1">System Prerequisites</h2>
            <p className="text-sm text-slate-500 mb-6">
              Checking your development environment...
            </p>

            {checking && !prereqs && (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-primary-bg border-t-primary rounded-full animate-spin" />
                <span className="ml-3 text-slate-500">Scanning your system...</span>
              </div>
            )}

            {prereqs && (() => {
              const required = prereqs.prerequisites.filter((p) => p.required);
              const optional = prereqs.prerequisites.filter((p) => !p.required);
              return (
                <>
                  <div className="space-y-3 mb-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Required</p>
                    {required.map((p) => {
                      const passed = p.installed && p.meetsMinimum;
                      return (
                        <div
                          key={p.name}
                          className={`flex items-center justify-between rounded-xl border p-4 transition-all ${
                            passed ? "border-emerald-200 bg-emerald-50/50" : "border-red-200 bg-red-50/50"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${passed ? "bg-emerald-500 text-white" : "bg-red-500 text-white"}`}>
                              {passed ? (
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                              ) : (
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                              )}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-800 text-sm">{p.label}</div>
                              <div className="text-xs text-slate-500">{p.description}</div>
                            </div>
                          </div>
                          <div className="text-right shrink-0 ml-4">
                            {passed ? (
                              <span className="text-sm font-medium text-emerald-700">{p.version}</span>
                            ) : (
                              <span className="text-sm font-medium text-red-600">{p.installed ? `v${p.version} (too old)` : "Missing"}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {optional.length > 0 && (
                    <div className="space-y-3 mb-6">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Optional</p>
                      {optional.map((p) => {
                        const passed = p.installed && p.meetsMinimum;
                        return (
                          <div
                            key={p.name}
                            className={`flex items-center justify-between rounded-xl border p-4 transition-all ${
                              passed ? "border-emerald-200 bg-emerald-50/50" : "border-sky-200 bg-sky-50/50"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${passed ? "bg-emerald-500 text-white" : "bg-sky-400 text-white"}`}>
                                {passed ? (
                                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                ) : (
                                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
                                  </svg>
                                )}
                              </div>
                              <div>
                                <div className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                                  {p.label}
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-600 font-medium">optional</span>
                                </div>
                                <div className="text-xs text-slate-500">{p.description}</div>
                              </div>
                            </div>
                            <div className="text-right shrink-0 ml-4">
                              {passed ? (
                                <span className="text-sm font-medium text-emerald-700">{p.version}</span>
                              ) : (
                                <span className="text-sm font-medium text-sky-600">Not installed yet</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      <p className="text-xs text-slate-400 pl-1">
                        These are downloaded automatically when you run <code className="bg-slate-100 px-1 rounded">./scripts/setup.sh</code>. You can explore the dashboard without them.
                      </p>
                    </div>
                  )}
                </>
              );
            })()}

            {prereqs && prereqs.requiredPassed && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 mb-6 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-emerald-800 text-sm">All required tools are installed!</p>
                  <p className="text-xs text-emerald-600">
                    {prereqs.allPassed
                      ? "Optional tools are also ready."
                      : "Some optional tools are missing but you can still get started."}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <button
                onClick={() => setStep("welcome")}
                className="text-sm text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                &larr; Back
              </button>
              <div className="flex gap-3">
                <button
                  onClick={checkPrereqs}
                  disabled={checking}
                  className="px-4 py-2 border border-slate-300 text-slate-600 text-sm rounded-lg hover:bg-slate-50 disabled:opacity-50 font-medium cursor-pointer"
                >
                  {checking ? "Checking..." : "Re-check"}
                </button>
                {prereqs?.requiredPassed ? (
                  <button
                    onClick={() => setStep("configure")}
                    className="px-6 py-2 bg-primary text-white text-sm rounded-lg font-semibold hover:bg-primary-hover cursor-pointer"
                  >
                    Continue
                  </button>
                ) : prereqs && !prereqs.requiredPassed ? (
                  <button
                    onClick={() => {
                      failingRequired.forEach((p) => fetchGuide(p.name));
                      setStep("install");
                    }}
                    className="px-6 py-2 bg-red-600 text-white text-sm rounded-lg font-semibold hover:bg-red-700 cursor-pointer"
                  >
                    Fix {failingRequired.length} Missing Tool{failingRequired.length > 1 ? "s" : ""}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* ===== STEP 3: INSTALL MISSING TOOLS ===== */}
        {step === "install" && (
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
            <h2 className="text-xl font-bold text-slate-800 mb-1">Install Missing Tools</h2>
            <p className="text-sm text-slate-500 mb-6">
              Run these commands in your terminal, then come back and re-check.
            </p>

            {failingRequired.length > 0 && (
              <div className="space-y-4 mb-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-red-500">Required — install these first</p>
                {failingRequired.map((p) => {
                  const guide = guides[p.name];
                  const osKey = prereqs?.os || "macos";
                  const command = p.installCommand[osKey] || Object.values(p.installCommand)[0];
                  return (
                    <div key={p.name} className="rounded-xl border border-red-200 bg-red-50/30 p-5">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-semibold text-slate-800">{p.label}</span>
                        {!guide && (
                          <button onClick={() => fetchGuide(p.name)} disabled={loadingGuide === p.name} className="text-xs text-primary hover:text-primary-hover font-medium cursor-pointer">
                            {loadingGuide === p.name ? "Loading..." : "More details"}
                          </button>
                        )}
                      </div>
                      <div className="bg-slate-900 rounded-lg p-3 flex items-center justify-between gap-3">
                        <code className="text-sm text-emerald-400 font-mono break-all">{command}</code>
                        <CopyButton text={command} />
                      </div>
                      {guide && (
                        <div className="mt-3 space-y-1.5">
                          {guide.steps.map((s, i) => (
                            <p key={i} className="text-xs text-slate-600 flex gap-2">
                              <span className="text-slate-400 shrink-0">{i + 1}.</span>
                              <span className="whitespace-pre-wrap">{s}</span>
                            </p>
                          ))}
                          <a href={guide.docs} target="_blank" rel="noopener noreferrer" className="inline-block text-xs text-primary hover:text-primary-hover mt-1">Official docs &rarr;</a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {failingOptional.length > 0 && (
              <details className="mb-6 rounded-xl border border-sky-200 bg-sky-50/30">
                <summary className="px-5 py-3 cursor-pointer text-sm font-medium text-sky-700 hover:text-sky-800">
                  Optional tools ({failingOptional.length} not installed) — expand for install commands
                </summary>
                <div className="px-5 pb-5 space-y-4 pt-2">
                  <p className="text-xs text-slate-500">These are auto-downloaded by <code className="bg-slate-100 px-1 rounded">./scripts/setup.sh</code>. Install them later when you need local Mule Runtime.</p>
                  {failingOptional.map((p) => {
                    const osKey = prereqs?.os || "macos";
                    const command = p.installCommand[osKey] || Object.values(p.installCommand)[0];
                    return (
                      <div key={p.name} className="rounded-lg border border-sky-100 bg-white p-4">
                        <span className="font-semibold text-slate-800 text-sm">{p.label}</span>
                        <div className="bg-slate-900 rounded-lg p-3 mt-2 flex items-center justify-between gap-3">
                          <code className="text-sm text-emerald-400 font-mono break-all">{command}</code>
                          <CopyButton text={command} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>
            )}

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 mb-6">
              <p className="text-sm text-slate-600">
                <strong className="text-slate-700">Using Cursor IDE?</strong>{" "}
                Open the terminal panel (Ctrl+`) and paste the commands above. The Cursor agent can also run them for you —
                just say <em>"install Java 17 and Maven"</em>.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={() => setStep("check")}
                className="text-sm text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                &larr; Back
              </button>
              <button
                onClick={() => setStep("check")}
                className="px-6 py-2 bg-primary text-white text-sm rounded-lg font-semibold hover:bg-primary-hover cursor-pointer"
              >
                Re-check Prerequisites
              </button>
            </div>
          </div>
        )}

        {/* ===== STEP 4: CONFIGURE ===== */}
        {step === "configure" && (
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
            <h2 className="text-xl font-bold text-slate-800 mb-1">Configure Credentials</h2>
            <p className="text-sm text-slate-500 mb-6">
              Connect to MuleSoft Anypoint Platform directly from here — no terminal needed.
            </p>

            {/* Section tabs */}
            <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1">
              {(
                [
                  { id: "anypoint" as const, label: "Anypoint", icon: "M" },
                  { id: "salesforce" as const, label: "Salesforce", icon: "SF" },
                  { id: "neon" as const, label: "Neon PG", icon: "N" },
                  { id: "kafka" as const, label: "Kafka", icon: "K" },
                  { id: "more" as const, label: "Git & PM", icon: "+" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setConfigSection(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all cursor-pointer ${
                    configSection === tab.id
                      ? "bg-white text-slate-800 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <span className="w-5 h-5 rounded bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">
                    {tab.icon}
                  </span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Anypoint section */}
            {configSection === "anypoint" && (
              <div className="space-y-4 mb-6">
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                  <p className="text-sm text-amber-800">
                    <strong>Where do I get these?</strong>{" "}
                    Log in to{" "}
                    <a
                      href="https://anypoint.mulesoft.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-medium"
                    >
                      anypoint.mulesoft.com
                    </a>
                    {" "}&rarr; Access Management &rarr; Connected Apps &rarr; Create a new app with{" "}
                    <em>Client Credentials</em> grant type.{" "}
                    <a
                      href="https://docs.mulesoft.com/access-management/connected-apps-overview"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-medium"
                    >
                      Full guide
                    </a>.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Client ID</label>
                  <input
                    type="text"
                    placeholder="e.g. a1b2c3d4e5f6a1b2c3d4e5f6"
                    value={configForm.anypoint_client_id}
                    onChange={(e) => setConfigForm((f) => ({ ...f, anypoint_client_id: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:border-primary focus:ring-2 focus:ring-primary-bg outline-none transition-all font-mono"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Client Secret</label>
                  <div className="relative">
                    <input
                      type={showSecrets["client_secret"] ? "text" : "password"}
                      placeholder="e.g. A1b2C3d4E5f6G7h8I9j0..."
                      value={configForm.anypoint_client_secret}
                      onChange={(e) => setConfigForm((f) => ({ ...f, anypoint_client_secret: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:border-primary focus:ring-2 focus:ring-primary-bg outline-none transition-all font-mono pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => toggleSecret("client_secret")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      title={showSecrets["client_secret"] ? "Hide" : "Show"}
                    >
                      {showSecrets["client_secret"] ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M3 3l18 18" /></svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Organization ID <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 12345678-abcd-1234-abcd-123456789012"
                    value={configForm.anypoint_org_id}
                    onChange={(e) => setConfigForm((f) => ({ ...f, anypoint_org_id: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:border-primary focus:ring-2 focus:ring-primary-bg outline-none transition-all font-mono"
                  />
                </div>
              </div>
            )}

            {/* Salesforce section */}
            {configSection === "salesforce" && (
              <div className="space-y-4 mb-6">
                <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Need a Salesforce Developer account?</strong>{" "}
                    <a href="https://developer.salesforce.com/signup" target="_blank" rel="noopener noreferrer" className="underline font-medium">Sign up free</a>.
                    Then go to Setup &rarr; My Personal Information &rarr;{" "}
                    <a href="https://help.salesforce.com/s/articleView?id=sf.user_security_token.htm" target="_blank" rel="noopener noreferrer" className="underline font-medium">Reset Security Token</a>.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Instance URL</label>
                  <input
                    type="text"
                    placeholder="https://your-org.develop.my.salesforce.com"
                    value={configForm.salesforce_instance_url}
                    onChange={(e) => setConfigForm((f) => ({ ...f, salesforce_instance_url: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:border-primary focus:ring-2 focus:ring-primary-bg outline-none transition-all font-mono"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Username</label>
                  <input
                    type="text"
                    placeholder="you@example.com"
                    value={configForm.salesforce_username}
                    onChange={(e) => setConfigForm((f) => ({ ...f, salesforce_username: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:border-primary focus:ring-2 focus:ring-primary-bg outline-none transition-all font-mono"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                  <div className="relative">
                    <input
                      type={showSecrets["sf_password"] ? "text" : "password"}
                      placeholder="Your Salesforce password"
                      value={configForm.salesforce_password}
                      onChange={(e) => setConfigForm((f) => ({ ...f, salesforce_password: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:border-primary focus:ring-2 focus:ring-primary-bg outline-none transition-all font-mono pr-12"
                    />
                    <button type="button" onClick={() => toggleSecret("sf_password")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
                      {showSecrets["sf_password"] ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M3 3l18 18" /></svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Security Token</label>
                  <div className="relative">
                    <input
                      type={showSecrets["sf_token"] ? "text" : "password"}
                      placeholder="Emailed to you after reset"
                      value={configForm.salesforce_security_token}
                      onChange={(e) => setConfigForm((f) => ({ ...f, salesforce_security_token: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:border-primary focus:ring-2 focus:ring-primary-bg outline-none transition-all font-mono pr-12"
                    />
                    <button type="button" onClick={() => toggleSecret("sf_token")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
                      {showSecrets["sf_token"] ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M3 3l18 18" /></svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Go to Setup &rarr; Reset My Security Token. Check your email.</p>
                </div>
              </div>
            )}

            {/* Neon PostgreSQL section */}
            {configSection === "neon" && (
              <div className="space-y-4 mb-6">
                <div className="rounded-xl border border-green-200 bg-green-50/50 p-4">
                  <p className="text-sm text-green-800">
                    <strong>Need a Neon account?</strong>{" "}
                    <a href="https://neon.tech" target="_blank" rel="noopener noreferrer" className="underline font-medium">Sign up free at neon.tech</a>{" "}
                    (no credit card required, 0.5 GB free). Copy your connection string from the Neon dashboard.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Database Connection URL</label>
                  <div className="relative">
                    <input
                      type={showSecrets["neon_url"] ? "text" : "password"}
                      placeholder="postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require"
                      value={configForm.neon_database_url}
                      onChange={(e) => setConfigForm((f) => ({ ...f, neon_database_url: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:border-primary focus:ring-2 focus:ring-primary-bg outline-none transition-all font-mono pr-12"
                    />
                    <button type="button" onClick={() => toggleSecret("neon_url")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
                      {showSecrets["neon_url"] ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M3 3l18 18" /></svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Find it in your Neon dashboard &rarr; Connection Details &rarr; Connection string.</p>
                </div>

                <button
                  onClick={async () => {
                    setNeonTesting(true);
                    setNeonTestResult(null);
                    try {
                      if (configForm.neon_database_url) {
                        await fetch("/api/system/configure", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ neon: { database_url: configForm.neon_database_url } }),
                        });
                      }
                      const res = await fetch("/api/system/test-neon");
                      const data = await res.json();
                      setNeonTestResult(data);
                    } catch {
                      setNeonTestResult({ success: false, message: "Network error" });
                    } finally {
                      setNeonTesting(false);
                    }
                  }}
                  disabled={neonTesting || !configForm.neon_database_url}
                  className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 cursor-pointer"
                >
                  {neonTesting ? "Testing..." : "Test Connection"}
                </button>

                {neonTestResult && (
                  <div className={`rounded-lg border p-3 text-sm ${neonTestResult.success ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}>
                    {neonTestResult.success ? "\u2713" : "\u2717"} {neonTestResult.message}
                  </div>
                )}
              </div>
            )}

            {/* Kafka (Confluent Cloud) section */}
            {configSection === "kafka" && (
              <div className="space-y-4 mb-6">
                <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-4">
                  <p className="text-sm text-purple-800">
                    <strong>Confluent Cloud setup:</strong>{" "}
                    <a href="https://confluent.cloud/signup" target="_blank" rel="noopener noreferrer" className="underline font-medium">Sign up at confluent.cloud</a>.
                    Create a Kafka cluster, then go to Cluster Settings for the bootstrap server.
                    Create an API key under Cluster &rarr; API Keys.
                    Enable Schema Registry under Environment &rarr; Schema Registry.{" "}
                    <a href="https://docs.confluent.io/cloud/current/get-started/index.html" target="_blank" rel="noopener noreferrer" className="underline font-medium">Quick start guide</a>.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Bootstrap Servers</label>
                  <input
                    type="text"
                    placeholder="pkc-xxxxx.us-east-1.aws.confluent.cloud:9092"
                    value={configForm.kafka_bootstrap_servers}
                    onChange={(e) => setConfigForm((f) => ({ ...f, kafka_bootstrap_servers: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:border-primary focus:ring-2 focus:ring-primary-bg outline-none transition-all font-mono"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Cluster API Key</label>
                  <input
                    type="text"
                    placeholder="ABCDEFGHIJKLMNOP"
                    value={configForm.kafka_api_key}
                    onChange={(e) => setConfigForm((f) => ({ ...f, kafka_api_key: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:border-primary focus:ring-2 focus:ring-primary-bg outline-none transition-all font-mono"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Cluster API Secret</label>
                  <div className="relative">
                    <input
                      type={showSecrets["kafka_secret"] ? "text" : "password"}
                      placeholder="Your Confluent Cloud API secret"
                      value={configForm.kafka_api_secret}
                      onChange={(e) => setConfigForm((f) => ({ ...f, kafka_api_secret: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:border-primary focus:ring-2 focus:ring-primary-bg outline-none transition-all font-mono pr-12"
                    />
                    <button type="button" onClick={() => toggleSecret("kafka_secret")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
                      {showSecrets["kafka_secret"] ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M3 3l18 18" /></svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Schema Registry</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Schema Registry URL</label>
                  <input
                    type="text"
                    placeholder="https://psrc-xxxxx.us-east-1.aws.confluent.cloud"
                    value={configForm.kafka_schema_registry_url}
                    onChange={(e) => setConfigForm((f) => ({ ...f, kafka_schema_registry_url: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:border-primary focus:ring-2 focus:ring-primary-bg outline-none transition-all font-mono"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Schema Registry API Key</label>
                  <input
                    type="text"
                    placeholder="SR API Key"
                    value={configForm.kafka_sr_api_key}
                    onChange={(e) => setConfigForm((f) => ({ ...f, kafka_sr_api_key: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:border-primary focus:ring-2 focus:ring-primary-bg outline-none transition-all font-mono"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Schema Registry API Secret</label>
                  <div className="relative">
                    <input
                      type={showSecrets["kafka_sr_secret"] ? "text" : "password"}
                      placeholder="SR API Secret"
                      value={configForm.kafka_sr_api_secret}
                      onChange={(e) => setConfigForm((f) => ({ ...f, kafka_sr_api_secret: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:border-primary focus:ring-2 focus:ring-primary-bg outline-none transition-all font-mono pr-12"
                    />
                    <button type="button" onClick={() => toggleSecret("kafka_sr_secret")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
                      {showSecrets["kafka_sr_secret"] ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M3 3l18 18" /></svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      )}
                    </button>
                  </div>
                </div>

                <button
                  onClick={async () => {
                    setKafkaTesting(true);
                    setKafkaTestResult(null);
                    try {
                      if (configForm.kafka_bootstrap_servers && configForm.kafka_api_key && configForm.kafka_api_secret) {
                        await fetch("/api/system/configure", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ kafka: { bootstrap_servers: configForm.kafka_bootstrap_servers, api_key: configForm.kafka_api_key, api_secret: configForm.kafka_api_secret, schema_registry_url: configForm.kafka_schema_registry_url, schema_registry_api_key: configForm.kafka_sr_api_key, schema_registry_api_secret: configForm.kafka_sr_api_secret } }),
                        });
                      }
                      const res = await fetch("/api/system/test-kafka");
                      const data = await res.json();
                      setKafkaTestResult(data);
                    } catch {
                      setKafkaTestResult({ success: false, message: "Network error" });
                    } finally {
                      setKafkaTesting(false);
                    }
                  }}
                  disabled={kafkaTesting || !configForm.kafka_bootstrap_servers || !configForm.kafka_api_key || !configForm.kafka_api_secret}
                  className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 cursor-pointer"
                >
                  {kafkaTesting ? "Testing..." : "Test Kafka Connection"}
                </button>

                {kafkaTestResult && (
                  <div className={`rounded-lg border p-3 text-sm ${kafkaTestResult.success ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}>
                    {kafkaTestResult.success ? "\u2713" : "\u2717"} {kafkaTestResult.message}
                  </div>
                )}
              </div>
            )}

            {/* GitHub & Postman section */}
            {configSection === "more" && (
              <div className="space-y-4 mb-6">
                <p className="text-xs text-slate-400">
                  These are optional — configure them now or later in Settings.
                </p>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">GitHub Token</label>
                  <div className="relative">
                    <input
                      type={showSecrets["github_token"] ? "text" : "password"}
                      placeholder="ghp_..."
                      value={configForm.github_token}
                      onChange={(e) => setConfigForm((f) => ({ ...f, github_token: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:border-primary focus:ring-2 focus:ring-primary-bg outline-none transition-all font-mono pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => toggleSecret("github_token")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showSecrets["github_token"] ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M3 3l18 18" /></svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Enables Git push/PR features. Needs <code className="bg-slate-100 px-1 rounded">repo</code> scope.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Postman API Key</label>
                  <div className="relative">
                    <input
                      type={showSecrets["postman_key"] ? "text" : "password"}
                      placeholder="PMAK-..."
                      value={configForm.postman_api_key}
                      onChange={(e) => setConfigForm((f) => ({ ...f, postman_api_key: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:border-primary focus:ring-2 focus:ring-primary-bg outline-none transition-all font-mono pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => toggleSecret("postman_key")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showSecrets["postman_key"] ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M3 3l18 18" /></svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Enables collection sync. Get it from Postman &rarr; Settings &rarr; API Keys.</p>
                </div>
              </div>
            )}

            {/* Result feedback */}
            {configResult && (
              <div
                className={`rounded-xl border p-4 mb-6 ${
                  configResult.success
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-red-200 bg-red-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      configResult.success ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
                    }`}
                  >
                    {configResult.success ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className={`font-semibold text-sm ${configResult.success ? "text-emerald-800" : "text-red-800"}`}>
                      {configResult.message}
                    </p>
                    {configResult.details.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {configResult.details.map((d, i) => (
                          <li key={i} className={`text-xs ${configResult.success ? "text-emerald-600" : "text-red-600"}`}>
                            {configResult.success ? "\u2713" : "\u2717"} {d}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setStep("check")}
                className="text-sm text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                &larr; Back
              </button>
              <div className="flex gap-3">
                {hasAnyCredential && (
                  <button
                    onClick={saveCredentials}
                    disabled={configSaving}
                    className="px-6 py-2 bg-primary text-white text-sm rounded-lg font-semibold hover:bg-primary-hover disabled:opacity-50 cursor-pointer flex items-center gap-2"
                  >
                    {configSaving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        Save &amp; Configure
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={() => setStep("ready")}
                  className={`px-6 py-2 text-sm rounded-lg font-semibold cursor-pointer ${
                    hasAnyCredential
                      ? "border border-slate-300 text-slate-600 hover:bg-slate-50"
                      : "bg-primary text-white hover:bg-primary-hover"
                  }`}
                >
                  {hasAnyCredential ? "Skip for now" : "Skip \u2014 I'll configure later"}
                </button>
              </div>
            </div>

            {/* No-creds helper */}
            {!hasAnyCredential && (
              <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-600">
                  <strong className="text-slate-700">Don't have credentials yet?</strong>{" "}
                  No problem — you can explore the dashboard, create local projects with mock services,
                  and add Anypoint credentials later from <strong>Settings &rarr; Secrets</strong>.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ===== STEP 5: READY ===== */}
        {step === "ready" && (
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-10 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">You're All Set!</h2>
            <p className="text-slate-500 mb-8 max-w-md mx-auto">
              Your environment is ready. Log in to explore the dashboard, create your first
              MuleSoft API project, and see real-time monitoring in action.
            </p>

            <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 mb-8 max-w-sm mx-auto">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                Default Login Credentials
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Developer</span>
                  <span className="font-mono font-medium text-slate-800">developer / developer</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Administrator</span>
                  <span className="font-mono font-medium text-slate-800">admin / admin</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={onComplete}
                className="w-full max-w-sm px-8 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary-hover transition-colors shadow-md shadow-primary-bg cursor-pointer text-lg"
              >
                Go to Dashboard
              </button>
              <p className="text-xs text-slate-400">
                Tip: After logging in, head to the <strong>New Project</strong> tab to scaffold your first API.
              </p>
            </div>

            <button
              onClick={() => setStep("configure")}
              className="mt-6 text-sm text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              &larr; Back to Configure
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
