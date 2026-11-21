"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function Login() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    const r = mode === "in" ? await authClient.signIn.email({ email: f.email, password: f.password }) : await authClient.signUp.email({ email: f.email, password: f.password, name: f.name || f.email });
    setBusy(false);
    if (r.error) setErr(r.error.message ?? "Authentication failed"); else window.location.href = "/dashboard";
  }
  return (
    <main style={{ maxWidth: 420 }}>
      <h1>Mail Bridge AI</h1><p className="mute">Gmail summaries to WhatsApp. Prototype.</p>
      <form className="card" onSubmit={submit}>
        <h2>{mode === "in" ? "Sign in" : "Create account"}</h2>
        {mode === "up" && <p><input type="text" placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></p>}
        <p><input type="email" placeholder="Email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></p>
        <p><input type="password" placeholder="Password (12+ characters)" required minLength={12} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></p>
        {err && <p className="bad" role="alert">{err}</p>}
        <div className="row"><button className="primary" disabled={busy}>{mode === "in" ? "Sign in" : "Sign up"}</button>
          <button type="button" onClick={() => setMode(mode === "in" ? "up" : "in")}>{mode === "in" ? "Need an account?" : "Have an account?"}</button></div>
        <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "14px 0" }} />
        <button type="button" onClick={() => authClient.signIn.social({ provider: "google", callbackURL: "/dashboard" })}>Continue with Google (only if configured)</button>
      </form>
    </main>
  );
}
