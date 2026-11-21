"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";

type Dest = { id: string; phone: string; status: string; verifiedAt: string | null };

async function api(path: string, method = "POST", body?: unknown) {
  const r = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data: j as any };
}

const NOTICES: Record<string, string> = {
  gmail_connected: "Gmail connected successfully.",
  gmail_denied: "Gmail access was not granted. Please approve read permissions.",
  gmail_failed: "Gmail connection failed. Check server logs.",
  gmail_state_invalid: "Connection request expired or was invalid. Please try again.",
  demo_mode_no_gmail: "Demo mode is active: Gmail connection is simulated with synthetic data.",
};

export function Notice() {
  const n = useSearchParams().get("notice");
  return n && NOTICES[n] ? <div className="banner info" role="status">{NOTICES[n]}</div> : null;
}

export function SignOut() {
  return (
    <button
      onClick={async () => {
        await authClient.signOut();
        window.location.href = "/login";
      }}
      aria-label="Sign out of account"
    >
      Sign out
    </button>
  );
}

export function OnboardingGuide({
  hasGmail,
  hasVerifiedDest,
  hasCustomPref,
  hasDelivered,
}: {
  hasGmail: boolean;
  hasVerifiedDest: boolean;
  hasCustomPref: boolean;
  hasDelivered: boolean;
}) {
  const steps = [
    { num: "Step 1", title: "Connect Gmail", done: hasGmail, desc: hasGmail ? "Connected" : "Connect your mailbox" },
    { num: "Step 2", title: "WhatsApp Number", done: hasVerifiedDest, desc: hasVerifiedDest ? "Verified" : "Add & verify number" },
    { num: "Step 3", title: "Quiet Hours & Filter", done: hasCustomPref, desc: hasCustomPref ? "Configured" : "Set timezone & priority" },
    { num: "Step 4", title: "Summarize & Send", done: hasDelivered, desc: hasDelivered ? "Notification sent" : "Test notification" },
  ];

  return (
    <section className="stepper" aria-label="Onboarding Progress">
      {steps.map((s, idx) => (
        <div key={idx} className={`step-card ${s.done ? "done" : "active"}`}>
          <span className="step-num">{s.num}</span>
          <span className="step-title">{s.title}</span>
          <span className="step-status">{s.done ? "✓ " + s.desc : "○ " + s.desc}</span>
        </div>
      ))}
    </section>
  );
}

