"use client";

import { FormEvent, useEffect, useState } from "react";

type ListedUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
};

type UserPage = { users: ListedUser[]; page: number; pageCount: number; total: number };

export function StaffManager() {
  const [data, setData] = useState<UserPage | null>(null);
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    void fetch(`/api/users?page=${page}`)
      .then(async (response) => {
        const result = (await response.json()) as UserPage & { error?: string };
        if (!response.ok) throw new Error(result.error ?? "Unable to load users.");
        if (active) setData(result);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to load users.");
      });
    return () => { active = false; };
  }, [page, refreshKey]);

  async function createStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const form = event.currentTarget;

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(form).entries())),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Unable to create staff account.");
        return;
      }
      form.reset();
      setPage(1);
      setRefreshKey((key) => key + 1);
      setNotice("Staff account created.");
    } catch {
      setError("A network error occurred. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="staff-grid">
      <section className="staff-form-panel" aria-labelledby="create-staff-title">
        <div className="page-heading">
          <p className="eyebrow">ACCESS MANAGEMENT</p>
          <h1 id="create-staff-title">Create staff account</h1>
        </div>
        <form className="auth-form" onSubmit={createStaff}>
          <label className="form-field">
            <span>Name</span><input name="name" autoComplete="name" required maxLength={120} />
          </label>
          <label className="form-field">
            <span>Email</span><input name="email" type="email" autoComplete="email" required />
          </label>
          <label className="form-field">
            <span>Temporary password</span>
            <input name="password" type="password" autoComplete="new-password" minLength={9} required />
          </label>
          {error && <p className="form-message form-error" role="alert">{error}</p>}
          {notice && <p className="form-message form-success" role="status">{notice}</p>}
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create staff"}
          </button>
        </form>
      </section>

      <section className="staff-list" aria-labelledby="users-title">
        <div className="staff-list-heading">
          <div className="page-heading">
            <p className="eyebrow">DIRECTORY</p><h1 id="users-title">Users</h1>
          </div>
          <span className="user-total">{data?.total ?? 0} total</span>
        </div>
        {error && !data && <p className="form-message form-error" role="alert">{error}</p>}
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr></thead>
            <tbody>
              {data?.users.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td><td>{user.email}</td>
                  <td><span className="role-label">{user.role}</span></td>
                  <td>{user.isActive ? "Active" : "Inactive"}</td>
                </tr>
              ))}
              {data && data.users.length === 0 && <tr><td colSpan={4}>No users found.</td></tr>}
              {!data && <tr><td colSpan={4}>Loading users…</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="pagination-bar">
          <span>Page {data?.page ?? page} of {data?.pageCount ?? 1}</span>
          <div>
            <button className="quiet-button" type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
            <button className="quiet-button" type="button" disabled={!data || page >= data.pageCount} onClick={() => setPage((value) => value + 1)}>Next</button>
          </div>
        </div>
      </section>
    </div>
  );
}