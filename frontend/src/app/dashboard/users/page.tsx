"use client";

import { useEffect, useState } from "react";

const API = "";

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", password: "", role: "radiologist" });
  const [creating, setCreating] = useState(false);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const fetchUsers = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/auth/users`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setUsers(await res.json());
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch(`${API}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setForm({ email: "", name: "", password: "", role: "radiologist" });
        setShowForm(false);
        await fetchUsers();
      } else {
        const e = await res.json().catch(() => null);
        alert(e?.detail || "Failed to create user");
      }
    } catch (err: any) { alert("Error: " + err.message); }
    setCreating(false);
  };

  const toggleActive = async (user: User) => {
    try {
      await fetch(`${API}/api/auth/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ is_active: !user.is_active }),
      });
      await fetchUsers();
    } catch {}
  };

  const updateRole = async (user: User, newRole: string) => {
    try {
      await fetch(`${API}/api/auth/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role: newRole }),
      });
      await fetchUsers();
    } catch {}
  };

  const deleteUser = async (user: User) => {
    if (!confirm(`Delete user ${user.email}?`)) return;
    try {
      const res = await fetch(`${API}/api/auth/users/${user.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) await fetchUsers();
      else { const e = await res.json().catch(() => null); alert(e?.detail || "Failed"); }
    } catch {}
  };

  const roleColors: Record<string, { bg: string; color: string }> = {
    admin: { bg: "rgba(139,92,246,0.12)", color: "#8b5cf6" },
    radiologist: { bg: "rgba(59,130,246,0.12)", color: "#3b82f6" },
    clinician: { bg: "rgba(34,197,94,0.12)", color: "#22c55e" },
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p style={{ color: "var(--muted-foreground)" }} className="text-sm mt-1">Manage system users and roles</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn btn-primary">
          {showForm ? "✕ Cancel" : "➕ Add User"}
        </button>
      </div>

      {showForm && (
        <div className="card mb-6 animate-fade-in">
          <h3 className="font-bold mb-4">Create New User</h3>
          <form onSubmit={createUser} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>Name</label>
              <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>Email</label>
              <input type="email" className="input" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>Password</label>
              <input type="password" className="input" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>Role</label>
              <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="radiologist">Radiologist</option>
                <option value="clinician">Clinician</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="col-span-2">
              <button type="submit" disabled={creating} className="btn btn-primary py-2">
                {creating ? "Creating..." : "Create User"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        {loading ? (
          <div className="text-center py-12 animate-pulse" style={{ color: "var(--muted-foreground)" }}>Loading users...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th className="text-left py-3 font-medium" style={{ color: "var(--muted-foreground)" }}>Name</th>
                <th className="text-left py-3 font-medium" style={{ color: "var(--muted-foreground)" }}>Email</th>
                <th className="text-left py-3 font-medium" style={{ color: "var(--muted-foreground)" }}>Role</th>
                <th className="text-left py-3 font-medium" style={{ color: "var(--muted-foreground)" }}>Status</th>
                <th className="text-right py-3 font-medium" style={{ color: "var(--muted-foreground)" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const rc = roleColors[u.role] || roleColors.clinician;
                return (
                  <tr key={u.id} style={{ borderBottom: "1px solid var(--border)" }} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 font-medium">{u.name}</td>
                    <td className="py-3" style={{ color: "var(--muted-foreground)" }}>{u.email}</td>
                    <td className="py-3">
                      <select
                        className="text-xs px-2 py-1 rounded border-0 cursor-pointer"
                        style={{ background: rc.bg, color: rc.color }}
                        value={u.role}
                        onChange={(e) => updateRole(u, e.target.value)}
                      >
                        <option value="admin">Admin</option>
                        <option value="radiologist">Radiologist</option>
                        <option value="clinician">Clinician</option>
                      </select>
                    </td>
                    <td className="py-3">
                      <button onClick={() => toggleActive(u)} className="text-xs px-2 py-1 rounded font-medium"
                        style={{
                          background: u.is_active ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                          color: u.is_active ? "#22c55e" : "#ef4444",
                        }}
                      >
                        {u.is_active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="py-3 text-right">
                      <button onClick={() => deleteUser(u)} className="btn text-xs py-1 px-3" style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444" }}>
                        🗑️ Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
