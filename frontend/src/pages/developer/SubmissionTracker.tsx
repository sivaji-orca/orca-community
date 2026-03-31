import { useState, useEffect, useCallback } from "react";

const API = "http://localhost:3003/api/tracking";

interface TrackingEvent {
  correlationId: string;
  api: string;
  step: string;
  status: string;
  timestamp: string;
  durationMs?: number;
  metadata?: Record<string, string>;
}

interface SubmissionSummary {
  correlationId: string;
  caseId: string;
  applicantLastName: string;
  status: string;
  lastStep: string;
  lastUpdated: string;
}

interface SubmissionDetail {
  correlationId: string;
  totalEvents: number;
  events: TrackingEvent[];
}

const STEP_ORDER = [
  "PE_RECEIVED",
  "SF_FETCH_START",
  "SF_FETCH_COMPLETE",
  "CDM_VALIDATE_START",
  "CDM_VALIDATE_COMPLETE",
  "ROSETTA_LOOKUP_START",
  "ROSETTA_LOOKUP_COMPLETE",
  "XML_TRANSFORM_START",
  "XML_TRANSFORM_COMPLETE",
  "XSD_VALIDATE_START",
  "XSD_VALIDATE_COMPLETE",
  "DISS_SUBMIT_START",
  "DISS_SUBMIT_COMPLETE",
  "PE_COMPLETE",
];

const STEP_LABELS: Record<string, string> = {
  PE_RECEIVED: "PE API Received",
  SF_FETCH_START: "Salesforce Fetch Start",
  SF_FETCH_COMPLETE: "Salesforce Fetch Complete",
  CDM_VALIDATE_START: "CDM Validation Start",
  CDM_VALIDATE_COMPLETE: "CDM Validation Complete",
  ROSETTA_LOOKUP_START: "Rosetta Lookup Start",
  ROSETTA_LOOKUP_COMPLETE: "Rosetta Lookup Complete",
  XML_TRANSFORM_START: "XML Transform Start",
  XML_TRANSFORM_COMPLETE: "XML Transform Complete",
  XSD_VALIDATE_START: "XSD Validation Start",
  XSD_VALIDATE_COMPLETE: "XSD Validation Complete",
  DISS_SUBMIT_START: "DISS Submit Start",
  DISS_SUBMIT_COMPLETE: "DISS Submit Complete",
  PE_COMPLETE: "PE API Complete",
};

