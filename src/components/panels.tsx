"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";

type Dest = { id: string; phone: string };
async function api(path: string, method = "POST", body?: unknown) {
  const r = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data: j as any };
}
const NOTICES: Record<string, string> = { gmail_connected: "Gmail connected.", gmail_denied: "Gmail access was not granted.", gmail_failed: "Gmail connection failed. Check server logs.", gmail_state_invalid: "Connection request expired or was invalid. Try again.", demo_mode_no_gmail: "Demo mode is on: Gmail connect is disabled." };
export function Notice() { const n = useSearchParams().get("notice"); return n && NOTICES[n] ? <div className="banner" role="status">{NOTICES[n]}</div> : null; }
export function SignOut() { return <button onClick={async () => { await authClient.signOut(); window.location.href = "/login"; }}>Sign out</button>; }
export function Disconnect() {
  const r = useRouter();
  return <button onClick={async () => { if (confirm("Disconnect Gmail? Tokens are revoked and stored email bodies are cleared.")) { await api("/api/gmail/disconnect"); r.refresh(); } }}>Disconnect</button>;
}

export function Destinations({ items, canAttest, pref }: { items: { id: string; phone: string; status: string; verifiedAt: string | null }[]; canAttest: boolean; pref: { timezone: string; start: string; end: string; enabled: boolean } | null }) {
  const r = useRouter(); const [phone, setPhone] = useState(""); const [consent, setConsent] = useState(false); const [msg, setMsg] = useState("");
  const [p, setP] = useState(pref ?? { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, start: "22:00", end: "07:00", enabled: true });
  return (
    <section className="card"><h2>WhatsApp destination</h2>
      <ul className="list">{items.map((d) => (
        <li key={d.id}><div className="row"><b>{d.phone}</b><span className={`badge ${d.status === "VERIFIED" ? "ok" : "warn"}`}>{d.status}</span>
          {d.status === "PENDING" && canAttest && <button onClick={async () => { await api(`/api/destinations/${d.id}/attest`); r.refresh(); }}>Mark as mine (dev)</button>}
          {d.status !== "REVOKED" && <button onClick={async () => { if (confirm("Revoke consent and stop notifications to this number?")) { await api(`/api/destinations/${d.id}/revoke`); r.refresh(); } }}>Revoke</button>}</div>
          {d.status === "PENDING" && <div className="mute">To verify: send any WhatsApp message to the business number from this phone (opens the 24h window). Reply STOP at any time to opt out.</div>}</li>))}
        {!items.length && <li className="mute">No number yet.</li>}</ul>
      <form onSubmit={async (e) => { e.preventDefault(); const x = await api("/api/destinations", "POST", { phone, consent }); setMsg(x.ok ? "" : x.data.message ?? x.data.error); if (x.ok) { setPhone(""); setConsent(false); r.refresh(); } }}>
        <input type="tel" placeholder="+256700000000" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        <label className="mute" style={{ display: "block", margin: "8px 0" }}><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> I agree to receive WhatsApp notifications from Mail Bridge AI on this number, and that short summaries of my emails will be sent to WhatsApp (Meta) to deliver them.</label>
        <button className="primary" disabled={!consent || !phone}>Add number</button> {msg && <span className="bad" role="alert">{msg}</span>}</form>
      <h2 style={{ marginTop: 16 }}>Quiet hours</h2>
      <div className="row"><input type="text" style={{ width: 170 }} value={p.timezone} onChange={(e) => setP({ ...p, timezone: e.target.value })} aria-label="Timezone" />
        <input type="text" style={{ width: 70 }} value={p.start} onChange={(e) => setP({ ...p, start: e.target.value })} aria-label="Quiet start" /> to <input type="text" style={{ width: 70 }} value={p.end} onChange={(e) => setP({ ...p, end: e.target.value })} aria-label="Quiet end" />
        <label><input type="checkbox" checked={p.enabled} onChange={(e) => setP({ ...p, enabled: e.target.checked })} /> enabled</label>
        <button onClick={async () => { const x = await api("/api/preferences", "PUT", { timezone: p.timezone, quietHoursStart: p.start, quietHoursEnd: p.end, notificationsEnabled: p.enabled }); setMsg(x.ok ? "Saved" : "Invalid timezone or time (use HH:mm)"); r.refresh(); }}>Save</button></div>
      <p className="mute">Summary alerts are held during quiet hours. Test messages are not.</p>
    </section>);
}

type MailItem = { id: string; subject: string; senderName: string; senderEmail: string; snippet: string; receivedAt: string; summarized?: boolean };
export function Emails({ connected }: { destinations: Dest[]; connected: boolean }) {
  const r = useRouter(); const [items, setItems] = useState<MailItem[] | null>(null); const [demo, setDemo] = useState(false); const [err, setErr] = useState(""); const [busy, setBusy] = useState<string | null>(null);
  async function load() { setErr(""); const x = await api("/api/emails", "GET"); if (x.ok) { setItems(x.data.items); setDemo(x.data.demo); } else setErr(x.data.message ?? x.data.error); }
  useEffect(() => { if (connected) load(); }, [connected]);
  return (
    <section className="card"><div className="row"><h2 style={{ margin: 0 }}>Recent emails</h2>{demo && <span className="badge demo">DEMO DATA</span>}<button onClick={load} disabled={!connected}>Refresh</button></div>
      {!connected && <p className="mute">Connect Gmail first.</p>}{err && <p className="bad" role="alert">{err}</p>}
      <ul className="list">{items?.map((m) => (
        <li key={m.id}><b>{m.subject}</b> {m.summarized && <span className="badge ok">summarized</span>}<div className="mute">{m.senderName || m.senderEmail} · {new Date(m.receivedAt).toLocaleString()}</div><div className="mute">{m.snippet}</div>
          <button disabled={busy === m.id} onClick={async () => { setBusy(m.id); const x = await api("/api/summaries", "POST", { messageId: m.id }); setBusy(null); if (x.ok) { await load(); r.refresh(); } else setErr(x.data.message ?? x.data.error); }}>{busy === m.id ? "Summarizing…" : m.summarized ? "Re-summarize" : "Summarize"}</button></li>))}
        {items && !items.length && <li className="mute">No recent emails.</li>}</ul></section>);
}

