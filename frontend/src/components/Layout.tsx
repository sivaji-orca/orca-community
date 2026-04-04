import type { ReactNode } from "react";
import type { User } from "../hooks/useAuth";

interface LayoutProps {
  user: User;
  onLogout: () => void;
  children: ReactNode;
  nav: { label: string; path: string; active?: boolean; onClick: () => void }[];
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