function statusColor(status: string) {
  switch (status) {
    case "SUCCESS":
      return "bg-green-100 text-green-800";
    case "FAILED":
      return "bg-red-100 text-red-800";
    case "IN_PROGRESS":
      return "bg-yellow-100 text-yellow-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function statusDot(status: string) {
  switch (status) {
    case "SUCCESS":
      return "bg-green-500";
    case "FAILED":
      return "bg-red-500";
    case "IN_PROGRESS":
      return "bg-yellow-500";
    default:
      return "bg-gray-400";
  }
}

function formatTime(ts: string) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

export function SubmissionTracker() {
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SubmissionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [trackingHealth, setTrackingHealth] = useState<string>("unknown");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const token = localStorage.getItem("token") || "";

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = statusFilter ? `?status=${statusFilter}` : "";
      const resp = await fetch(`${API}/submissions${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      setSubmissions(data.submissions || []);
    } catch (err: any) {
      setError(err.message || "Failed to load submissions");
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter]);

  const fetchHealth = useCallback(async () => {
    try {
      const resp = await fetch(`${API}/health`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        setTrackingHealth(data.status || "UP");
      } else {
        setTrackingHealth("DOWN");
      }
    } catch {
      setTrackingHealth("DOWN");
    }
  }, [token]);

  const fetchDetail = useCallback(
    async (correlationId: string) => {
      setDetailLoading(true);
      setSelectedId(correlationId);
      try {
        const resp = await fetch(`${API}/submission/${correlationId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await resp.json();
        setDetail(data);
      } catch {
        setDetail(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    fetchSubmissions();
    fetchHealth();
  }, [fetchSubmissions, fetchHealth]);

  const filtered = submissions.filter((s) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      s.correlationId.toLowerCase().includes(q) ||
      s.caseId.toLowerCase().includes(q) ||
      s.applicantLastName.toLowerCase().includes(q)
    );
  });

  const completedSteps = detail
    ? new Set(detail.events.map((e) => e.step))
    : new Set<string>();

  const lastEventStatus =
    detail && detail.events.length > 0
      ? detail.events[detail.events.length - 1].status
      : "UNKNOWN";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            E2E Submission Tracker
          </h2>
          <p className="text-sm text-gray-500">
            Track SF-86 submissions across all API layers
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${
              trackingHealth === "UP"
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                trackingHealth === "UP" ? "bg-green-500" : "bg-red-500"
              }`}
            />
            Tracking API {trackingHealth}
          </span>
          <button
            onClick={() => {
              fetchSubmissions();
              fetchHealth();
            }}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Search by correlationId, caseId, or name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded text-sm"
        >
          <option value="">All Statuses</option>
          <option value="SUCCESS">Success</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="FAILED">Failed</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Submissions List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow border border-gray-200">
            <div className="p-3 border-b border-gray-200 bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-700">
                Recent Submissions ({filtered.length})
              </h3>
            </div>
            <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
              {loading && (
                <div className="p-4 text-center text-gray-500 text-sm">
                  Loading...
                </div>
              )}
              {!loading && filtered.length === 0 && (
                <div className="p-4 text-center text-gray-400 text-sm">
                  No submissions found
                </div>
              )}
              {filtered.map((sub) => (
                <button
                  key={sub.correlationId}
                  onClick={() => fetchDetail(sub.correlationId)}
                  className={`w-full text-left p-3 hover:bg-blue-50 transition ${
                    selectedId === sub.correlationId
                      ? "bg-blue-50 border-l-4 border-blue-500"
                      : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-gray-500 truncate max-w-[180px]">
                      {sub.correlationId.slice(0, 8)}...
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(
                        sub.status
                      )}`}
                    >
                      {sub.status}
                    </span>
                  </div>
                  <div className="mt-1">
                    <span className="text-sm font-medium text-gray-900">
                      {sub.applicantLastName || "Unknown"}
                    </span>
                    {sub.caseId && (
                      <span className="text-xs text-gray-500 ml-2">
                        Case: {sub.caseId}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {sub.lastStep} &middot; {formatTime(sub.lastUpdated)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Timeline Detail */}
        <div className="lg:col-span-2">
          {!selectedId && (
            <div className="bg-white rounded-lg shadow border border-gray-200 p-8 text-center text-gray-400">
              <svg
                className="mx-auto h-12 w-12 text-gray-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 5l7 7-7 7"
                />
              </svg>
              <p className="mt-2 text-sm">
                Select a submission to view its E2E timeline
              </p>
            </div>
          )}

          {selectedId && detailLoading && (
            <div className="bg-white rounded-lg shadow border border-gray-200 p-8 text-center text-gray-500">
              Loading timeline...
            </div>
          )}

          {selectedId && !detailLoading && detail && (
            <div className="bg-white rounded-lg shadow border border-gray-200">
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">
                      Submission Timeline
                    </h3>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">
                      {detail.correlationId}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColor(
                      lastEventStatus
                    )}`}
                  >
                    {detail.totalEvents} events
                  </span>
                </div>
              </div>

              {/* Waterfall Timeline */}
              <div className="p-4">
                <div className="relative">
                  {STEP_ORDER.map((step, idx) => {
                    const event = detail.events.find((e) => e.step === step);
                    const isCompleted = completedSteps.has(step);
                    const isFailed = event?.status === "FAILED";
                    const isLast = idx === STEP_ORDER.length - 1;

                    return (
                      <div key={step} className="flex gap-3 mb-0 last:mb-0">
                        {/* Connector */}
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-3 h-3 rounded-full border-2 mt-1 ${
                              isFailed
                                ? "border-red-500 bg-red-500"
                                : isCompleted
                                ? "border-green-500 bg-green-500"
                                : "border-gray-300 bg-white"
                            }`}
                          />
                          {!isLast && (
                            <div
                              className={`w-0.5 flex-1 min-h-[32px] ${
                                isCompleted ? "bg-green-300" : "bg-gray-200"
                              }`}
                            />
                          )}
                        </div>

                        {/* Content */}
                        <div className="pb-4 flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-sm font-medium ${
                                isCompleted
                                  ? "text-gray-900"
                                  : "text-gray-400"
                              }`}
                            >
                              {STEP_LABELS[step] || step}
                            </span>
                            {event && (
                              <span
                                className={`text-xs px-1.5 py-0.5 rounded ${statusColor(
                                  event.status
                                )}`}
                              >
                                {event.status}
                              </span>
                            )}
                          </div>
                          {event && (
                            <div className="text-xs text-gray-500 mt-0.5">
                              <span className="font-mono">
                                {event.api}
                              </span>
                              <span className="mx-1">&middot;</span>
                              <span>{formatTime(event.timestamp)}</span>
                              {event.durationMs && (
                                <>
                                  <span className="mx-1">&middot;</span>
                                  <span>{event.durationMs}ms</span>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Raw Events Table */}
              <div className="border-t border-gray-200">
                <div className="p-3 bg-gray-50">
                  <h4 className="text-xs font-semibold text-gray-600 uppercase">
                    Raw Events
                  </h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-gray-500">#</th>
                        <th className="px-3 py-2 text-left text-gray-500">
                          Step
                        </th>
                        <th className="px-3 py-2 text-left text-gray-500">
                          API
                        </th>
                        <th className="px-3 py-2 text-left text-gray-500">
                          Status
                        </th>
                        <th className="px-3 py-2 text-left text-gray-500">
                          Timestamp
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {detail.events.map((evt, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-400">
                            {idx + 1}
                          </td>
                          <td className="px-3 py-2 font-mono">{evt.step}</td>
                          <td className="px-3 py-2 text-gray-600">
                            {evt.api}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${statusColor(
                                evt.status
                              )}`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${statusDot(
                                  evt.status
                                )}`}
                              />
                              {evt.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-500">
                            {formatTime(evt.timestamp)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
