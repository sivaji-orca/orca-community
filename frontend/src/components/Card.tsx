import type { ReactNode } from "react";

interface CardProps {
  title?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

export function Card({ title, children, className = "", action }: CardProps) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-200 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          {title && <h2 className="text-lg font-semibold text-slate-800">{title}</h2>}
          {action}
        </div>
      )}
      <div className="px-6 py-4">{children}</div>
    </div>
  );
}