export function GmailPanel({
  conn,
  demo,
  checkpoint,
}: {
  conn: { emailAddress: string; status: string; lastSyncAt: string | null } | null;
  demo: boolean;
  checkpoint: { cursor: string | null; lastRunAt: string | null } | null;
}) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleSync() {
    setSyncing(true);
    setMsg("");
    const res = await api("/api/gmail/sync", "POST");
    setSyncing(false);
    if (res.ok) {
      setMsg(`Synced: ${res.data.newEmails} new email(s), ${res.data.newSummaries} summary(ies) generated.`);
      router.refresh();
    } else {
      setMsg(res.data.message ?? res.data.error ?? "Sync failed");
    }
  }

  async function handleDisconnect() {
    if (confirm("Disconnect Gmail? Access tokens are revoked and stored email bodies will be wiped.")) {
      await api("/api/gmail/disconnect");
      router.refresh();
    }
  }

  return (
    <section className="card" aria-labelledby="gmail-heading">
      <h2 id="gmail-heading">
        <span>📬</span> Gmail Connection
      </h2>
      {demo ? (
        <div>
          <p>
            <span className="badge demo">DEMO MODE ACTIVE</span>
          </p>
          <p className="mute">Using synthetic emails for testing with no live Google credentials.</p>
        </div>
      ) : !conn || conn.status === "DISCONNECTED" ? (
        <div>
          <p className="mute">Connect your Gmail account to read recent emails (read-only minimum scope).</p>
          <p>
            <a className="btn primary" href="/api/gmail/connect">
              Connect Gmail
            </a>
          </p>
        </div>
      ) : (
        <div>
          <div className="row" style={{ marginBottom: 12 }}>
            <span className={`badge ${conn.status === "ACTIVE" ? "ok" : "bad"}`}>
              ● {conn.status === "ACTIVE" ? "Connected" : "Needs Reconnect"}
            </span>
            <b>{conn.emailAddress}</b>
          </div>
          <p className="mute">Scope: https://www.googleapis.com/auth/gmail.readonly. Tokens encrypted with AES-256-GCM.</p>
          {conn.lastSyncAt && (
            <p className="mute">
              Last Synced: {new Date(conn.lastSyncAt).toLocaleString()}
              {checkpoint?.cursor && <span> (checkpoint: {checkpoint.cursor.slice(0, 16)})</span>}
            </p>
          )}
          <div className="row" style={{ marginTop: 14 }}>
            <button className="primary small" onClick={handleSync} disabled={syncing}>
              {syncing ? "Syncing…" : "Sync Now"}
            </button>
            <a className="btn small" href="/api/gmail/connect">
              Reconnect
            </a>
            <button className="small danger" onClick={handleDisconnect}>
              Disconnect
            </button>
          </div>
          {msg && <p className="mute ok" role="status" style={{ marginTop: 8 }}>{msg}</p>}
        </div>
      )}
      {demo && (
        <div style={{ marginTop: 14 }}>
          <button className="primary small" onClick={handleSync} disabled={syncing}>
            {syncing ? "Simulating sync…" : "Simulate Sync Now"}
          </button>
          {msg && <p className="mute ok" role="status" style={{ marginTop: 8 }}>{msg}</p>}
        </div>
      )}
    </section>
  );
}

export function DestinationsPanel({
  items,
  canAttest,
}: {
  items: Dest[];
  canAttest: boolean;
}) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    const res = await api("/api/destinations", "POST", { phone, consent });
    setLoading(false);
    if (res.ok) {
      setPhone("");
      setConsent(false);
      router.refresh();
    } else {
      setMsg(res.data.message ?? res.data.error ?? "Failed to add destination");
    }
  }

  return (
    <section className="card" aria-labelledby="dest-heading">
      <h2 id="dest-heading">
        <span>💬</span> WhatsApp Destination & Consent
      </h2>
      <ul className="list">
        {items.map((d) => (
          <li key={d.id}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <b>{d.phone}</b>{" "}
                <span className={`badge ${d.status === "VERIFIED" ? "ok" : d.status === "PENDING" ? "warn" : "bad"}`}>
                  {d.status}
                </span>
                {d.verifiedAt && <span className="mute" style={{ marginLeft: 8 }}>Verified {new Date(d.verifiedAt).toLocaleDateString()}</span>}
              </div>
              <div className="row">
                {d.status === "PENDING" && canAttest && (
                  <button
                    className="small"
                    onClick={async () => {
                      await api(`/api/destinations/${d.id}/attest`);
                      router.refresh();
                    }}
                  >
                    Mark Verified (dev)
                  </button>
                )}
                {d.status !== "REVOKED" && (
                  <button
                    className="small danger"
                    onClick={async () => {
                      if (confirm("Revoke consent and stop WhatsApp alerts to this number?")) {
                        await api(`/api/destinations/${d.id}/revoke`);
                        router.refresh();
                      }
                    }}
                  >
                    Revoke
                  </button>
                )}
              </div>
            </div>
            {d.status === "PENDING" && (
              <p className="mute" style={{ marginTop: 6 }}>
                Verification: Send any WhatsApp message to our business number to confirm ownership and open the 24h messaging window. Reply STOP at any time to opt out.
              </p>
            )}
          </li>
        ))}
        {!items.length && <li className="mute">No WhatsApp numbers registered yet.</li>}
      </ul>

      <form onSubmit={handleAdd} style={{ marginTop: 16 }}>
        <h3>Add WhatsApp Number</h3>
        <p>
          <input
            type="tel"
            placeholder="+256700000000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            aria-label="Phone number with country code"
          />
        </p>
        <label className="mute" style={{ display: "flex", gap: 8, alignItems: "flex-start", margin: "10px 0" }}>
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            style={{ marginTop: 3 }}
          />
          <span>
            I consent to receive automated email summaries via WhatsApp from Mail Bridge AI. I acknowledge that message delivery requires sharing summarized email content with WhatsApp (Meta). I can reply STOP anytime to revoke consent.
          </span>
        </label>
        <button className="primary" disabled={!consent || !phone || loading}>
          {loading ? "Adding…" : "Add & Register Consent"}
        </button>
        {msg && (
          <span className="bad" role="alert" style={{ marginLeft: 10 }}>
            {msg}
          </span>
        )}
      </form>
    </section>
  );
}

