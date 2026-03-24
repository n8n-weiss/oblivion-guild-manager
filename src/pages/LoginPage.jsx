import React, { useState } from 'react';
import { auth } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import Icon from '../components/ui/icons';

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) { setError("Please fill in all fields."); return; }
    setLoading(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError("Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--bg-deepest)", padding: 20 }}>
        <div style={{ width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", alignItems: "center", gap: 28 }}>

          {/* Logo */}
          <div style={{ textAlign: "center" }}>
            <img
              src={window.location.hostname === "localhost" ? "/oblivion-logo.png" : "/oblivion-guild-manager/oblivion-logo.png"}
              alt="Oblivion Guild"
              style={{ width: 180, height: 180, objectFit: "cover", borderRadius: 16, border: "1px solid rgba(99,130,230,0.25)", marginBottom: 12, display: "block", margin: "0 auto 12px" }}
            />
            <div style={{ fontSize: 11, letterSpacing: 4, color: "var(--text-muted)", textTransform: "uppercase" }}>Guild Manager</div>
          </div>

          {/* Card */}
          <div style={{ width: "100%", background: "var(--bg-card)", border: "1px solid var(--border-bright)", borderRadius: 16, padding: 32, position: "relative", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg,transparent,var(--accent-glow),transparent)" }} />

            <div style={{ fontFamily: "Cinzel,serif", fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Welcome Back</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>Sign in to access the guild system</div>

            <div className="form-grid" style={{ gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" placeholder="your@email.com"
                  value={email} onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleLogin()} />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input className="form-input" type="password" placeholder="your password"
                  value={password} onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleLogin()} />
              </div>
            </div>

            {error && (
              <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(224,80,80,0.1)", border: "1px solid rgba(224,80,80,0.3)", borderRadius: 8, fontSize: 12, color: "var(--red)" }}>
                ⚠️ {error}
              </div>
            )}

            <button className="btn btn-primary w-full" style={{ marginTop: 20, width: "100%", justifyContent: "center", padding: "12px", fontSize: 14, letterSpacing: 1 }}
              onClick={handleLogin} disabled={loading}>
              {loading ? "Signing in..." : "Sign In ⚔"}
            </button>
          </div>

          <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", letterSpacing: 1 }}>
            No account? Contact your Guild Master.
          </div>
        </div>
      </div>
    </>
  );
}

export default LoginPage;
