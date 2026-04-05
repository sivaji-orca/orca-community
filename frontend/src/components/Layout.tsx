import { type ReactNode, useState, useRef, useEffect } from "react";
import type { User } from "../hooks/useAuth";
import { useWorkspace } from "../hooks/useWorkspace";
import { useBranding } from "../hooks/useBranding";

interface LayoutProps {
  user: User;
  onLogout: () => void;
  children: ReactNode;
  nav: { label: string; path: string; active?: boolean; onClick: () => void }[];
}

function WorkspaceSwitcher() {
  const { activeWorkspace, workspaces, switchWorkspace, createWorkspace } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const ws = await createWorkspace(newName.trim());
    switchWorkspace(ws.id);
    setNewName("");
    setCreating(false);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-surface-alt hover:bg-surface text-sm font-medium text-text transition-colors cursor-pointer"
      >
        <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <span className="max-w-[120px] truncate">{activeWorkspace?.name || "Default"}</span>
        <svg className={`w-3.5 h-3.5 text-text-muted transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-64 bg-surface rounded-xl border border-border shadow-lg z-50 py-1">
          <div className="px-3 py-2 border-b border-border">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Workspaces</p>
          </div>

          <div className="max-h-48 overflow-y-auto">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => { switchWorkspace(ws.id); setOpen(false); }}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left transition-colors cursor-pointer ${
                  ws.id === activeWorkspace?.id
                    ? "bg-primary-bg-subtle text-primary-text font-medium"
                    : "text-text hover:bg-surface-alt"
                }`}
              >
                <div className="min-w-0">
                  <span className="block truncate">{ws.name}</span>
                  <span className="text-[11px] text-text-muted">{ws.projectCount} project{ws.projectCount !== 1 ? "s" : ""}</span>
                </div>
                {ws.id === activeWorkspace?.id && (
                  <svg className="w-4 h-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>

          <div className="border-t border-border px-3 py-2">
            {creating ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  placeholder="Workspace name"
                  className="flex-1 px-2 py-1.5 text-sm rounded-md border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none bg-surface text-text"
                  autoFocus
                />
                <button
                  onClick={handleCreate}
                  className="px-2.5 py-1.5 bg-primary text-white text-xs rounded-md font-medium hover:bg-primary-hover cursor-pointer"
                >
                  Add
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-primary hover:text-primary-hover font-medium cursor-pointer rounded-md hover:bg-primary-bg-subtle transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                New Workspace
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function Layout({ user, onLogout, children, nav }: LayoutProps) {
  const { branding } = useBranding();
  return (
    <div className="min-h-screen bg-surface-alt">
      <header className="bg-surface border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              {branding.logoSvg ? (
                <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden text-primary" dangerouslySetInnerHTML={{ __html: branding.logoSvg }} />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <span className="text-white font-bold text-sm">{branding.appShortName[0]}</span>
                </div>
              )}
              <h1 className="text-xl font-bold text-text">{branding.appShortName}</h1>
              <WorkspaceSwitcher />
              <span className="text-xs bg-primary-bg text-primary-text px-2 py-0.5 rounded-full font-medium">
                {user.role}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-text-muted">
                Signed in as <span className="font-medium text-text">{user.username}</span>
              </span>
              <button
                onClick={onLogout}
                className="text-sm text-red-600 hover:text-red-700 font-medium cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <nav className="flex gap-1 mb-6 bg-surface rounded-lg p-1 shadow-sm border border-border overflow-x-auto">
          {nav.map((item) => (
            <button
              key={item.label}
              onClick={item.onClick}
              className={`px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                item.active
                  ? "bg-primary text-white"
                  : "text-text-muted hover:text-text hover:bg-surface-alt"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <main>{children}</main>
      </div>

      <footer className="border-t border-border mt-12 py-4">
        <p className="text-center text-xs text-text-muted">
          {branding.appName} &mdash; orcaesb.com
        </p>
      </footer>
    </div>
  );
}
