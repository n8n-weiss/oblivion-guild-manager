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
      <div className="login-page-container">
        <div className="login-ambient-glow" />
        <div style={{ width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", alignItems: "center", gap: 28, zIndex: 1, position: "relative" }}>

          {/* Logo */}
          <div style={{ textAlign: "center" }} className="animate-float">
            <div style={{ position: "relative", display: "inline-block" }}>
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 160, height: 160, background: "radial-gradient(circle, var(--accent-light) 0%, transparent 70%)", borderRadius: "50%", zIndex: 0, filter: "blur(20px)" }} />
              <img
                src={window.location.hostname === "localhost" ? "/oblivion-logo.png" : "/oblivion-guild-manager/oblivion-logo.png"}
                alt="Oblivion Guild"
                style={{ width: 180, height: 180, objectFit: "cover", borderRadius: 16, border: "1px solid rgba(99,130,230,0.4)", marginBottom: 16, display: "block", margin: "0 auto", position: "relative", zIndex: 1, boxShadow: "0 12px 32px rgba(0,0,0,0.5)" }}
              />
            </div>
            <div style={{ fontSize: 11, letterSpacing: 4, color: "var(--text-muted)", textTransform: "uppercase", marginTop: 16, textShadow: "0 2px 4px rgba(0,0,0,0.8)" }}>Guild Manager</div>
          </div>

          {/* Card */}
          <div className="login-card">
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg,transparent,var(--accent),transparent)", opacity: 0.5 }} />

            <div style={{ fontFamily: "Cinzel,serif", fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4, textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>Welcome Back</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>Sign in to access the guild system</div>

            <div className="form-grid" style={{ gap: 16 }}>
              <div className="form-group">
                <label className="form-label" style={{ color: "var(--text-secondary)" }}>Email</label>
                <input className="form-input" type="email" placeholder="your@email.com"
                  value={email} onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleLogin()} 
                  style={{ background: "rgba(8, 10, 15, 0.5)", borderColor: "var(--border)", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.2)" }} />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ color: "var(--text-secondary)" }}>Password</label>
                <input className="form-input" type="password" placeholder="your password"
                  value={password} onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleLogin()} 
                  style={{ background: "rgba(8, 10, 15, 0.5)", borderColor: "var(--border)", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.2)" }} />
              </div>
            </div>

            {error && (
              <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(224,80,80,0.15)", border: "1px solid rgba(224,80,80,0.4)", borderRadius: 8, fontSize: 12, color: "var(--red)", backdropFilter: "blur(4px)" }}>
                ⚠️ {error}
              </div>
            )}

            <button className="btn btn-primary w-full" style={{ marginTop: 24, width: "100%", justifyContent: "center", padding: "12px", fontSize: 14, letterSpacing: 1, position: "relative", overflow: "hidden" }}
              onClick={handleLogin} disabled={loading}>
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)", transform: "translateX(-100%)", animation: "shimmer 2s infinite" }} />
              <span style={{ position: "relative", zIndex: 1 }}>{loading ? "Signing in..." : "Sign In ⚔"}</span>
            </button>
          </div>

          <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", letterSpacing: 1, zIndex: 1, backgroundColor: "rgba(8,10,15,0.5)", padding: "4px 12px", borderRadius: 12, backdropFilter: "blur(4px)", border: "1px solid var(--border)" }}>
            No account? Contact your Guild Master.
          </div>
        </div>
      </div>
    </>
  );
}

export default LoginPage;
