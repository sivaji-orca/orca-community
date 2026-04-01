import { useState, useEffect } from "react";
import { api } from "../../api/client";
import { Card } from "../../components/Card";

type Step = "scaffold" | "git-init" | "create-remote" | "commit" | "push" | "deploy" | "postman" | "done";

const STEPS: { id: Step; label: string }[] = [
  { id: "scaffold", label: "Scaffold Project" },
  { id: "git-init", label: "Initialize Git" },
  { id: "create-remote", label: "Create GitHub Repo" },
  { id: "commit", label: "Commit Changes" },
  { id: "push", label: "Push to Remote" },
  { id: "deploy", label: "Deploy Locally" },
  { id: "postman", label: "Generate Postman Collection" },
  { id: "done", label: "Complete" },
];

export function ProjectScaffold() {
  const [projectName, setProjectName] = useState("hello-world");
  const [currentStep, setCurrentStep] = useState<Step>("scaffold");
  const [completedSteps, setCompletedSteps] = useState<Set<Step>>(new Set());
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [existingProjects, setExistingProjects] = useState<string[]>([]);

  useEffect(() => {
    api.get<string[]>("/projects/list").then(setExistingProjects).catch(() => {});
  }, []);

  const addLog = (msg: string) => setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  const markComplete = (step: Step) => {
    setCompletedSteps((prev) => new Set(prev).add(step));
    const idx = STEPS.findIndex((s) => s.id === step);
    if (idx < STEPS.length - 1) setCurrentStep(STEPS[idx + 1].id);
  };

  const executeStep = async () => {
    setLoading(true);
    setError("");

    try {
      switch (currentStep) {
        case "scaffold": {
          addLog(`Scaffolding project '${projectName}'...`);
          const data = await api.post<{ message: string; files: string[] }>("/projects/scaffold", { projectName });
          addLog(data.message);
          data.files.forEach((f) => addLog(`  Created: ${f}`));
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
            message: "Initial commit - hello-world MuleSoft app scaffolded by Orca",
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
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-1">Project Name</label>
        <input
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
          className="px-4 py-2 rounded-lg border border-slate-300 text-sm focus:border-indigo-500 outline-none w-64"
          disabled={completedSteps.size > 0}
        />
        {existingProjects.length > 0 && (
          <p className="text-xs text-slate-400 mt-1">
            Existing projects: {existingProjects.join(", ")}
          </p>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
          {error}
        </div>
      )}

      <div className="flex gap-2 mb-6 flex-wrap">
        {STEPS.map((step) => (
          <div
            key={step.id}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              isStepComplete(step.id)
                ? "bg-green-100 text-green-700 border-green-200"
                : isStepCurrent(step.id)
                ? "bg-indigo-100 text-indigo-700 border-indigo-200"
                : "bg-slate-50 text-slate-400 border-slate-200"
            }`}
          >
            {isStepComplete(step.id) ? "\u2713 " : ""}
            {step.label}
          </div>
        ))}
      </div>

      {currentStep !== "done" ? (
        <button
          onClick={executeStep}
          disabled={loading || !projectName}
          className="px-6 py-2.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium cursor-pointer mb-6"
        >
          {loading ? "Running..." : `Execute: ${STEPS.find((s) => s.id === currentStep)?.label}`}
        </button>
      ) : (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 mb-6">
          All steps complete! Your hello-world MuleSoft project is scaffolded, committed, pushed, deployed, and has a Postman collection ready.
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
