import { useState, useEffect } from "react";
import { api } from "../../api/client";
import { Card } from "../../components/Card";

interface TeamMember {
  id: number;
  username: string;
  role: string;
  created_by: string | null;
  created_at: string;
}

export function TeamManagement() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ username: "", password: "", role: "developer" });
  const [error, setError] = useState("");

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const data = await api.get<TeamMember[]>("/team");
      setMembers(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMembers(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      if (editId) {
        await api.put(`/team/${editId}`, form);
      } else {
        await api.post("/team", form);
      }
      setShowForm(false);
      setEditId(null);
      setForm({ username: "", password: "", role: "developer" });
      fetchMembers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to remove this team member?")) return;
    try {
      await api.delete(`/team/${id}`);
      fetchMembers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const startEdit = (member: TeamMember) => {
    setEditId(member.id);
    setForm({ username: member.username, password: "", role: member.role });
    setShowForm(true);
  };

  return (
    <Card
      title="Team Management"
      action={
        !showForm && (
          <button
            onClick={() => { setShowForm(true); setEditId(null); setForm({ username: "", password: "", role: "developer" }); }}
            className="px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary-hover transition-colors cursor-pointer"
          >
            Add Member
          </button>
        )
      }
    >
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-slate-50 rounded-lg p-4 mb-4 space-y-3">
          <h3 className="font-medium text-slate-700">{editId ? "Edit" : "Add"} Team Member</h3>
          <div className="grid grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-primary outline-none"
              required
            />
            <input
              type="password"
              placeholder={editId ? "New password (optional)" : "Password"}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-primary outline-none"
              required={!editId}
            />
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-primary outline-none"
            >
              <option value="developer">Developer</option>
              <option value="administrator">Administrator</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary-hover cursor-pointer">
              {editId ? "Update" : "Create"}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setEditId(null); }}
              className="px-4 py-2 border border-slate-300 text-slate-600 text-sm rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-slate-500 text-sm">Loading team...</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left py-3 px-2 font-medium text-slate-500">Username</th>
              <th className="text-left py-3 px-2 font-medium text-slate-500">Role</th>
              <th className="text-left py-3 px-2 font-medium text-slate-500">Created By</th>
              <th className="text-left py-3 px-2 font-medium text-slate-500">Created At</th>
              <th className="text-right py-3 px-2 font-medium text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="py-3 px-2 font-medium text-slate-800">{m.username}</td>
                <td className="py-3 px-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    m.role === "administrator" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                  }`}>
                    {m.role}
                  </span>
                </td>
                <td className="py-3 px-2 text-slate-500">{m.created_by || "—"}</td>
                <td className="py-3 px-2 text-slate-500">{m.created_at}</td>
                <td className="py-3 px-2 text-right">
                  <button onClick={() => startEdit(m)} className="text-primary hover:text-primary-hover mr-3 cursor-pointer">
                    Edit
                  </button>
                  {m.username !== "sivaji" && (
                    <button onClick={() => handleDelete(m.id)} className="text-red-600 hover:text-red-700 cursor-pointer">
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
