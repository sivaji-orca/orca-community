import { type ReactNode, useState, useRef, useEffect } from "react";
import type { User } from "../hooks/useAuth";
import { useWorkspace } from "../hooks/useWorkspace";

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
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-sm font-medium text-slate-700 transition-colors cursor-pointer"
      >
        <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <span className="max-w-[120px] truncate">{activeWorkspace?.name || "Default"}</span>
        <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-64 bg-white rounded-xl border border-slate-200 shadow-lg z-50 py-1">
          <div className="px-3 py-2 border-b border-slate-100">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Workspaces</p>
          </div>

          <div className="max-h-48 overflow-y-auto">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => { switchWorkspace(ws.id); setOpen(false); }}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left transition-colors cursor-pointer ${
                  ws.id === activeWorkspace?.id
                    ? "bg-primary-bg-subtle text-primary-text font-medium"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <div className="min-w-0">
                  <span className="block truncate">{ws.name}</span>
                  <span className="text-[11px] text-slate-400">{ws.projectCount} project{ws.projectCount !== 1 ? "s" : ""}</span>
                </div>
                {ws.id === activeWorkspace?.id && (
                  <svg className="w-4 h-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>

          <div className="border-t border-slate-100 px-3 py-2">
            {creating ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  placeholder="Workspace name"
                  className="flex-1 px-2 py-1.5 text-sm rounded-md border border-slate-300 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
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
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-white font-bold text-sm">O</span>
              </div>
              <h1 className="text-xl font-bold text-text">Orca Community</h1>
              <WorkspaceSwitcher />
              <span className="text-xs bg-primary-bg text-primary-text px-2 py-0.5 rounded-full font-medium">
                {user.role}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-500">
                Signed in as <span className="font-medium text-slate-700">{user.username}</span>
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
        <nav className="flex gap-1 mb-6 bg-white rounded-lg p-1 shadow-sm border border-slate-200 overflow-x-auto">
          {nav.map((item) => (
            <button
              key={item.label}
              onClick={item.onClick}
              className={`px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                item.active
                  ? "bg-primary text-white"
                  : "text-slate-600 hover:text-slate-800 hover:bg-slate-100"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <main>{children}</main>
      </div>

      <footer className="border-t border-slate-200 mt-12 py-4">
        <p className="text-center text-xs text-slate-400">
          Orca Community Edition &mdash; orcaesb.com
        </p>
      </footer>
    </div>
  );
}