export function PreferencesPanel({
  pref,
  destinations,
}: {
  pref: {
    timezone: string;
    quietHoursStart: string;
    quietHoursEnd: string;
    notificationsEnabled: boolean;
    minPriority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
    digestEnabled: boolean;
    digestTime: string;
    autoSyncEnabled: boolean;
    syncIntervalMinutes: number;
    lastDigestSentAt: string | null;
  } | null;
  destinations: Dest[];
}) {
  const router = useRouter();
  const defaultTz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";
  const [p, setP] = useState(
    pref ?? {
      timezone: defaultTz,
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
      notificationsEnabled: true,
      minPriority: "HIGH" as const,
      digestEnabled: true,
      digestTime: "08:00",
      autoSyncEnabled: true,
      syncIntervalMinutes: 15,
      lastDigestSentAt: null,
    }
  );
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [digestSending, setDigestSending] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    const res = await api("/api/preferences", "PUT", p);
    setSaving(false);
    if (res.ok) {
      setMsg("Preferences saved.");
      router.refresh();
    } else {
      setMsg(res.data.message ?? res.data.error ?? "Failed to save preferences.");
    }
  }

  async function handleSendDigest() {
    const verifiedDest = destinations.find((d) => d.status === "VERIFIED");
    if (!verifiedDest) {
      alert("Please verify a WhatsApp destination first.");
      return;
    }
    setDigestSending(true);
    const res = await api("/api/notifications", "POST", {
      destinationId: verifiedDest.id,
      kind: "DIGEST",
    });
    setDigestSending(false);
    if (res.ok) {
      alert("Daily digest notification queued!");
      router.refresh();
    } else {
      alert(res.data.message ?? res.data.error ?? "Failed to queue digest.");
    }
  }

  return (
    <section className="card" aria-labelledby="pref-heading">
      <h2 id="pref-heading">
        <span>⚙️</span> Quiet Hours & Priority Filters
      </h2>
      <form onSubmit={handleSave}>
        <div style={{ marginBottom: 12 }}>
          <label className="mute" style={{ display: "block", marginBottom: 4 }}>
            Timezone
          </label>
          <input
            type="text"
            value={p.timezone}
            onChange={(e) => setP({ ...p, timezone: e.target.value })}
            required
            aria-label="Timezone"
          />
        </div>

        <div className="row" style={{ marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label className="mute" style={{ display: "block", marginBottom: 4 }}>
              Quiet Hours Start
            </label>
            <input
              type="text"
              placeholder="22:00"
              value={p.quietHoursStart}
              onChange={(e) => setP({ ...p, quietHoursStart: e.target.value })}
              required
              aria-label="Quiet hours start"
            />
          </div>
          <div style={{ flex: 1 }}>
            <label className="mute" style={{ display: "block", marginBottom: 4 }}>
              Quiet Hours End
            </label>
            <input
              type="text"
              placeholder="07:00"
              value={p.quietHoursEnd}
              onChange={(e) => setP({ ...p, quietHoursEnd: e.target.value })}
              required
              aria-label="Quiet hours end"
            />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label className="mute" style={{ display: "block", marginBottom: 4 }}>
            Instant WhatsApp Notification Minimum Priority
          </label>
          <select
            value={p.minPriority}
            onChange={(e) => setP({ ...p, minPriority: e.target.value as any })}
            aria-label="Minimum priority for instant notification"
          >
            <option value="URGENT">URGENT only (Highest signal)</option>
            <option value="HIGH">HIGH and URGENT (Recommended)</option>
            <option value="NORMAL">NORMAL, HIGH, and URGENT</option>
            <option value="LOW">All incoming emails (including low)</option>
          </select>
          <span className="mute" style={{ display: "block", marginTop: 4 }}>
            Emails below this priority are summarized quietly and included in your Daily Digest.
          </span>
        </div>

        <div style={{ marginBottom: 14, padding: "10px 0", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontWeight: 500 }}>
            <input
              type="checkbox"
              checked={p.digestEnabled}
              onChange={(e) => setP({ ...p, digestEnabled: e.target.checked })}
            />
            <span>Enable Daily Digest</span>
          </label>
          {p.digestEnabled && (
            <div className="row" style={{ marginTop: 8 }}>
              <div style={{ flex: 1 }}>
                <label className="mute" style={{ display: "block", marginBottom: 4 }}>
                  Digest Delivery Time (Local)
                </label>
                <input
                  type="text"
                  placeholder="08:00"
                  value={p.digestTime}
                  onChange={(e) => setP({ ...p, digestTime: e.target.value })}
                  aria-label="Daily digest delivery time"
                />
              </div>
              <div style={{ alignSelf: "flex-end" }}>
                <button type="button" className="small" onClick={handleSendDigest} disabled={digestSending}>
                  {digestSending ? "Sending…" : "Test Digest Now"}
                </button>
              </div>
            </div>
          )}
          {p.lastDigestSentAt && (
            <p className="mute" style={{ marginTop: 6 }}>
              Last digest sent: {new Date(p.lastDigestSentAt).toLocaleString()}
            </p>
          )}
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <input
              type="checkbox"
              checked={p.autoSyncEnabled}
              onChange={(e) => setP({ ...p, autoSyncEnabled: e.target.checked })}
            />
            <span>Automatic Inbox Background Sync</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={p.notificationsEnabled}
              onChange={(e) => setP({ ...p, notificationsEnabled: e.target.checked })}
            />
            <span>All Notifications Enabled</span>
          </label>
        </div>

        <div className="row">
          <button className="primary" disabled={saving}>
            {saving ? "Saving…" : "Save Preferences"}
          </button>
          {msg && <span className="ok" role="status">{msg}</span>}
        </div>
      </form>
    </section>
  );
}

export function UsagePanel({
  stats,
}: {
  stats: {
    period: string;
    summaries: { used: number; limit: number; remaining: number; pct: number };
    notifications: { used: number; limit: number; remaining: number; pct: number };
  };
}) {
  return (
    <section className="card" aria-labelledby="usage-heading">
      <h2 id="usage-heading">
        <span>📊</span> Usage & Limits ({stats.period})
      </h2>
      <div className="meter-wrapper">
        <div className="meter-header">
          <span>AI Summaries</span>
          <b>
            {stats.summaries.used} / {stats.summaries.limit}
          </b>
        </div>
        <div className="meter-bar">
          <div
            className={`meter-fill ${stats.summaries.pct > 80 ? "danger" : stats.summaries.pct > 60 ? "warning" : ""}`}
            style={{ width: `${stats.summaries.pct}%` }}
          />
        </div>
      </div>

      <div className="meter-wrapper">
        <div className="meter-header">
          <span>WhatsApp Notifications</span>
          <b>
            {stats.notifications.used} / {stats.notifications.limit}
          </b>
        </div>
        <div className="meter-bar">
          <div
            className={`meter-fill ${stats.notifications.pct > 80 ? "danger" : stats.notifications.pct > 60 ? "warning" : ""}`}
            style={{ width: `${stats.notifications.pct}%` }}
          />
        </div>
      </div>
      <p className="mute" style={{ marginTop: 10 }}>
        Limits reset on the first of each month. Extensible for subscription billing.
      </p>
    </section>
  );
}

type MailItem = {
  id: string;
  subject: string;
  senderName: string;
  senderEmail: string;
  snippet: string;
  receivedAt: string;
  summarized?: boolean;
};

export function EmailsPanel({
  connected,
}: {
  connected: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState<MailItem[] | null>(null);
  const [demo, setDemo] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  async function load() {
    setErr("");
    const res = await api("/api/emails", "GET");
    if (res.ok) {
      setItems(res.data.items);
      setDemo(res.data.demo);
    } else {
      setErr(res.data.message ?? res.data.error);
    }
  }

  useEffect(() => {
    if (connected) load();
  }, [connected]);

  const filtered = (items ?? []).filter(
    (m) =>
      m.subject.toLowerCase().includes(search.toLowerCase()) ||
      m.senderName?.toLowerCase().includes(search.toLowerCase()) ||
      m.senderEmail.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <section className="card" aria-labelledby="emails-heading">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <h2 id="emails-heading" style={{ margin: 0 }}>
          <span>✉️</span> Recent Inbox Emails
        </h2>
        <div className="row">
          {demo && <span className="badge demo">DEMO DATA</span>}
          <button className="small" onClick={load} disabled={!connected}>
            Refresh
          </button>
        </div>
      </div>

      {!connected ? (
        <p className="mute">Connect Gmail first to load inbox messages.</p>
      ) : (
        <>
          <div style={{ marginBottom: 12 }}>
            <input
              type="text"
              placeholder="Search emails by subject or sender…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search emails"
            />
          </div>
          {err && <p className="bad" role="alert">{err}</p>}
          <ul className="list">
            {filtered.map((m) => (
              <li key={m.id}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1, marginRight: 10 }}>
                    <b>{m.subject}</b>{" "}
                    {m.summarized && <span className="badge ok">Summarized</span>}
                    <div className="mute">
                      {m.senderName || m.senderEmail} · {new Date(m.receivedAt).toLocaleString()}
                    </div>
                    <div className="mute" style={{ marginTop: 2 }}>{m.snippet}</div>
                  </div>
                  <button
                    className="small"
                    disabled={busy === m.id}
                    onClick={async () => {
                      setBusy(m.id);
                      const res = await api("/api/summaries", "POST", { messageId: m.id });
                      setBusy(null);
                      if (res.ok) {
                        await load();
                        router.refresh();
                      } else {
                        setErr(res.data.message ?? res.data.error);
                      }
                    }}
                  >
                    {busy === m.id ? "Analyzing…" : m.summarized ? "Re-summarize" : "Summarize"}
                  </button>
                </div>
              </li>
            ))}
            {items && !filtered.length && <li className="mute">No matching emails found.</li>}
          </ul>
        </>
      )}
    </section>
  );
}

