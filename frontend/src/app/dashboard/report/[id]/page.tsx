"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const API = "";

interface DiagnosisData {
  id: number;
  case_id: number;
  classification: string | null;
  confidence: number | null;
  all_probabilities: Record<string, number> | null;
  gradcam_url: string | null;
  interpretation_text: string | null;
  review_status: string;
  reviewed_at: string | null;
  review_notes: string | null;
  report_url: string | null;
}

interface CaseData {
  id: number;
  patient_id: string;
  status: string;
  file_type: string;
  created_at: string;
}

const classStyles: Record<string, { bg: string; color: string; label: string; icon: string }> = {
  "Normal cases": { bg: "rgba(34,197,94,0.12)", color: "#22c55e", label: "Normal", icon: "✅" },
  "Benign cases": { bg: "rgba(251,191,36,0.12)", color: "#fbbf24", label: "Benign", icon: "⚠️" },
  "Malignant cases": { bg: "rgba(239,68,68,0.12)", color: "#ef4444", label: "Malignant", icon: "🔴" },
};

export default function ReportPage() {
  const params = useParams();
  const caseId = params.id as string;
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [diagnosis, setDiagnosis] = useState<DiagnosisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [reviewStatus, setReviewStatus] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [userRole, setUserRole] = useState("");

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  useEffect(() => {
    setUserRole(localStorage.getItem("userRole") || "");
    fetchData();
  }, []);

  const fetchData = async () => {
    if (!token) return;
    try {
      const caseRes = await fetch(`${API}/api/cases/${caseId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (caseRes.ok) setCaseData(await caseRes.json());

      const diagRes = await fetch(`${API}/api/diagnosis/${caseId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (diagRes.ok) {
        const d = await diagRes.json();
        setDiagnosis(d);
        if (d.review_status) setReviewStatus(d.review_status);
        if (d.review_notes) setReviewNotes(d.review_notes);
      }
    } catch {} finally { setLoading(false); }
  };

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch(`${API}/api/diagnosis/${caseId}`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { setDiagnosis(await res.json()); await fetchData(); }
      else { const e = await res.json().catch(() => null); alert(e?.detail || "Analysis failed"); }
    } catch (e: any) { alert("Error: " + e.message); }
    setAnalyzing(false);
  };

  const submitReview = async (status: string) => {
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/diagnosis/${caseId}/review`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ review_status: status, review_notes: reviewNotes || null }),
      });
      if (res.ok) { setDiagnosis(await res.json()); await fetchData(); }
      else { const e = await res.json().catch(() => null); alert(e?.detail || "Review failed"); }
    } catch (e: any) { alert("Error: " + e.message); }
    setSubmitting(false);
  };

  const downloadPdf = () => {
    if (!token) return;
    window.open(`${API}/api/diagnosis/${caseId}/report?token=${token}`, "_blank");
  };

  if (loading) return <div className="text-center py-12 animate-pulse" style={{ color: "var(--muted-foreground)" }}>Loading report...</div>;

  const cs = diagnosis?.classification ? classStyles[diagnosis.classification] : null;
  const canReview = userRole === "radiologist" || userRole === "admin";

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Case Report</h1>
          <p style={{ color: "var(--muted-foreground)" }} className="text-sm mt-1">
            {caseData?.patient_id || `Case #${caseId}`}
          </p>
        </div>
        <div className="flex gap-2">
          <a href="/dashboard" className="btn text-sm" style={{ background: "var(--secondary)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
            ← Back
          </a>
          {diagnosis && (
            <button onClick={downloadPdf} className="btn btn-primary text-sm">📥 Download PDF</button>
          )}
        </div>
      </div>

      {!diagnosis && caseData?.status === "uploaded" && (
        <div className="card text-center py-12">
          <div className="text-5xl mb-4">🔬</div>
          <h2 className="text-xl font-bold mb-2">Ready for Analysis</h2>
          <p style={{ color: "var(--muted-foreground)" }} className="mb-6">
            This CT scan hasn&apos;t been classified yet. Run the AI classification to detect Normal, Benign, or Malignant patterns.
          </p>
          <button onClick={runAnalysis} disabled={analyzing} className="btn btn-primary py-3 px-8 text-base">
            {analyzing ? "⏳ Classifying..." : "🧠 Run AI Classification"}
          </button>
        </div>
      )}

      {diagnosis && (
        <div className="grid grid-cols-3 gap-6">
          {/* Left column — Classification + Image */}
          <div className="col-span-2 space-y-6">
            {/* Classification Result */}
            <div className="card">
              <h2 className="text-lg font-bold mb-4">Classification Result</h2>
              {cs && (
                <div className="flex items-center gap-4 p-4 rounded-lg mb-4" style={{ background: cs.bg, border: `1px solid ${cs.color}33` }}>
                  <span className="text-4xl">{cs.icon}</span>
                  <div>
                    <div className="text-2xl font-bold" style={{ color: cs.color }}>{cs.label}</div>
                    <div className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                      Confidence: <span className="font-mono font-bold" style={{ color: cs.color }}>{((diagnosis.confidence || 0) * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Probability Bars */}
              {diagnosis.all_probabilities && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold" style={{ color: "var(--muted-foreground)" }}>Classification Probabilities</h3>
                  {Object.entries(diagnosis.all_probabilities)
                    .sort(([, a], [, b]) => b - a)
                    .map(([cls, prob]) => {
                      const s = classStyles[cls] || { bg: "rgba(148,163,184,0.12)", color: "#94a3b8", label: cls };
                      return (
                        <div key={cls}>
                          <div className="flex justify-between text-xs mb-1">
                            <span>{s.label || cls.replace(" cases", "")}</span>
                            <span className="font-mono" style={{ color: s.color }}>{(prob * 100).toFixed(1)}%</span>
                          </div>
                          <div className="h-3 rounded-full overflow-hidden" style={{ background: "var(--secondary)" }}>
                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${prob * 100}%`, background: s.color }} />
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Images: Original + Grad-CAM */}
            <div className="grid grid-cols-2 gap-4">
              <div className="card">
                <h3 className="text-sm font-bold mb-3">Original CT Image</h3>
                <img
                  src={`${API}/api/diagnosis/${caseId}/image?token=${token}`}
                  alt="CT Scan"
                  className="w-full rounded-lg"
                  style={{ maxHeight: "300px", objectFit: "contain", background: "#000" }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
              <div className="card">
                <h3 className="text-sm font-bold mb-3">Grad-CAM Heatmap</h3>
                {diagnosis.gradcam_url ? (
                  <img
                    src={`${API}${diagnosis.gradcam_url}?token=${token}`}
                    alt="Grad-CAM"
                    className="w-full rounded-lg"
                    style={{ maxHeight: "300px", objectFit: "contain", background: "#000" }}
                  />
                ) : (
                  <div className="text-center py-12" style={{ color: "var(--muted-foreground)" }}>No heatmap available</div>
                )}
                <p className="text-xs mt-2" style={{ color: "var(--muted-foreground)", opacity: 0.7 }}>
                  Regions the AI focused on for its classification decision.
                </p>
              </div>
            </div>

            {/* Interpretation */}
            <div className="card">
              <h2 className="text-lg font-bold mb-3">AI Interpretation</h2>
              <pre className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: "var(--muted-foreground)", fontFamily: "inherit" }}>
                {diagnosis.interpretation_text || "No interpretation available."}
              </pre>
            </div>
          </div>

          {/* Right column — Info + Review */}
          <div className="space-y-6">
            <div className="card">
              <h3 className="text-sm font-bold mb-3">Case Information</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt style={{ color: "var(--muted-foreground)" }}>Case ID</dt><dd>#{caseId}</dd></div>
                <div className="flex justify-between"><dt style={{ color: "var(--muted-foreground)" }}>Patient</dt><dd className="font-mono text-xs">{caseData?.patient_id}</dd></div>
                <div className="flex justify-between"><dt style={{ color: "var(--muted-foreground)" }}>Uploaded</dt><dd>{caseData?.created_at ? new Date(caseData.created_at).toLocaleString() : "—"}</dd></div>
                <div className="flex justify-between"><dt style={{ color: "var(--muted-foreground)" }}>Status</dt><dd className="capitalize">{caseData?.status}</dd></div>
                <div className="flex justify-between"><dt style={{ color: "var(--muted-foreground)" }}>Review</dt><dd className="capitalize">{diagnosis.review_status}</dd></div>
              </dl>
            </div>

            {diagnosis.review_notes && diagnosis.review_status !== "pending" && (
              <div className="card">
                <h3 className="text-sm font-bold mb-3">Review Notes</h3>
                <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{diagnosis.review_notes}</p>
                {diagnosis.reviewed_at && (
                  <p className="text-xs mt-2" style={{ color: "var(--muted-foreground)", opacity: 0.6 }}>
                    Reviewed {new Date(diagnosis.reviewed_at).toLocaleString()}
                  </p>
                )}
              </div>
            )}

            {canReview && diagnosis.review_status === "pending" && (
              <div className="card">
                <h3 className="text-sm font-bold mb-3">Submit Review</h3>
                <textarea
                  className="input mb-3"
                  rows={3}
                  placeholder="Add clinical notes..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  style={{ resize: "vertical" }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => submitReview("approved")}
                    disabled={submitting}
                    className="flex-1 btn text-xs py-2"
                    style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)" }}
                  >
                    ✅ Approve
                  </button>
                  <button
                    onClick={() => submitReview("rejected")}
                    disabled={submitting}
                    className="flex-1 btn text-xs py-2"
                    style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}
                  >
                    ❌ Reject
                  </button>
                </div>
              </div>
            )}

            <div className="card" style={{ background: "rgba(59,130,246,0.05)", borderColor: "rgba(59,130,246,0.1)" }}>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                ⚠️ This classification is AI-generated using EfficientNet-B0 and is intended to assist clinical decision-making. Always consult with qualified healthcare providers.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
