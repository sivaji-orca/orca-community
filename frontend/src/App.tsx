import { useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { ThemeContext, useThemeProvider } from "./hooks/useTheme";
import { Onboarding } from "./pages/Onboarding";
import { Login } from "./pages/Login";
import { AdminDashboard } from "./pages/admin/Dashboard";
import { DevDashboard } from "./pages/developer/Dashboard";

function AppContent() {
  const { user, login, logout, isAuthenticated } = useAuth();
  const [onboarded, setOnboarded] = useState(
    () => localStorage.getItem("orca_onboarding_complete") === "true"
  );

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
    return <Login onLogin={async (u, p) => { await login(u, p); }} />;
  }

  if (user.role === "administrator") {
    return <AdminDashboard user={user} onLogout={logout} />;
  }

  return <DevDashboard user={user} onLogout={logout} />;
}

function App() {
  const theme = useThemeProvider();

  return (
    <ThemeContext.Provider value={theme}>
      <AppContent />
    </ThemeContext.Provider>
  );
}

export default App;