type Sum = { id: string; subject: string; sender: string; mainMessage: string; requiredAction: string | null; deadline: string | null; priority: string; priorityReason: string; permalink: string; demo: boolean; provider: string; warnings: string[]; createdAt: string };
export function SummaryList({ items, destinations }: { items: Sum[]; destinations: Dest[] }) {
  const r = useRouter(); const [msg, setMsg] = useState("");
  return (
    <section className="card"><h2>Summaries</h2>{msg && <p role="status" className="mute">{msg}</p>}
      <ul className="list">{items.map((s) => (
        <li key={s.id}><div className="row"><b>{s.subject}</b><span className="badge">{s.priority}</span>{s.demo && <span className="badge demo">DEMO</span>}</div>
          <dl className="summary"><dt>From</dt><dd>{s.sender}</dd><dt>Main message</dt><dd>{s.mainMessage}</dd>
            <dt>Required action</dt><dd>{s.requiredAction ?? "None found in the email"}</dd><dt>Deadline</dt><dd>{s.deadline ?? "None stated in the email"}</dd>
            <dt>Priority</dt><dd>{s.priority}: {s.priorityReason}</dd></dl>
          {s.warnings.map((w) => <div key={w} className="warn mute">⚠ {w}</div>)}
          <div className="mute">Generated by {s.provider} · {s.demo ? "synthetic email" : <a href={s.permalink} target="_blank" rel="noopener noreferrer">open original in Gmail</a>}</div>
          <div className="row" style={{ marginTop: 6 }}>{destinations.map((d) => (
            <button key={d.id} onClick={async () => { const x = await api("/api/notifications", "POST", { destinationId: d.id, kind: "SUMMARY", summaryId: s.id }); setMsg(x.ok ? (x.data.duplicate ? "Already queued or sent for this summary." : "Queued. The worker will send it.") : x.data.message ?? x.data.error); r.refresh(); }}>Send to WhatsApp {d.phone}</button>))}
            {!destinations.length && <span className="mute">Verify a WhatsApp number to send.</span>}</div></li>))}
        {!items.length && <li className="mute">No summaries yet. Pick an email.</li>}</ul>
      {destinations.length > 0 && <div className="row"><span className="mute">Connectivity test:</span>{destinations.map((d) => <button key={d.id} onClick={async () => { const x = await api("/api/notifications", "POST", { destinationId: d.id, kind: "TEST" }); setMsg(x.ok ? "Test queued." : x.data.message ?? x.data.error); r.refresh(); }}>Send test to {d.phone}</button>)}</div>}
    </section>);
}

type Att = { id: string; kind: string; subject: string | null; to: string; status: string; error: string | null; code: string | null; providerId: string | null; demo: boolean; at: string };
const COLOR: Record<string, string> = { DELIVERED: "ok", READ: "ok", FAILED: "bad", UNKNOWN: "warn" };
export function History({ items, poll }: { items: Att[]; poll: boolean }) {
  const r = useRouter();
  useEffect(() => { if (!poll) return; const t = setInterval(() => r.refresh(), 4000); return () => clearInterval(t); }, [poll, r]);
  return (
    <section className="card full"><h2>Notification history {poll && <span className="mute">(updating…)</span>}</h2>
      <table><thead><tr><th>Time</th><th>Type</th><th>Email</th><th>To</th><th>Status</th><th>Detail</th></tr></thead><tbody>
        {items.map((a) => (<tr key={a.id}><td>{new Date(a.at).toLocaleString()}</td><td>{a.kind}</td><td>{a.subject ?? "—"}</td><td>{a.to}</td>
          <td><span className={COLOR[a.status] ?? ""}>{a.status}</span> {a.demo && <span className="badge demo">DEMO</span>}</td>
          <td>{a.error && <div className="mute">{a.code}: {a.error}</div>}{a.providerId && <div className="mute">id {a.providerId.slice(0, 18)}…</div>}
            {a.status === "UNKNOWN" && <div className="row"><button onClick={async () => { await api(`/api/notifications/${a.id}/resolve`, "POST", { outcome: "received" }); r.refresh(); }}>I received it</button>
              <button onClick={async () => { await api(`/api/notifications/${a.id}/resolve`, "POST", { outcome: "not_received" }); r.refresh(); }}>I did not receive it</button></div>}</td></tr>))}
        {!items.length && <tr><td colSpan={6} className="mute">No notifications yet.</td></tr>}</tbody></table></section>);
}
