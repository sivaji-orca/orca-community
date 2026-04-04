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

type Step = "welcome" | "check" | "install" | "configure" | "ready";

const STEPS: { id: Step; label: string }[] = [
  { id: "welcome", label: "Welcome" },
  { id: "check", label: "Prerequisites" },
  { id: "install", label: "Install" },
  { id: "configure", label: "Configure" },
  { id: "ready", label: "Ready" },
];

function StepIndicator({ current }: { current: Step }) {
  const currentIdx = STEPS.findIndex((s) => s.id === current);
  return (
    <div className="flex items-center justify-center gap-2 mb-10">
      {STEPS.map((step, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={step.id} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                done
                  ? "bg-emerald-500 text-white"
                  : active
                    ? "bg-primary text-white ring-4 ring-primary-bg"
                    : "bg-slate-200 text-slate-500"
              }`}
            >
              {done ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                i + 1
              )}
            </div>
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
  const [step, setStep] = useState<Step>("welcome");
  const [prereqs, setPrereqs] = useState<PrereqResponse | null>(null);
  const [checking, setChecking] = useState(false);
  const [guides, setGuides] = useState<Record<string, InstallGuide>>({});
  const [loadingGuide, setLoadingGuide] = useState<string | null>(null);

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

  const failingRequired = prereqs?.prerequisites.filter(
    (p) => p.required && (!p.installed || !p.meetsMinimum)
  ) ?? [];

  const failingOptional = prereqs?.prerequisites.filter(
    (p) => !p.required && !p.installed
  ) ?? [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-bg-subtle via-white to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <StepIndicator current={step} />

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
              Optional: connect to MuleSoft Anypoint Platform for full functionality.
            </p>

            <div className="grid gap-4 mb-6">
              <div className="rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-800 mb-2">I have Anypoint credentials</h3>
                <p className="text-sm text-slate-500 mb-3">
                  You'll need your Anypoint <code className="bg-slate-100 px-1 rounded text-xs">client_id</code> and{" "}
                  <code className="bg-slate-100 px-1 rounded text-xs">client_secret</code>.
                </p>
                <div className="space-y-2">
                  <div className="bg-slate-900 rounded-lg p-3 flex items-center justify-between gap-3">
                    <code className="text-sm text-emerald-400 font-mono">cp config.template.yaml config.yaml && nano config.yaml</code>
                    <CopyButton text="cp config.template.yaml config.yaml && nano config.yaml" />
                  </div>
                  <div className="bg-slate-900 rounded-lg p-3 flex items-center justify-between gap-3">
                    <code className="text-sm text-emerald-400 font-mono">./scripts/configure.sh</code>
                    <CopyButton text="./scripts/configure.sh" />
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Edit config.yaml with your credentials, then run configure.sh to set up Maven settings and vault.
                </p>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5">
                <h3 className="font-semibold text-slate-800 mb-2">I don't have credentials yet</h3>
                <p className="text-sm text-slate-500">
                  No problem! You can explore the full dashboard, use the mock services, and create local projects
                  without Anypoint credentials. Configure them later in the <strong>Settings</strong> tab.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={() => setStep("check")}
                className="text-sm text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                &larr; Back
              </button>
              <button
                onClick={() => setStep("ready")}
                className="px-6 py-2 bg-primary text-white text-sm rounded-lg font-semibold hover:bg-primary-hover cursor-pointer"
              >
                Continue
              </button>
            </div>
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
          </div>
        )}
      </div>
    </div>
  );
}
