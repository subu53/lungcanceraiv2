"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

const API = "http://127.0.0.1:8000";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: "📊" },
  { label: "Upload Scan", href: "/dashboard/upload", icon: "📤", hideForClinician: true },
  { label: "Users", href: "/dashboard/users", icon: "👥", adminOnly: true },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [userName, setUserName] = useState("User");
  const [userRole, setUserRole] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/"); return; }

    setUserRole(localStorage.getItem("userRole") || "");
    setUserName(localStorage.getItem("userName") || "User");

    fetch(`${API}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(user => {
        setUserName(user.name);
        setUserRole(user.role);
        localStorage.setItem("userName", user.name);
        localStorage.setItem("userRole", user.role);
      })
      .catch(() => { localStorage.clear(); router.push("/"); });
  }, [router]);

  const logout = () => { localStorage.clear(); router.push("/"); };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside
        className="flex flex-col transition-all duration-300"
        style={{
          width: collapsed ? "72px" : "260px",
          background: "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
          borderRight: "1px solid var(--border)",
        }}
      >
        <div className="flex items-center gap-3 p-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="p-1.5 rounded-lg flex-shrink-0" style={{ background: "rgba(59,130,246,0.12)" }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2"><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/></svg>
          </div>
          {!collapsed && <span className="font-bold text-base tracking-tight">Lung Cancer AI</span>}
          <button onClick={() => setCollapsed(!collapsed)} className="ml-auto p-1 rounded hover:bg-white/5 text-sm" style={{ color: "var(--muted-foreground)" }}>
            {collapsed ? "→" : "←"}
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(item => {
            if (item.adminOnly && userRole !== "admin") return null;
            if (item.hideForClinician && userRole === "clinician") return null;
            const isActive = pathname === item.href;
            return (
              <a key={item.href} href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: isActive ? "rgba(59,130,246,0.12)" : "transparent",
                  color: isActive ? "#3b82f6" : "var(--muted-foreground)",
                }}
              >
                <span className="text-lg">{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </a>
            );
          })}
        </nav>

        <div className="p-4" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6)" }}>
              {userName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
            </div>
            {!collapsed && (
              <div className="overflow-hidden">
                <div className="text-sm font-medium truncate">{userName}</div>
                <div className="text-xs capitalize" style={{ color: "var(--muted-foreground)" }}>{userRole}</div>
              </div>
            )}
          </div>
          <button onClick={logout} className="w-full btn text-sm py-2" style={{ background: "rgba(229,57,53,0.1)", color: "#e53935", border: "1px solid rgba(229,57,53,0.2)" }}>
            {collapsed ? "🚪" : "Sign Out"}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
