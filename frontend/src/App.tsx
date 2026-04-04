import { useState, useEffect } from "react";
import { useAuth } from "./hooks/useAuth";
import { ThemeContext, useThemeProvider } from "./hooks/useTheme";
import { WorkspaceContext, useWorkspaceProvider } from "./hooks/useWorkspace";
import { BrandingContext, useBrandingProvider, useBranding } from "./hooks/useBranding";
import { Onboarding } from "./pages/Onboarding";
import { Login } from "./pages/Login";
import { AdminDashboard } from "./pages/admin/Dashboard";
import { DevDashboard } from "./pages/developer/Dashboard";

function AppContent() {
  const { user, login, logout, isAuthenticated } = useAuth();
  const { branding } = useBranding();
  const [onboarded, setOnboarded] = useState(
    () => localStorage.getItem("orca_onboarding_complete") === "true"
  );

  useEffect(() => {
    document.title = branding.appName;
  }, [branding.appName]);

  if (!onboarded) {
    return (
      <Onboarding
        onComplete={() => {
          localStorage.setItem("orca_onboarding_complete", "true");
          setOnboarded(true);
        }}
      />
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <Login
        onLogin={async (u, p) => { await login(u, p); }}
        onRestartOnboarding={() => {
          localStorage.removeItem("orca_onboarding_complete");
          setOnboarded(false);
        }}
      />
    );
  }

  if (user.role === "administrator") {
    return <AdminDashboard user={user} onLogout={logout} />;
  }

  return <DevDashboard user={user} onLogout={logout} />;
}

function App() {
  const theme = useThemeProvider();
  const workspace = useWorkspaceProvider();
  const brandingCtx = useBrandingProvider();

  return (
    <ThemeContext.Provider value={theme}>
      <WorkspaceContext.Provider value={workspace}>
        <BrandingContext.Provider value={brandingCtx}>
          <AppContent />
        </BrandingContext.Provider>
      </WorkspaceContext.Provider>
    </ThemeContext.Provider>
  );
}

export default App;
