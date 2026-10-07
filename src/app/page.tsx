"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/session?action=me").then((r) => {
      if (r.ok) location.href = "/dashboard";
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const r = await fetch(`/api/session?action=${mode}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const j = await r.json();
    setBusy(false);
    if (r.ok) location.href = "/dashboard";
    else setErr(j.error || "Something went wrong");
  }

  async function demo() {
    setBusy(true);
    await fetch("/api/session?action=demo-login", { method: "POST" });
    setBusy(false);
    location.href = "/dashboard";
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🧡</div>
          <h1 className="text-3xl font-bold mb-2">Engain</h1>
          <p className="text-neutral-400 text-sm">
            Find Reddit threads already getting <span className="acc">views and clicks</span>, then comment with your link and let the autopilot go.
          </p>
        </div>

        <div className="card p-6">
          <div className="flex gap-2 mb-4">
            <button className={`btn flex-1 ${mode === "login" ? "btn-primary" : "btn-ghost"}`} onClick={() => setMode("login")}>Log in</button>
            <button className={`btn flex-1 ${mode === "register" ? "btn-primary" : "btn-ghost"}`} onClick={() => setMode("register")}>Create account</button>
          </div>
          <form onSubmit={submit} className="space-y-3">
            <input placeholder="username" value={username} onChange={(e) => setUsername(e.target.value)} />
            <input placeholder="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            {err && <p className="text-sm text-red-400">{err}</p>}
            <button className="btn btn-primary w-full" disabled={busy} type="submit">
              {busy ? "…" : mode === "login" ? "Log in" : "Create account"}
            </button>
          </form>
          <button className="btn btn-ghost w-full mt-3" onClick={demo} disabled={busy}>
            Try the demo (no signup) →
          </button>
        </div>
        <p className="text-center text-xs text-neutral-500 mt-6">
          Autopost runs on Vercel Cron · Postgres on Neon · built by Freebuff
        </p>
      </div>
    </main>
  );
}
