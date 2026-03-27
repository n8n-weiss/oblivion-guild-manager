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
        throw new Error("No Discord ID attached to this profile. Admin needs to add your Discord Username first.");
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
                src={`${import.meta.env.BASE_URL}oblivion-logo.png`}
                alt="Oblivion Guild"
                style={{ width: 180, height: 180, objectFit: "cover", borderRadius: 16, border: "1px solid rgba(99,130,230,0.4)", marginBottom: 16, display: "block", margin: "0 auto", position: "relative", zIndex: 1, boxShadow: "0 12px 32px rgba(0,0,0,0.5)" }}
              />
            </div>
            <div style={{ fontSize: 11, letterSpacing: 4, color: "var(--text-muted)", textTransform: "uppercase", marginTop: 16, textShadow: "0 2px 4px rgba(158, 158, 158, 0.72)" }}>Guild Portal</div>
          </div>

          {/* Card */}
          <div className="login-card">
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg,transparent,var(--accent),transparent)", opacity: 0.5 }} />

            <div style={{ display: "flex", background: "rgba(0,0,0,0.4)", borderRadius: 12, padding: 6, marginBottom: 32, boxShadow: "inset 0 4px 8px rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.05)", position: "relative" }}>
              <button
                onClick={() => { setTab("login"); setError(""); }}
                style={{ flex: 1, padding: "10px 16px", borderRadius: 8, background: tab === "login" ? "linear-gradient(135deg, rgba(99,130,230,0.9), rgba(60,90,190,0.9))" : "transparent", color: tab === "login" ? "#fff" : "var(--text-muted)", fontSize: 13, fontWeight: tab === "login" ? 800 : 600, letterSpacing: 0.5, transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)", textShadow: tab === "login" ? "0 2px 4px rgba(0,0,0,0.4)" : "none", boxShadow: tab === "login" ? "0 4px 12px rgba(99,130,230,0.5), inset 0 2px 4px rgba(255,255,255,0.3)" : "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                <Icon name="user" size={14} />
                Sign In
              </button>
              <button
                onClick={() => { setTab("claim"); setError(""); }}
                style={{ flex: 1, padding: "10px 16px", borderRadius: 8, background: tab === "claim" ? "linear-gradient(135deg, rgba(240,192,64,0.95), rgba(210,150,40,0.95))" : "transparent", color: tab === "claim" ? "#111" : "var(--text-muted)", fontSize: 13, fontWeight: tab === "claim" ? 800 : 600, letterSpacing: 0.5, transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)", textShadow: tab === "claim" ? "0 1px 2px rgba(255,255,255,0.5)" : "none", boxShadow: tab === "claim" ? "0 4px 12px rgba(240,192,64,0.5), inset 0 2px 4px rgba(255,255,255,0.7)" : "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                <Icon name="star" size={14} />
                New Setup
              </button>
            </div>

            {tab === "login" ? (
              <>
                <div style={{ fontFamily: "Cinzel,serif", fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Welcome</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>Sign in to access your OBLIVION Portal</div>

                <div className="form-grid" style={{ gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ color: "var(--text-secondary)" }}>Email / Username</label>
                    <input className="form-input" type="email" placeholder="email: yourdiscordusername@oblivion.com"
                      value={email} onChange={e => setEmail(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleLogin()}
                      style={{ background: "rgba(8, 10, 15, 0.5)" }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ color: "var(--text-secondary)" }}>Password</label>
                    <input className="form-input" type="password" placeholder="password: OBL+UID or OBL123456"
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
                <div style={{ textAlign: "center", marginBottom: 24 }}>
                  <div style={{ fontFamily: "Cinzel,serif", fontSize: 20, fontWeight: 700, color: "var(--gold)", marginBottom: 8, textShadow: "0 2px 8px rgba(240,192,64,0.4)" }}>OBLIVION Portal</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6, padding: "0 10px" }}>Use your Discord Username and Character UID (OBL123456) to verify your identity and automatically unlock your private access to the OBLIVION Guild Portal.</div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 28 }}>
                  <div className="form-group" style={{ position: "relative", margin: 0 }}>
                    <label className="form-label" style={{ color: "var(--gold)", fontSize: 11, letterSpacing: 1, textTransform: "uppercase" }}>Discord Username</label>
                    <input className="form-input" placeholder="e.g. reapergaming"
                      value={discordUsername} onChange={e => setDiscordUsername(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleClaim()}
                      style={{ background: "rgba(240, 192, 64, 0.05)", borderColor: "rgba(240,192,64,0.3)", padding: "12px 14px", fontSize: 14, color: "#fff", transition: "all 0.3s" }}
                      autoComplete="off" spellCheck="false" />
                    <div style={{ position: "absolute", right: 14, top: 34, filter: "opacity(0.4) drop-shadow(0 0 4px var(--gold))" }}><Icon name="user" size={14} /></div>
                  </div>

                  <div className="form-group" style={{ position: "relative", margin: 0 }}>
                    <label className="form-label" style={{ color: "var(--gold)", fontSize: 11, letterSpacing: 1, textTransform: "uppercase" }}>In-Game UID</label>
                    <input className="form-input" type="text" placeholder="e.g. OBL+UID or OBL123456"
                      value={uidInput} onChange={e => setUidInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleClaim()}
                      style={{ background: "rgba(240, 192, 64, 0.05)", borderColor: "rgba(240,192,64,0.3)", padding: "12px 14px", fontSize: 14, color: "#fff", letterSpacing: 2, transition: "all 0.3s" }}
                      autoComplete="off" spellCheck="false" />
                    <div style={{ position: "absolute", right: 14, top: 34, filter: "opacity(0.4) drop-shadow(0 0 4px var(--gold))" }}><Icon name="shield" size={14} /></div>
                  </div>
                </div>

                <button className="btn w-full" style={{ position: "relative", overflow: "hidden", marginTop: 8, justifyContent: "center", padding: "12px", fontSize: 13, fontWeight: 700, letterSpacing: 1, background: "linear-gradient(135deg, rgba(240,192,64,0.15), rgba(240,192,64,0.05))", color: "var(--gold)", border: "1px solid rgba(240,192,64,0.5)", boxShadow: "0 4px 12px rgba(240,192,64,0.15)" }}
                  onClick={handleClaim} disabled={loading}>
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, transparent, rgba(240,192,64,0.3), transparent)", transform: "translateX(-100%)", animation: "shimmer 2.5s infinite" }} />
                  <span style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 8 }}>
                    {loading ? <span style={{ animation: "pulse 1s infinite" }}>Verifying Identity...</span> : <><Icon name="star" size={14} /> Verify & Access Portal</>}
                  </span>
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
            Need help? DM Masters and Officers in Discord.
          </div>
        </div>
      </div>
    </>
  );
}

export default LoginPage;