type Sum = {
  id: string;
  subject: string;
  sender: string;
  mainMessage: string;
  requiredAction: string | null;
  deadline: string | null;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  priorityReason: string;
  permalink: string;
  demo: boolean;
  provider: string;
  warnings: string[];
  createdAt: string;
};

export function SummaryListPanel({
  items,
  destinations,
}: {
  items: Sum[];
  destinations: Dest[];
}) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const verifiedDests = destinations.filter((d) => d.status === "VERIFIED");

  async function handleSend(summaryId: string, destId: string) {
    const res = await api("/api/notifications", "POST", {
      destinationId: destId,
      kind: "SUMMARY",
      summaryId,
    });
    if (res.ok) {
      setMsg(res.data.duplicate ? "Already queued or sent for this summary." : "Notification queued for delivery.");
      router.refresh();
    } else {
      setMsg(res.data.message ?? res.data.error);
    }
  }

  async function handleTest(destId: string) {
    const res = await api("/api/notifications", "POST", {
      destinationId: destId,
      kind: "TEST",
    });
    if (res.ok) {
      setMsg("Test message queued.");
      router.refresh();
    } else {
      setMsg(res.data.message ?? res.data.error);
    }
  }

  return (
    <section className="card" aria-labelledby="summaries-heading">
      <h2 id="summaries-heading">
        <span>🤖</span> Generated AI Summaries
      </h2>
      {msg && <p className="mute info" role="status">{msg}</p>}

      <ul className="list">
        {items.map((s) => (
          <li key={s.id}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <b>{s.subject}</b>
              <div>
                <span className={`badge priority-${s.priority}`}>{s.priority}</span>
                {s.demo && <span className="badge demo" style={{ marginLeft: 6 }}>DEMO</span>}
              </div>
            </div>

            <div className="summary-box">
              <div className="summary-field">
                <div className="summary-label">Sender</div>
                <div className="summary-value">{s.sender}</div>
              </div>
              <div className="summary-field">
                <div className="summary-label">Key Takeaway</div>
                <div className="summary-value">{s.mainMessage}</div>
              </div>
              <div className="summary-field">
                <div className="summary-label">Required Action</div>
                <div className="summary-value">
                  {s.requiredAction ? (
                    <>
                      {s.requiredAction}
                      <span className="quote-evidence">quoted in email</span>
                    </>
                  ) : (
                    <span className="mute">None stated in email</span>
                  )}
                </div>
              </div>
              <div className="summary-field">
                <div className="summary-label">Deadline</div>
                <div className="summary-value">
                  {s.deadline ? (
                    <>
                      {s.deadline}
                      <span className="quote-evidence">quoted in email</span>
                    </>
                  ) : (
                    <span className="mute">No deadline identified</span>
                  )}
                </div>
              </div>
              <div className="summary-field" style={{ marginBottom: 0 }}>
                <div className="summary-label">Priority Assessment</div>
                <div className="summary-value mute">{s.priorityReason}</div>
              </div>
            </div>

            {s.warnings.map((w) => (
              <div key={w} className="banner" style={{ margin: "6px 0", padding: "6px 10px", fontSize: 13 }}>
                ⚠ {w}
              </div>
            ))}

            <div className="row" style={{ justifyContent: "space-between", marginTop: 8 }}>
              <div className="mute">
                Model: {s.provider} ·{" "}
                {s.demo ? "synthetic" : <a href={s.permalink} target="_blank" rel="noopener noreferrer">open in Gmail</a>}
              </div>
              <div className="row">
                {verifiedDests.map((d) => (
                  <button key={d.id} className="small primary" onClick={() => handleSend(s.id, d.id)}>
                    Send to {d.phone}
                  </button>
                ))}
                {!verifiedDests.length && <span className="mute">Add/verify WhatsApp to send alert</span>}
              </div>
            </div>
          </li>
        ))}
        {!items.length && <li className="mute">No summaries created yet. Select an email above.</li>}
      </ul>

      {verifiedDests.length > 0 && (
        <div className="row" style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
          <span className="mute">Connectivity Test:</span>
          {verifiedDests.map((d) => (
            <button key={d.id} className="small" onClick={() => handleTest(d.id)}>
              Send Test to {d.phone}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

type Att = {
  id: string;
  kind: string;
  subject: string | null;
  to: string;
  status: string;
  error: string | null;
  code: string | null;
  providerId: string | null;
  demo: boolean;
  at: string;
};

const COLOR: Record<string, string> = {
  DELIVERED: "badge ok",
  READ: "badge ok",
  FAILED: "badge bad",
  UNKNOWN: "badge warn",
  PENDING: "badge",
  SENDING: "badge warn",
  ACCEPTED: "badge",
  SENT: "badge ok",
};

export function HistoryPanel({
  items,
  poll,
}: {
  items: Att[];
  poll: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!poll) return;
    const t = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(t);
  }, [poll, router]);

  async function handleResolve(id: string, outcome: "received" | "not_received") {
    const res = await api(`/api/notifications/${id}/resolve`, "POST", { outcome });
    if (res.ok) router.refresh();
  }

  return (
    <section className="card full" aria-labelledby="history-heading">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <h2 id="history-heading" style={{ margin: 0 }}>
          <span>📜</span> Notification Delivery History {poll && <span className="badge warn">Updating…</span>}
        </h2>
        <span className="mute">Auto-refreshes while jobs are pending</span>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Type</th>
              <th>Content / Subject</th>
              <th>Recipient</th>
              <th>Status</th>
              <th>Delivery Details & Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id}>
                <td>{new Date(a.at).toLocaleString()}</td>
                <td>
                  <span className="badge">{a.kind}</span>
                </td>
                <td>{a.subject ?? (a.kind === "DIGEST" ? "Daily Digest Bundle" : "Connectivity Test")}</td>
                <td>{a.to}</td>
                <td>
                  <span className={COLOR[a.status] ?? "badge"}>{a.status}</span>{" "}
                  {a.demo && <span className="badge demo">DEMO</span>}
                </td>
                <td>
                  {a.error && (
                    <div className="bad" style={{ fontSize: 12 }}>
                      {a.code}: {a.error}
                    </div>
                  )}
                  {a.providerId && (
                    <div className="mute" style={{ fontSize: 11 }}>
                      id: {a.providerId.slice(0, 20)}…
                    </div>
                  )}
                  {a.status === "UNKNOWN" && (
                    <div className="row" style={{ marginTop: 6 }}>
                      <span className="mute" style={{ width: "100%", fontSize: 12 }}>
                        Status unknown. Did you receive this WhatsApp message?
                      </span>
                      <button className="small ok" onClick={() => handleResolve(a.id, "received")}>
                        ✓ Received
                      </button>
                      <button className="small bad" onClick={() => handleResolve(a.id, "not_received")}>
                        ✗ Not Received
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td colSpan={6} className="mute" style={{ textAlign: "center", padding: "24px 0" }}>
                  No notifications recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function AccountSettingsPanel({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const [confirmEmail, setConfirmEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    if (!confirm("Are you sure? This action is permanent and completely erases your account and all data.")) return;
    setLoading(true);
    setErr("");
    const res = await api("/api/account", "DELETE", { confirmEmail });
    setLoading(false);
    if (res.ok) {
      alert("Account deleted.");
      window.location.href = "/login";
    } else {
      setErr(res.data.message ?? res.data.error ?? "Failed to delete account");
    }
  }

  return (
    <section className="card full" aria-labelledby="account-heading">
      <h2 id="account-heading">
        <span>🔒</span> Privacy, Retention & Account Management
      </h2>
      <div className="grid">
        <div>
          <h3>Data Retention Policy</h3>
          <ul className="list mute" style={{ fontSize: 13 }}>
            <li>• <b>Email Bodies:</b> Truncated to 8k chars on ingestion; nulled after 7 days or immediately on Gmail disconnect.</li>
            <li>• <b>Email Records:</b> Purged after 90 days. Summaries retain subject and sender for historical reference.</li>
            <li>• <b>Summaries & Notification Logs:</b> Kept for 180 days then purged automatically.</li>
            <li>• <b>Security:</b> Tokens encrypted with AES-256-GCM and user-bound Additional Authenticated Data (AAD).</li>
          </ul>
        </div>
        <div>
          <h3>Delete Account</h3>
          <p className="mute">
            Permanently revoke Google access tokens, cancel consent records, and delete all user records from PostgreSQL via cascade.
          </p>
          <form onSubmit={handleDelete}>
            <p>
              <input
                type="email"
                placeholder={`Type ${userEmail} to confirm`}
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                required
                aria-label="Confirm email address for deletion"
              />
            </p>
            {err && <p className="bad" role="alert">{err}</p>}
            <button
              className="danger"
              disabled={confirmEmail.toLowerCase().trim() !== userEmail.toLowerCase().trim() || loading}
            >
              {loading ? "Deleting…" : "Permanently Delete Account & Data"}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
