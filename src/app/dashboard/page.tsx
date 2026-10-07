"use client";

import { useCallback, useEffect, useState } from "react";

type Post = {
  id: number;
  post_id: string;
  subreddit: string;
  title: string | null;
  selftext: string | null;
  num_views: number;
  num_comments: number;
  score: number;
  heat: number;
  status: string;
  target_url: string;
};

type Comment = {
  id: number;
  body: string;
  status: string;
  is_auto: boolean;
  created_at: string;
  subreddit: string;
  title: string | null;
};

type Me = { accountId: number; username: string; authType: string };

function seg(heat: number): "HOT" | "WARM" | "COLD" {
  return heat >= 65 ? "HOT" : heat >= 40 ? "WARM" : "COLD";
}

export default function Dashboard() {
  const [me, setMe] = useState<Me | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [targets, setTargets] = useState<{ id: number; url: string; subreddit: string; keyword: string }[]>([]);
  const [sched, setSched] = useState<{ autopost: boolean; requested_comments_per_day: number; last_run_at: string | null } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string[]>([]);
  const [siteUrl, setSiteUrl] = useState("");
  const [subInput, setSubInput] = useState("");
  const [kwInput, setKwInput] = useState("");

  const log = (s: string) => setMsg((m) => [...m.slice(-6), `${new Date().toLocaleTimeString()} — ${s}`]);

  const loadAll = useCallback(async () => {
    const [meR, postsR, commentsR, autoR] = await Promise.all([
      fetch("/api/session?action=me").then((r) => r.json()),
      fetch("/api/discover").then((r) => r.json()),
      fetch("/api/comments").then((r) => r.json()),
      fetch("/api/autopilot").then((r) => r.json()),
    ]);
    if (meR.accountId) setMe(meR);
    setPosts(postsR.posts || []);
    setComments(commentsR.comments || []);
    setSched(autoR.schedule || null);
  }, []);

  useEffect(() => {
    loadAll();
    const t = setInterval(loadAll, 20000);
    return () => clearInterval(t);
  }, [loadAll]);

  if (!me) {
    return (
      <main className="p-10">
        <a href="/" className="btn btn-ghost">← Go log in</a>
      </main>
    );
  }

  async function addSite() {
    if (!siteUrl.startsWith("http")) return setMsg((m) => [...m, "Enter a full URL (https://...)"]);
    setBusy("site");
    const r = await fetch("/api/config", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ website: siteUrl }),
    });
    setBusy(null);
    if (r.ok) {
      log(`Added ${siteUrl} — now add subreddits to watch.`);
      setSiteUrl("");
      loadAll();
    }
  }

  async function addSub() {
    if (!subInput) return;
    setBusy("sub");
    const r = await fetch("/api/targets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subreddit: subInput.replace(/^\/?r\//, ""), keyword: kwInput }),
    });
    setBusy(null);
    if (r.ok) {
      log(`Watching r/${subInput.replace(/^\/?r\//, "")} for "${kwInput || "any"}"`);
      setSubInput("");
      setKwInput("");
      loadAll();
    }
  }

  async function runDiscover() {
    setBusy("discover");
    const r = await fetch("/api/discover", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    const j = await r.json();
    setBusy(null);
    log(`Discovery done — ${j.added ?? 0} new hot leads queued.`);
    loadAll();
  }

  async function toggleAuto() {
    if (!sched) return;
    setBusy("auto");
    await fetch("/api/autopilot", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ autopost: !sched.autopost }),
    });
    setBusy(null);
    log(`Autopilot ${!sched.autopost ? "ON 🚀 — Vercel cron will post 24/7" : "OFF"}`);
    loadAll();
  }

  async function runCronNow() {
    setBusy("cron");
    const r = await fetch("/api/cron", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    const j = await r.json();
    setBusy(null);
    (j.steps || []).forEach((s: string) => log(s));
    loadAll();
  }

  async function preview(p: Post) {
    setBusy(`gen-${p.id}`);
    const r = await fetch("/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ postId: p.id }),
    });
    const j = await r.json();
    setBusy(null);
    setMsg((m) => [...m.slice(-6), `Draft for "${p.title?.slice(0, 40)}…": ${String(j.text || j.error).slice(0, 140)}…`]);
  }

  async function commentNow(p: Post) {
    setBusy(`sub-${p.id}`);
    const r = await fetch("/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ postId: p.id, submit: true, maximizeQuality: true }),
    });
    const j = await r.json();
    setBusy(null);
    log(j.ok ? `Commented ${j.posted === "reddit" ? "on Reddit ✅" : "(demo mode recorded)"} on "${p.title?.slice(0, 36)}…"` : `Failed: ${j.error}`);
    loadAll();
  }

  async function logout() {
    await fetch("/api/session?action=logout");
    location.href = "/";
  }

  const hotCount = posts.filter((p) => seg(p.heat) === "HOT").length;

  return (
    <main className="p-6 md:p-10 max-w-6xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🧡</span>
          <div>
            <h1 className="text-xl font-bold">Engain</h1>
            <p className="text-xs text-neutral-400">Reddit hot-lead autopilot · by Freebuff</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-neutral-400">{me.username}</span>
          <button className="btn btn-ghost" onClick={logout}>Log out</button>
        </div>
      </header>

      {/* KPI row */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="card p-4"><p className="text-3xl font-bold acc">{posts.length}</p><p className="text-xs text-neutral-400">LEADS FOUND</p></div>
        <div className="card p-4"><p className="text-3xl font-bold acc">{hotCount}</p><p className="text-xs text-neutral-400">🔥 HOT RIGHT NOW</p></div>
        <div className="card p-4"><p className="text-3xl font-bold acc">{comments.length}</p><p className="text-xs text-neutral-400">COMMENTS MADE</p></div>
        <div className="card p-4">
          <p className="text-3xl font-bold acc">{sched?.autopost ? "ON" : "OFF"}</p>
          <p className="text-xs text-neutral-400">AUTOPILOT ({sched?.requested_comments_per_day ?? 5}/day)</p>
        </div>
      </section>

      {/* Setup row */}
      <section className="grid md:grid-cols-2 gap-4 mb-8">
        <div className="card p-5">
          <h2 className="font-semibold mb-2">1 · Your website</h2>
          <p className="text-xs text-neutral-400 mb-3">The link Engain will mention in comments.</p>
          {targets.length > 0 && (
            <p className="text-sm mb-2 acc">{targets[0].url}</p>
          )}
          <div className="flex gap-2">
            <input placeholder="https://yoursite.com" value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} />
            <button className="btn btn-primary whitespace-nowrap" onClick={addSite} disabled={busy === "site"}>Save</button>
          </div>
          <div className="flex gap-2 mt-3">
            <input placeholder="r/subreddit" className="flex-1" value={subInput} onChange={(e) => setSubInput(e.target.value)} />
            <input placeholder="keyword(s)" className="flex-1" value={kwInput} onChange={(e) => setKwInput(e.target.value)} />
            <button className="btn btn-ghost whitespace-nowrap" onClick={addSub} disabled={busy === "sub"}>Watch</button>
          </div>
        </div>
        <div className="card p-5">
          <h2 className="font-semibold mb-2">2 · Autopilot</h2>
          <p className="text-xs text-neutral-400 mb-3">Vercel cron runs discovery → comments every 10 min while ON.</p>
          <div className="flex items-center gap-3">
            <button className={`btn ${sched?.autopost ? "btn-primary" : "btn-ghost"}`} onClick={toggleAuto} disabled={busy === "auto"}>
              {sched?.autopost ? "Pause autopilot" : "Start autopilot"}
            </button>
            <button className="btn btn-ghost" onClick={runCronNow} disabled={busy === "cron"}>Run worker now</button>
          </div>
          {sched?.last_run_at && <p className="text-xs text-neutral-500 mt-2">Last run: {new Date(sched.last_run_at).toLocaleString()}</p>}
          <div className="flex items-center gap-3 mt-3">
            <button className="btn btn-ghost" onClick={runDiscover} disabled={busy === "discover"}>Find hot leads now</button>
          </div>
        </div>
      </section>

      {/* Command log */}
      {msg.length > 0 && (
        <section className="card p-4 mb-8 text-xs font-mono text-neutral-300 space-y-1">
          {msg.map((m, i) => <p key={i}>{m}</p>)}
        </section>
      )}

      {/* Leads table */}
      <section className="card p-5 mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Reddit flows — hottest first</h2>
          <span className="text-xs text-neutral-500">auto-refreshes every 20s</span>
        </div>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr><th>Heat</th><th>Subreddit</th><th>Thread</th><th>Est. views</th><th>Comments</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id}>
                  <td><span className={`badge badge-${seg(p.heat).toLowerCase()}`}>{seg(p.heat)} {p.heat}</span></td>
                  <td>r/{p.subreddit}</td>
                  <td className="max-w-[320px] truncate">{p.title}</td>
                  <td>~{p.num_views.toLocaleString()}</td>
                  <td>{p.num_comments}</td>
                  <td><span className={`badge ${p.status === "target_done" ? "badge-ok" : "badge-pending"}`}>{p.status.replace("target_", "")}</span></td>
                  <td className="whitespace-nowrap">
                    <button className="btn btn-ghost text-xs mr-1" onClick={() => preview(p)} disabled={busy === `gen-${p.id}`}>Draft</button>
                    <button className="btn btn-primary text-xs" onClick={() => commentNow(p)} disabled={busy === `sub-${p.id}`}>Comment now</button>
                  </td>
                </tr>
              ))}
              {posts.length === 0 && (
                <tr><td colSpan={7} className="text-center text-neutral-500 py-8">No leads yet — click “Find hot leads now”.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Comment log */}
      <section className="card p-5">
        <h2 className="font-semibold mb-3">Comment log</h2>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {comments.map((c) => (
            <div key={c.id} className="border-l-2 border-[#ff6a2b] pl-3">
              <p className="text-xs text-neutral-400">r/{c.subreddit} · {new Date(c.created_at).toLocaleString()} {c.is_auto ? "· autopilot" : "· manual"}</p>
              <p className="text-sm mt-1 whitespace-pre-wrap">{c.body.slice(0, 400)}</p>
            </div>
          ))}
          {comments.length === 0 && <p className="text-sm text-neutral-500">Nothing yet — comments will appear here.</p>}
        </div>
      </section>
    </main>
  );
}
