import { useState, useEffect } from "react";
import { api } from "../../api/client";
import { Card } from "../../components/Card";

interface TemplateMetadata {
  id: string;
  name: string;
  description: string;
  requiredCredentials: string[];
  ports: Record<string, number>;
  projects: string[];
  architecture?: string;
}

interface CredStatus {
  anypoint: { client_id: boolean; client_secret: boolean };
  salesforce: { instance_url: boolean; username: boolean; password: boolean; security_token: boolean };
  neon: { database_url: boolean };
  github: { token: boolean };
  postman: { api_key: boolean };
}

type Step = "template" | "scaffold" | "git-init" | "create-remote" | "commit" | "push" | "deploy" | "postman" | "done";

const STEPS: { id: Step; label: string }[] = [
  { id: "template", label: "Choose Template" },
  { id: "scaffold", label: "Scaffold Project" },
  { id: "git-init", label: "Initialize Git" },
  { id: "create-remote", label: "Create GitHub Repo" },
  { id: "commit", label: "Commit Changes" },
  { id: "push", label: "Push to Remote" },
  { id: "deploy", label: "Deploy Locally" },
  { id: "postman", label: "Generate Postman Collection" },
  { id: "done", label: "Complete" },
];

const CRED_LABELS: Record<string, string> = {
  anypoint: "Anypoint Platform",
  salesforce: "Salesforce",
  neon: "Neon PostgreSQL",
  github: "GitHub",
  postman: "Postman",
};

function isCredReady(cred: string, status: CredStatus | null): boolean {
  if (!status) return false;
  switch (cred) {
    case "anypoint": return status.anypoint.client_id && status.anypoint.client_secret;
    case "salesforce": return status.salesforce.instance_url && status.salesforce.username;
    case "neon": return status.neon.database_url;
    case "github": return status.github.token;
    case "postman": return status.postman.api_key;
    default: return false;
  }
}

