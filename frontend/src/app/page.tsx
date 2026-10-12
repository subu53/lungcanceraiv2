"use client";

import { useState } from "react";

const API = "http://127.0.0.1:8000";

export default function LoginPage() {
  const [role, setRole] = useState<"radiologist" | "admin" | "clinician">("radiologist");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ username: email, password }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.detail || "Invalid credentials");
      }

      const data = await response.json();
      localStorage.setItem("token", data.access_token);

      try {
        const meRes = await fetch(`${API}/api/auth/me`, {
          headers: { Authorization: `Bearer ${data.access_token}` },
        });
        if (meRes.ok) {
          const user = await meRes.json();
          localStorage.setItem("userRole", user.role);
          localStorage.setItem("userName", user.name);
        }
      } catch {}

      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(err.message || "Login failed.");
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="card w-full max-w-md animate-fade-in relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1" style={{ background: "linear-gradient(to right, #3b82f6, #8b5cf6)" }}></div>

        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="p-2 rounded-lg" style={{ background: "rgba(59,130,246,0.12)" }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/></svg>
            </div>
          </div>
          <h1 className="text-3xl font-bold" style={{ background: "linear-gradient(to right, #3b82f6, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Lung Cancer AI
          </h1>
          <p style={{ color: "var(--muted-foreground)" }} className="mt-2">CT Image Classification System</p>
        </div>

        <div className="flex p-1 rounded-lg mb-6" style={{ background: "var(--secondary)" }}>
          {(["radiologist", "admin", "clinician"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${role === r ? "text-white shadow-sm" : "hover:text-white"}`}
              style={{ background: role === r ? "var(--primary)" : "transparent", color: role === r ? "#fff" : "var(--muted-foreground)" }}
            >
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>Email</label>
            <input type="email" required className="input" placeholder={role === "admin" ? "admin@lung.ai" : role === "clinician" ? "clinician@hospital.com" : "doctor@hospital.com"} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>Password</label>
            <input type="password" required className="input" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>

          {error && (
            <div className="p-3 rounded text-sm" style={{ background: "rgba(229,57,53,0.1)", border: "1px solid rgba(229,57,53,0.2)", color: "#e53935" }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="w-full btn btn-primary py-3 text-base">
            {loading ? "Signing in..." : "Sign In to Dashboard"}
          </button>
        </form>

        <div className="mt-6 text-center text-xs" style={{ color: "var(--muted-foreground)" }}>
          <p>Powered by EfficientNet-B0 &amp; Grad-CAM</p>
          <p style={{ opacity: 0.5 }}>v2.0.0 • CT Classification System</p>
        </div>
      </div>
    </main>
  );
}
