"use client";

import { useCallback, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const API = "http://127.0.0.1:8000";

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

export default function UploadPage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState("");
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setToken(localStorage.getItem("token"));
      setUserRole(localStorage.getItem("userRole") || "");
    }
  }, []);

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");

  // Process state
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [diagnosis, setDiagnosis] = useState<DiagnosisData | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Review state
  const [reviewNotes, setReviewNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Handlers
  const handleFile = useCallback((f: File) => {
    const allowed = ["image/png", "image/jpeg", "image/jpg"];
    if (!allowed.includes(f.type)) {
      setError("Please upload a PNG or JPEG image.");
      return;
    }
    setFile(f);
    setError("");
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
    // reset case data
    setCaseData(null);
    setDiagnosis(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const handleAnalyze = async () => {
    if (!file || !token) return;
    setAnalyzing(true);
    setError("");
    setUploadProgress(10); // Start upload

    try {
      // 1. Upload File
      const formData = new FormData();
      formData.append("file", file);

      setUploadProgress(50); // Uploading
      const uploadRes = await fetch(`${API}/api/cases/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!uploadRes.ok) {
        const e = await uploadRes.json().catch(() => null);
        throw new Error(e?.detail || "Upload failed");
      }

      const cData = await uploadRes.json();
      setCaseData(cData);
      setUploadProgress(80); // Upload done, Analyzing

      // 2. Trigger Analysis
      const diagRes = await fetch(`${API}/api/diagnosis/${cData.id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!diagRes.ok) {
        const e = await diagRes.json().catch(() => null);
        throw new Error(e?.detail || "Analysis failed");
      }

      const dData = await diagRes.json();
      setDiagnosis(dData);
      setUploadProgress(100); // Done

    } catch (err: any) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
      setTimeout(() => setUploadProgress(0), 1000); // Clear progress
    }
  };

  const submitReview = async (status: string) => {
    if (!diagnosis || !caseData || !token) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/diagnosis/${caseData.id}/review`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ review_status: status, review_notes: reviewNotes || null }),
      });
      if (res.ok) {
        const updatedDiag = await res.json();
        setDiagnosis(updatedDiag);
      } else {
        const e = await res.json().catch(() => null);
        throw new Error(e?.detail || "Review failed");
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetFlow = () => {
    setFile(null);
    setPreview(null);
    setCaseData(null);
    setDiagnosis(null);
    setError("");
    setReviewNotes("");
  };

  const cs = diagnosis?.classification ? classStyles[diagnosis.classification] : null;
  const canReview = userRole === "radiologist" || userRole === "admin";

  return (
    <div className="max-w-4xl mx-auto animate-fade-in space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">New Classification</h1>
          <p style={{ color: "var(--muted-foreground)" }} className="mt-1">
            Upload a CT scan and run AI analysis instantly
          </p>
        </div>
        {diagnosis && (
          <button onClick={resetFlow} className="btn py-2 px-4 text-sm" style={{ background: "var(--secondary)", color: "var(--foreground)"}}>
            + New Scan
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-lg font-medium" style={{ background: "rgba(229,57,53,0.1)", border: "1px solid rgba(229,57,53,0.2)", color: "#e53935" }}>
          ⚠️ {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Flow Context / Upload */}
        <div className="space-y-6">
          <div className="card h-full flex flex-col justify-center">
            {!preview ? (
              <div
                className="border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer h-full flex flex-col items-center justify-center min-h-[300px]"
                style={{
                  borderColor: dragOver ? "#3b82f6" : "var(--border)",
                  background: dragOver ? "rgba(59,130,246,0.05)" : "transparent",
                }}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById("fileInput")?.click()}
              >
                <div className="text-6xl mb-4">🫁</div>
                <h3 className="text-xl font-bold mb-2">Drop CT Scan Here</h3>
                <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>or click to browse • PNG, JPG, JPEG</p>
              </div>
            ) : (
              <div className="text-center">
                <h3 className="font-bold mb-4">Uploaded Scan</h3>
                <img src={preview} alt="Preview" className="w-full rounded-lg shadow-md mb-4 max-h-[300px] object-cover" />
                <div className="flex items-center justify-between text-sm" style={{ color: "var(--muted-foreground)" }}>
                  <span className="truncate max-w-[200px] font-medium" title={file?.name}>{file?.name}</span>
                  <span>{file ? (file.size / 1024).toFixed(1) : 0} KB</span>
                </div>
                {!diagnosis && (
                   <button onClick={() => document.getElementById("fileInput")?.click()} className="text-xs text-blue-500 mt-2 hover:underline">Change File</button>
                )}
              </div>
            )}
            <input id="fileInput" type="file" accept=".png,.jpg,.jpeg" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}/>
          </div>
        </div>

        {/* Right Column: Actions / Action Status */}
        <div className="space-y-6 flex flex-col">
          <div className="card flex-1 flex flex-col justify-center text-center p-8 relative overflow-hidden min-h-[300px]">
             {/* Progress bar background */}
             {analyzing && (
               <div className="absolute top-0 left-0 h-1 bg-blue-500 transition-all duration-300" style={{width: `${uploadProgress}%`}}></div>
             )}

            {!preview ? (
               <div style={{ color: "var(--muted-foreground)" }}>
                 <div className="text-4xl mb-3 opacity-50">🔬</div>
                 <p>Upload a scan to begin analysis.</p>
               </div>
            ) : !diagnosis ? (
               <div className="space-y-6">
                 <div>
                   <h3 className="text-xl font-bold mb-2">Ready for AI Analysis</h3>
                   <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                     The Neural Network (EfficientNet-B0) will classify this slice as Normal, Benign, or Malignant and generate a Grad-CAM heatmap.
                   </p>
                 </div>
                 <button
                   onClick={handleAnalyze}
                   disabled={analyzing}
                   className="btn btn-primary w-full py-4 text-lg font-bold shadow-lg flex justify-center items-center gap-2"
                 >
                   {analyzing ? "⌛ Processing Matrix..." : "⚙️ Analyze Scan Now"}
                 </button>
                 {analyzing && <p className="text-sm animate-pulse text-blue-500 font-medium">{uploadProgress < 75 ? "Uploading to secure server..." : "Running inference engine..."}</p>}
               </div>
            ) : (
               <div className="space-y-4 text-left">
                  <h3 className="font-bold text-xl mb-4 border-b pb-2" style={{ borderColor: "var(--border)"}}>Analysis Complete</h3>
                  {cs && (
                    <div className="flex items-center gap-4 p-4 rounded-xl" style={{ background: cs.bg, border: `1px solid ${cs.color}33` }}>
                      <span className="text-4xl">{cs.icon}</span>
                      <div>
                        <div className="text-xl font-bold uppercase tracking-wider" style={{ color: cs.color }}>{cs.label}</div>
                        <div className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
                          Confidence: <span className="font-mono font-bold text-lg" style={{ color: cs.color }}>{((diagnosis.confidence || 0) * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  )}
               </div>
            )}
          </div>
        </div>
      </div>

      {/* Results Section */}
      {diagnosis && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in-up mt-8">
           {/* Detailed Probabilities & Grad-CAM */}
           <div className="card space-y-6">
             <h3 className="font-bold text-lg border-b pb-2" style={{ borderColor: "var(--border)"}}>AI Insights</h3>
             
             {/* Heatmap */}
             <div>
                <p className="text-sm font-medium mb-2" style={{ color: "var(--muted-foreground)"}}>Grad-CAM Heatmap</p>
                {diagnosis.gradcam_url ? (
                  <img src={`${API}${diagnosis.gradcam_url}?token=${token}`} alt="Grad-CAM" className="w-full rounded-lg shadow-sm border" style={{ borderColor: "var(--border)"}}/>
                ) : (
                  <div className="p-8 text-center rounded-lg border-dashed border-2" style={{borderColor: "var(--border)"}}>No heatmap generated</div>
                )}
             </div>

             {/* Probs */}
             {diagnosis.all_probabilities && (
                <div>
                  <p className="text-sm font-medium mb-3" style={{ color: "var(--muted-foreground)"}}>Probabilities Distribution</p>
                  <div className="space-y-3">
                    {Object.entries(diagnosis.all_probabilities).sort(([, a], [, b]) => b - a).map(([cls, prob]) => {
                        const s = classStyles[cls] || { bg: "rgba(148,163,184,0.12)", color: "#94a3b8", label: cls };
                        return (
                          <div key={cls}>
                            <div className="flex justify-between text-xs mb-1 font-medium"><span>{s.label}</span><span className="font-mono tracking-tighter">{(prob * 100).toFixed(1)}%</span></div>
                            <div className="h-2.5 rounded-full overflow-hidden border" style={{ background: "var(--secondary)", borderColor: "var(--border)" }}>
                              <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${prob * 100}%`, background: s.color }} />
                            </div>
                          </div>
                        );
                    })}
                  </div>
                </div>
              )}
           </div>

           {/* Interpretation & Review */}
           <div className="space-y-6">
             <div className="card">
                <h3 className="font-bold text-lg border-b pb-2 mb-4" style={{ borderColor: "var(--border)"}}>Clinical Interpretation</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--muted-foreground)"}}>
                  {diagnosis.interpretation_text}
                </p>
             </div>

             {canReview && diagnosis.review_status === "pending" ? (
               <div className="card border-2" style={{ borderColor: "rgba(59,130,246,0.3)"}}>
                 <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><span className="text-blue-500">✍️</span> Clinical Validation</h3>
                 <p className="text-sm mb-4" style={{ color: "var(--muted-foreground)"}}>Please review the AI's findings. You can add notes before approving or rejecting.</p>
                 <textarea
                   className="input mb-4 w-full"
                   style={{ background: "var(--background)", minHeight: "80px", resize: "vertical" }}
                   placeholder="Add optional medical notes here..."
                   value={reviewNotes}
                   onChange={(e) => setReviewNotes(e.target.value)}
                 />
                 <div className="flex gap-3">
                   <button onClick={() => submitReview("approved")} disabled={submitting} className="flex-1 btn py-3 text-sm font-bold shadow-sm" style={{ background: "#22c55e", color: "white" }}>
                     ✅ Approve
                   </button>
                   <button onClick={() => submitReview("rejected")} disabled={submitting} className="flex-1 btn py-3 text-sm font-bold shadow-sm" style={{ background: "#ef4444", color: "white" }}>
                     ❌ Reject
                   </button>
                 </div>
               </div>
             ) : diagnosis.review_status !== "pending" ? (
               <div className="card text-center py-8">
                 <div className="text-4xl mb-3">{diagnosis.review_status === "approved" ? "✅" : "❌"}</div>
                 <h3 className="font-bold text-lg uppercase tracking-wider" style={{ color: diagnosis.review_status === "approved" ? "#22c55e" : "#ef4444"}}>{diagnosis.review_status}</h3>
                 {diagnosis.review_notes && <p className="text-sm mt-3 px-4 italic" style={{ color: "var(--muted-foreground)"}}>"{diagnosis.review_notes}"</p>}
               </div>
             ) : null}
             
             {/* Report Download */}
             <div className="card flex items-center justify-between p-4 border" style={{ borderColor: "var(--border)", background: "linear-gradient(90deg, rgba(59,130,246,0.05), transparent)"}}>
                <div>
                   <p className="font-bold text-sm">Case Report</p>
                   <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)"}}>Download PDF with details.</p>
                </div>
                <button
                   onClick={() => window.open(`${API}/api/diagnosis/${caseData?.id}/report?token=${token}`, "_blank")}
                   className="btn btn-primary px-4 py-2 text-sm shadow-sm">
                   📥 PDF
                </button>
             </div>
           </div>
        </div>
      )}
    </div>
  );
}