export function ProjectScaffold() {
  const [templates, setTemplates] = useState<TemplateMetadata[]>([]);
  const [credStatus, setCredStatus] = useState<CredStatus | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("hello-world");
  const [projectName, setProjectName] = useState("hello-world");
  const [currentStep, setCurrentStep] = useState<Step>("template");
  const [completedSteps, setCompletedSteps] = useState<Set<Step>>(new Set());
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [existingProjects, setExistingProjects] = useState<string[]>([]);

  useEffect(() => {
    api.get<TemplateMetadata[]>("/projects/templates").then(setTemplates).catch(() => {});
    api.get<CredStatus>("/system/configure/status").then(setCredStatus).catch(() => {});
    api.get<string[]>("/projects/list").then(setExistingProjects).catch(() => {});
  }, []);

  const addLog = (msg: string) => setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  const markComplete = (step: Step) => {
    setCompletedSteps((prev) => new Set(prev).add(step));
    const idx = STEPS.findIndex((s) => s.id === step);
    if (idx < STEPS.length - 1) setCurrentStep(STEPS[idx + 1].id);
  };

  const selectedMeta = templates.find((t) => t.id === selectedTemplate);
  const allCredsReady = selectedMeta?.requiredCredentials.every((c) => isCredReady(c, credStatus)) ?? false;

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const tmpl = templates.find((t) => t.id === templateId);
    if (tmpl) {
      setProjectName(templateId === "hello-world" ? "hello-world" : "sf-pg-sync");
    }
  };

  const confirmTemplate = () => {
    markComplete("template");
  };

  const executeStep = async () => {
    setLoading(true);
    setError("");

    try {
      switch (currentStep) {
        case "scaffold": {
          addLog(`Scaffolding '${projectName}' with template '${selectedTemplate}'...`);
          const data = await api.post<{ message: string; files: string[]; projects: string[] }>("/projects/scaffold", {
            projectName,
            template: selectedTemplate,
          });
          addLog(data.message);
          if (data.projects?.length > 1) {
            addLog(`Created ${data.projects.length} projects: ${data.projects.join(", ")}`);
          }
          data.files.slice(0, 10).forEach((f) => addLog(`  Created: ${f}`));
          if (data.files.length > 10) addLog(`  ... and ${data.files.length - 10} more files`);
          markComplete("scaffold");
          break;
        }
        case "git-init": {
          addLog("Initializing git repository...");
          const data = await api.post<{ message: string }>("/git/init", { projectName });
          addLog(data.message);
          markComplete("git-init");
          break;
        }
        case "create-remote": {
          addLog("Creating GitHub repository...");
          const data = await api.post<{ message: string; url: string }>("/git/create-remote", { projectName });
          addLog(`${data.message}: ${data.url}`);
          markComplete("create-remote");
          break;
        }
        case "commit": {
          addLog("Committing changes...");
          const data = await api.post<{ message: string; hash: string }>("/git/commit", {
            projectName,
            message: `Initial commit - ${selectedTemplate} scaffolded by Orca`,
          });
          addLog(`${data.message} (${data.hash})`);
          markComplete("commit");
          break;
        }
        case "push": {
          addLog("Pushing to remote...");
          const data = await api.post<{ message: string }>("/git/push", { projectName });
          addLog(data.message);
          markComplete("push");
          break;
        }
        case "deploy": {
          addLog("Deploying to local MuleSoft runtime...");
          const data = await api.post<{ message: string }>("/deploy/local", { projectName });
          addLog(data.message);
          markComplete("deploy");
          break;
        }
        case "postman": {
          addLog("Generating Postman collection...");
          const data = await api.post<{ message: string }>("/postman/generate", { projectName });
          addLog(data.message);
          markComplete("postman");
          break;
        }
      }
    } catch (err: any) {
      setError(err.message);
      addLog(`ERROR: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const isStepComplete = (step: Step) => completedSteps.has(step);
  const isStepCurrent = (step: Step) => step === currentStep;

  return (
    <Card title="Project Scaffold Wizard">
      {/* Step indicators */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {STEPS.map((step) => (
          <div
            key={step.id}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              isStepComplete(step.id)
                ? "bg-green-100 text-green-700 border-green-200"
                : isStepCurrent(step.id)
                ? "bg-primary-bg text-primary-text border-primary-bg"
                : "bg-slate-50 text-slate-400 border-slate-200"
            }`}
          >
            {isStepComplete(step.id) ? "\u2713 " : ""}
            {step.label}
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {/* Template selection step */}
      {currentStep === "template" && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Choose a Template</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {templates.map((tmpl) => {
              const allReady = tmpl.requiredCredentials.every((c) => isCredReady(c, credStatus));
              return (
                <button
                  key={tmpl.id}
                  onClick={() => handleTemplateSelect(tmpl.id)}
                  className={`text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    selectedTemplate === tmpl.id
                      ? "border-primary bg-primary-bg/30"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-slate-800 text-sm">{tmpl.name}</h4>
                    {tmpl.architecture && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
                        {tmpl.architecture}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mb-3 leading-relaxed">{tmpl.description}</p>

                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {tmpl.requiredCredentials.map((cred) => {
                      const ready = isCredReady(cred, credStatus);
                      return (
                        <span
                          key={cred}
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            ready
                              ? "bg-green-100 text-green-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {ready ? "\u2713" : "\u26A0"} {CRED_LABELS[cred] || cred}
                        </span>
                      );
                    })}
                  </div>

                  {!allReady && (
                    <p className="text-xs text-amber-600 mt-1">
                      Missing credentials — configure them in Settings or Onboarding first.
                    </p>
                  )}

                  <div className="flex gap-2 mt-2">
                    {Object.entries(tmpl.ports).map(([name, port]) => (
                      <span key={name} className="text-xs text-slate-400">
                        {name}: {port}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">Project Name</label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
              className="px-4 py-2 rounded-lg border border-slate-300 text-sm focus:border-primary outline-none w-64"
            />
            {selectedTemplate === "sf-postgres-sync" && (
              <p className="text-xs text-slate-400 mt-1">
                This will create: {projectName}-sync-process-api, {projectName}-sf-system-api, {projectName}-db-system-api
              </p>
            )}
            {existingProjects.length > 0 && (
              <p className="text-xs text-slate-400 mt-1">
                Existing: {existingProjects.join(", ")}
              </p>
            )}
          </div>

          <button
            onClick={confirmTemplate}
            disabled={!projectName || (!allCredsReady && selectedTemplate !== "hello-world")}
            className="px-6 py-2.5 bg-primary text-white text-sm rounded-lg hover:bg-primary-hover disabled:opacity-50 font-medium cursor-pointer"
          >
            Continue with {selectedMeta?.name || "template"}
          </button>

          {!allCredsReady && selectedTemplate !== "hello-world" && (
            <p className="text-xs text-amber-600 mt-2">
              Configure missing credentials before proceeding.{" "}
              <a href="#" className="underline">Go to Settings</a>
            </p>
          )}
        </div>
      )}

      {/* Regular steps */}
      {currentStep !== "template" && currentStep !== "done" && (
        <>
          <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-xs text-slate-500">
              Template: <strong className="text-slate-700">{selectedMeta?.name}</strong> | Project: <strong className="text-slate-700">{projectName}</strong>
            </p>
          </div>
          <button
            onClick={executeStep}
            disabled={loading || !projectName}
            className="px-6 py-2.5 bg-primary text-white text-sm rounded-lg hover:bg-primary-hover disabled:opacity-50 font-medium cursor-pointer mb-6"
          >
            {loading ? "Running..." : `Execute: ${STEPS.find((s) => s.id === currentStep)?.label}`}
          </button>
        </>
      )}

      {currentStep === "done" && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 mb-6">
          All steps complete! Your <strong>{selectedMeta?.name}</strong> project is scaffolded, committed, pushed, deployed, and has Postman collections ready.
        </div>
      )}

      {logs.length > 0 && (
        <div className="bg-slate-900 rounded-lg p-4 max-h-64 overflow-y-auto">
          {logs.map((log, i) => (
            <p key={i} className={`font-mono text-xs ${log.includes("ERROR") ? "text-red-400" : "text-green-400"}`}>
              {log}
            </p>
          ))}
        </div>
      )}
    </Card>
  );
}
