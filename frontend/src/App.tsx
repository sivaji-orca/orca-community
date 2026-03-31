import { useAuth } from "./hooks/useAuth";
import { Login } from "./pages/Login";
import { AdminDashboard } from "./pages/admin/Dashboard";
import { DevDashboard } from "./pages/developer/Dashboard";

function App() {
  const { user, login, logout, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) {
    return <Login onLogin={async (u, p, r) => { await login(u, p, r); }} />;
  }

  if (user.role === "administrator") {
    return <AdminDashboard user={user} onLogout={logout} />;
  }

  return <DevDashboard user={user} onLogout={logout} />;
}

export default App;
