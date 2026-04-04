import { useState } from "react";
import { Layout } from "../../components/Layout";
import { Overview } from "./Overview";
import { ApiDesign } from "./ApiDesign";
import { ProjectExplorer } from "./ProjectExplorer";
import { ProjectScaffold } from "./ProjectScaffold";
import { Deploy } from "./Deploy";
import { Monitoring } from "./Monitoring";
import { LogViewer } from "./LogViewer";
import { Analytics } from "./Analytics";
import { PostmanManager } from "./PostmanManager";
import { GitManager } from "./GitManager";
import { Settings } from "./Settings";
import { WorkstationSetup } from "./WorkstationSetup";
import { UseCaseGallery } from "./UseCaseGallery";
import { CodeScanner } from "./CodeScanner";
import { DataWeavePlayground } from "./DataWeavePlayground";
import { SalesforceDevTools } from "./SalesforceDevTools";
import type { User } from "../../hooks/useAuth";

interface DevDashboardProps {
  user: User;
  onLogout: () => void;
}

type Tab = "overview" | "design" | "projects" | "new-project" | "use-cases" | "scanner" | "dw-playground" | "sf-devtools" | "deploy" | "monitoring" | "logs" | "analytics" | "postman" | "git" | "workstation" | "settings";

export function DevDashboard({ user, onLogout }: DevDashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const nav = [
    { label: "Overview", path: "overview", active: activeTab === "overview", onClick: () => setActiveTab("overview") },
    { label: "API Design", path: "design", active: activeTab === "design", onClick: () => setActiveTab("design") },
    { label: "Projects", path: "projects", active: activeTab === "projects", onClick: () => setActiveTab("projects") },
    { label: "New Project", path: "new-project", active: activeTab === "new-project", onClick: () => setActiveTab("new-project") },
    { label: "Use Cases", path: "use-cases", active: activeTab === "use-cases", onClick: () => setActiveTab("use-cases") },
    { label: "Code Scanner", path: "scanner", active: activeTab === "scanner", onClick: () => setActiveTab("scanner") },
    { label: "DW Playground", path: "dw-playground", active: activeTab === "dw-playground", onClick: () => setActiveTab("dw-playground") },
    { label: "SF DevTools", path: "sf-devtools", active: activeTab === "sf-devtools", onClick: () => setActiveTab("sf-devtools") },
    { label: "Deploy", path: "deploy", active: activeTab === "deploy", onClick: () => setActiveTab("deploy") },
    { label: "Monitoring", path: "monitoring", active: activeTab === "monitoring", onClick: () => setActiveTab("monitoring") },
    { label: "Logs", path: "logs", active: activeTab === "logs", onClick: () => setActiveTab("logs") },
    { label: "Analytics", path: "analytics", active: activeTab === "analytics", onClick: () => setActiveTab("analytics") },
    { label: "Postman", path: "postman", active: activeTab === "postman", onClick: () => setActiveTab("postman") },
    { label: "Git", path: "git", active: activeTab === "git", onClick: () => setActiveTab("git") },
    { label: "Workstation", path: "workstation", active: activeTab === "workstation", onClick: () => setActiveTab("workstation") },
    { label: "Settings", path: "settings", active: activeTab === "settings", onClick: () => setActiveTab("settings") },
  ];

  return (
    <Layout user={user} onLogout={onLogout} nav={nav}>
      {activeTab === "overview" && <Overview onNavigate={(tab: string) => setActiveTab(tab as Tab)} />}
      {activeTab === "design" && <ApiDesign />}
      {activeTab === "projects" && <ProjectExplorer />}
      {activeTab === "new-project" && <ProjectScaffold />}
      {activeTab === "use-cases" && <UseCaseGallery onNavigate={(tab: string) => setActiveTab(tab as Tab)} />}
      {activeTab === "scanner" && <CodeScanner />}
      {activeTab === "dw-playground" && <DataWeavePlayground />}
      {activeTab === "sf-devtools" && <SalesforceDevTools />}
      {activeTab === "deploy" && <Deploy />}
      {activeTab === "monitoring" && <Monitoring />}
      {activeTab === "logs" && <LogViewer />}
      {activeTab === "analytics" && <Analytics />}
      {activeTab === "postman" && <PostmanManager />}
      {activeTab === "git" && <GitManager />}
      {activeTab === "workstation" && <WorkstationSetup />}
      {activeTab === "settings" && <Settings />}
    </Layout>
  );
}
