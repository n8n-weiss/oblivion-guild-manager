import React, { useState } from 'react';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import Icon from '../components/ui/icons';

function LoginPage() {
  const [tab, setTab] = useState("login"); // login, claim
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [discordUsername, setDiscordUsername] = useState("");
  const [uidInput, setUidInput] = useState("");
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

  const handleClaim = async () => {
    if (!discordUsername.trim() || !uidInput.trim()) { setError("Please fill in both fields."); return; }
    setLoading(true); setError("");

    try {
      // Find member in roster
      const q = query(collection(db, "roster"), where("memberId", "==", uidInput));
      const snap = await getDocs(q);

      if (snap.empty) {
        throw new Error("UID not found in the official roster. Are you sure you are registered?");
      }

      const memberProf = snap.docs[0].data();
      
      if (!memberProf.discord) {
        throw new Error("No Discord ID attached to this profile. Admin needs to add your Discord ID first.");
      }

      if (memberProf.discord.toLowerCase() !== discordUsername.toLowerCase()) {
        throw new Error("Discord username does not match the Admin records for this UID.");
      }

      // Exact match! We can create their login credentials automatically
      const cleanDiscord = discordUsername.toLowerCase().replace(/[^a-z0-9]/g, '');
      const claimEmail = `${cleanDiscord}@oblivion.com`;
      
      const cred = await createUserWithEmailAndPassword(auth, claimEmail, uidInput);
      await setDoc(doc(db, "userroles", cred.user.uid), {
         role: "member",
         memberId: uidInput,
         email: claimEmail,
         displayName: discordUsername,
         createdAt: new Date()
      });
      // Done! App.jsx will automatically see currentUser and redirect them.
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        setError("This account has already been claimed! Go back to Login.");
      } else {
        setError(err.message || "Failed to find matching records.");
      }
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

            <div className="flex gap-4 mb-6" style={{ borderBottom: "1px solid var(--border)" }}>
              <button 
                onClick={() => { setTab("login"); setError(""); }}
                style={{ flex: 1, paddingBottom: 12, borderBottom: `2px solid ${tab === "login" ? "var(--accent)" : "transparent"}`, color: tab === "login" ? "var(--text-primary)" : "var(--text-muted)", fontSize: 13, fontWeight: tab === "login" ? 700 : 500, transition: "all 0.2s" }}
              >
                Sign In
              </button>
              <button 
                onClick={() => { setTab("claim"); setError(""); }}
                style={{ flex: 1, paddingBottom: 12, borderBottom: `2px solid ${tab === "claim" ? "var(--gold)" : "transparent"}`, color: tab === "claim" ? "var(--text-primary)" : "var(--text-muted)", fontSize: 13, fontWeight: tab === "claim" ? 700 : 500, transition: "all 0.2s" }}
              >
                First Time Setup
              </button>
            </div>

            {tab === "login" ? (
              <>
                <div style={{ fontFamily: "Cinzel,serif", fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Welcome Back</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>Sign in to access the guild manager</div>

                <div className="form-grid" style={{ gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ color: "var(--text-secondary)" }}>Email / Username</label>
                    <input className="form-input" type="email" placeholder="email / @oblivion.com"
                      value={email} onChange={e => setEmail(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleLogin()} 
                      style={{ background: "rgba(8, 10, 15, 0.5)" }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ color: "var(--text-secondary)" }}>Password</label>
                    <input className="form-input" type="password" placeholder="your password / UID"
                      value={password} onChange={e => setPassword(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleLogin()} 
                      style={{ background: "rgba(8, 10, 15, 0.5)" }} />
                  </div>
                </div>

                <button className="btn btn-primary w-full" style={{ marginTop: 24, justifyContent: "center", padding: "12px", fontSize: 13, letterSpacing: 1 }}
                  onClick={handleLogin} disabled={loading}>
                  {loading ? "Signing in..." : "Sign In ⚔"}
                </button>
              </>
            ) : (
              <>
                <div style={{ fontFamily: "Cinzel,serif", fontSize: 16, fontWeight: 700, color: "var(--gold)", marginBottom: 4 }}>Claim Your Profile</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.6 }}>Verify your Discord ID and character UID to construct your private Web App account automatically.</div>

                <div className="form-grid" style={{ gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ color: "var(--text-secondary)" }}>Discord Username</label>
                    <input className="form-input" placeholder="e.g. reaper#1234"
                      value={discordUsername} onChange={e => setDiscordUsername(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleClaim()} 
                      style={{ background: "rgba(8, 10, 15, 0.5)", borderColor: "rgba(240,192,64,0.3)" }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ color: "var(--text-secondary)" }}>In-Game Character UID</label>
                    <input className="form-input" type="text" placeholder="e.g. OBL001"
                      value={uidInput} onChange={e => setUidInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleClaim()} 
                      style={{ background: "rgba(8, 10, 15, 0.5)", borderColor: "rgba(240,192,64,0.3)" }} />
                  </div>
                </div>

                <button className="btn w-full" style={{ marginTop: 24, justifyContent: "center", padding: "12px", fontSize: 13, background: "rgba(240,192,64,0.1)", color: "var(--gold)", border: "1px solid var(--gold)" }}
                  onClick={handleClaim} disabled={loading}>
                  {loading ? "Verifying..." : "Verify & Setup Account"}
                </button>
              </>
            )}

            {error && (
              <div style={{ marginTop: 16, padding: "10px 14px", background: "rgba(224,80,80,0.15)", border: "1px solid rgba(224,80,80,0.4)", borderRadius: 8, fontSize: 12, color: "var(--red)" }}>
                ⚠️ {error}
              </div>
            )}
          </div>

          <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", letterSpacing: 1, zIndex: 1, backgroundColor: "rgba(8,10,15,0.5)", padding: "4px 12px", borderRadius: 12, backdropFilter: "blur(4px)", border: "1px solid var(--border)" }}>
            Need help? Open a ticket in Discord.
          </div>
        </div>
      </div>
    </>
  );
}

export default LoginPage;
