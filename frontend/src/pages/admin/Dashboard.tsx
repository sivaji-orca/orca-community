import { useState } from "react";
import { Layout } from "../../components/Layout";
import { TeamManagement } from "./TeamManagement";
import { SecretsManager } from "./SecretsManager";
import type { User } from "../../hooks/useAuth";

interface AdminDashboardProps {
  user: User;
  onLogout: () => void;
}

type Tab = "team" | "secrets";

export function AdminDashboard({ user, onLogout }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>("team");

  const nav = [
    { label: "Team Management", path: "team", active: activeTab === "team", onClick: () => setActiveTab("team") },
    { label: "Secrets Manager", path: "secrets", active: activeTab === "secrets", onClick: () => setActiveTab("secrets") },
  ];

  return (
    <Layout user={user} onLogout={onLogout} nav={nav}>
      {activeTab === "team" && <TeamManagement />}
      {activeTab === "secrets" && <SecretsManager />}
    </Layout>
  );
}
