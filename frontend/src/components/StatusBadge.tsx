interface StatusBadgeProps {
  status: string;
}

const STATUS_COLORS: Record<string, string> = {
  STARTED: "bg-green-100 text-green-700",
  DEPLOYED: "bg-green-100 text-green-700",
  running: "bg-green-100 text-green-700",
  active: "bg-green-100 text-green-700",
  STOPPED: "bg-red-100 text-red-700",
  FAILED: "bg-red-100 text-red-700",
  exited: "bg-red-100 text-red-700",
  UNDEPLOYED: "bg-slate-100 text-slate-600",
  DEPLOYING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-green-100 text-green-700",
  REVOKED: "bg-red-100 text-red-700",
  PENDING: "bg-amber-100 text-amber-700",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const color = STATUS_COLORS[status] || "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {status}
    </span>
  );
}
