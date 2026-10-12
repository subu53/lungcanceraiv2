"use client";

import { useEffect, useState, useCallback } from "react";

const API = "http://127.0.0.1:8000";

interface CaseItem {
  id: number;
  patient_id: string;
  status: string;
  file_type: string;
  created_at: string;
  diagnosis?: {
    classification: string | null;
    confidence: number | null;
    review_status: string;
  };
}

const reviewColors: Record<string, { bg: string; color: string; icon: string }> = {
  approved: { bg: "rgba(34,197,94,0.12)", color: "#22c55e", icon: "✅" },
  rejected: { bg: "rgba(239,68,68,0.12)", color: "#ef4444", icon: "❌" },
  pending: { bg: "rgba(251,146,60,0.12)", color: "#fb923c", icon: "⏳" },
  edited: { bg: "rgba(59,130,246,0.12)", color: "#3b82f6", icon: "📝" },
};

const classColors: Record<string, { bg: string; color: string }> = {
  "Normal cases": { bg: "rgba(34,197,94,0.12)", color: "#22c55e" },
  "Benign cases": { bg: "rgba(251,191,36,0.12)", color: "#fbbf24" },
  "Malignant cases": { bg: "rgba(239,68,68,0.12)", color: "#ef4444" },
};

export default function DashboardPage() {
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setToken(localStorage.getItem("token"));
      setUserRole(localStorage.getItem("userRole") || "");
    }
  }, []);

  const fetchCases = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/cases/`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        const enriched = await Promise.all(
          data.map(async (c: CaseItem) => {
            try {
              const dRes = await fetch(`${API}/api/diagnosis/${c.id}`, { headers: { Authorization: `Bearer ${token}` } });
              if (dRes.ok) c.diagnosis = await dRes.json();
            } catch {}
            return c;
          })
        );
        setCases(enriched);
      }
    } catch {} finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchCases(); }, [fetchCases]);

  const stats = {
    total: cases.length,
    pending: cases.filter(c => c.diagnosis?.review_status === "pending" || c.status === "uploaded" || c.status === "analyzing").length,
    approved: cases.filter(c => c.diagnosis?.review_status === "approved").length,
    rejected: cases.filter(c => c.diagnosis?.review_status === "rejected").length,
  };

  const statCards = [
    { label: "Total Scans", value: stats.total, color: "#3b82f6", icon: "📋" },
    { label: "Pending Review", value: stats.pending, color: "#fb923c", icon: "⏳" },
    { label: "Clinically Approved", value: stats.approved, color: "#22c55e", icon: "✅" },
    { label: "Rejected Scans", value: stats.rejected, color: "#ef4444", icon: "❌" },
  ];

  // Distro calc
  const analyzedCases = cases.filter(c => c.diagnosis && c.diagnosis.classification);
  const classCounts = analyzedCases.reduce((acc, c) => {
    const cls = c.diagnosis!.classification!;
    acc[cls] = (acc[cls] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const totalAnalyzed = analyzedCases.length;

  return (
    <div className="animate-fade-in space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Clinical Dashboard</h1>
          <p style={{ color: "var(--muted-foreground)" }} className="text-sm mt-1">Overview of all AI interpretations and review histories</p>
        </div>
        {userRole !== "clinician" && (
          <a href="/dashboard/upload" className="btn btn-primary px-6 shadow-sm">📤 New AI Analysis</a>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map(s => (
          <div key={s.label} className="card flex items-center gap-4">
            <div className="text-3xl">{s.icon}</div>
            <div>
              <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Distribution Chart */}
      {totalAnalyzed > 0 && (
        <div className="card space-y-4 shadow-sm border border-[var(--border)]">
          <h3 className="font-bold text-sm uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>AI Classification Distribution</h3>
          <div className="flex h-5 rounded-full overflow-hidden shadow-inner bg-slate-100 dark:bg-slate-800">
            {Object.entries(classColors).map(([cls, theme]) => {
              const count = classCounts[cls] || 0;
              const percentage = (count / totalAnalyzed) * 100;
              if (percentage === 0) return null;
              return (
                <div key={cls} title={`${cls}: ${count}`} className="h-full transition-all flex items-center justify-center text-[10px] font-bold text-white shadow-sm" style={{ width: `${percentage}%`, background: theme.color }}>
                  {percentage > 10 && `${percentage.toFixed(0)}%`}
                </div>
              );
            })}
          </div>
          <div className="flex justify-between md:justify-start md:gap-8 text-xs font-medium pt-2">
            {Object.entries(classColors).map(([cls, theme]) => (
              <div key={cls} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full shadow-sm" style={{ background: theme.color }}></div>
                <span>{cls.replace(" cases", "")} ({classCounts[cls] || 0})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card shadow-sm border border-[var(--border)]">
        <h2 className="text-lg font-bold mb-4">Case Directory</h2>
        {loading ? (
          <div className="text-center py-12 animate-pulse" style={{ color: "var(--muted-foreground)" }}>Loading case history...</div>
        ) : cases.length === 0 ? (
          <div className="text-center py-12" style={{ color: "var(--muted-foreground)" }}>
            <p className="text-5xl mb-3">📂</p>
            <p className="text-lg font-medium">No records found</p>
            {userRole !== "clinician" && <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>Upload a CT scan to get started.</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th className="text-left py-3 font-medium" style={{ color: "var(--muted-foreground)" }}>Patient Ref</th>
                  <th className="text-left py-3 font-medium" style={{ color: "var(--muted-foreground)" }}>Classification</th>
                  <th className="text-left py-3 font-medium" style={{ color: "var(--muted-foreground)" }}>AI Confidence</th>
                  <th className="text-left py-3 font-medium" style={{ color: "var(--muted-foreground)" }}>Val. Status</th>
                  <th className="text-left py-3 font-medium" style={{ color: "var(--muted-foreground)" }}>Date</th>
                  <th className="text-right py-3 font-medium" style={{ color: "var(--muted-foreground)" }}>Record</th>
                </tr>
              </thead>
              <tbody>
                {cases.map(c => {
                  const hasDiag = !!c.diagnosis?.classification;
                  const cc = hasDiag ? classColors[c.diagnosis!.classification!] : null;
                  const reviewState = c.diagnosis?.review_status || "pending";
                  const rc = reviewColors[reviewState] || reviewColors.pending;

                  return (
                    <tr key={c.id} style={{ borderBottom: "1px solid var(--border)" }} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 font-mono text-xs">{c.patient_id}</td>
                      <td className="py-3">
                        {hasDiag && cc ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold border" style={{ background: cc.bg, color: cc.color, borderColor: `${cc.color}33` }}>
                            {c.diagnosis!.classification!.replace(" cases", "")}
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}>
                            Unanalyzed
                          </span>
                        )}
                      </td>
                      <td className="py-3">
                        {c.diagnosis?.confidence ? (
                          <div className="flex items-center gap-2">
                             <span className="font-mono font-bold">{(c.diagnosis.confidence * 100).toFixed(1)}%</span>
                          </div>
                        ) : <span style={{ color: "var(--muted-foreground)" }}>—</span>}
                      </td>
                      <td className="py-3">
                        <span className="flex items-center gap-1.5 px-2 py-1 w-max rounded text-xs font-medium tracking-wide uppercase" style={{ color: rc.color }}>
                          <span>{rc.icon}</span> {reviewState}
                        </span>
                      </td>
                      <td className="py-3 text-xs" style={{ color: "var(--muted-foreground)" }}>
                        {new Date(c.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="py-3 text-right">
                        {(c.status === "completed" || c.status === "reviewed") ? (
                          <a href={`/dashboard/report/${c.id}`} className="inline-flex btn text-xs py-1 px-3 shadow-sm border" style={{ background: "rgba(59,130,246,0.05)", color: "#3b82f6", borderColor: "rgba(59,130,246,0.1)" }}>
                            📊 View Report
                          </a>
                        ) : c.status === "uploaded" && userRole !== "clinician" ? (
                           <a href={`/dashboard/report/${c.id}`} className="inline-flex btn btn-primary text-xs py-1 px-3">
                            🔬 Analyze
                           </a>
                        ) : <span className="text-xs opacity-50" style={{ color: "var(--muted-foreground)" }}>Locked</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
