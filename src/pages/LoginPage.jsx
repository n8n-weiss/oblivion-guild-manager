import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import Icon from '../components/ui/icons';
import { useGuild } from '../context/GuildContext';
import { JOB_CLASSES } from '../utils/constants';
import Modal from '../components/ui/Modal';

function LoginPage() {
  const MotionDiv = motion.div;
  const { submitJoinRequest } = useGuild();
  const [tab, setTab] = useState("login"); // login, register

  const [email, setEmail] = useState(() => localStorage.getItem("last_login_uid_v1") || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [showForgotUid, setShowForgotUid] = useState(false);
  const [authNotice, setAuthNotice] = useState("");
  // Registration States
  const [regDiscord, setRegDiscord] = useState("");
  const [regIgn, setRegIgn] = useState("");
  const [regUid, setRegUid] = useState("");
  const [regClass, setRegClass] = useState("");
  const [regRole, setRegRole] = useState("DPS");
  const [submitted, setSubmitted] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const uidHintOk = !email || /@oblivion\.com$/i.test(email.trim());

  useEffect(() => {
    if (tab !== "login") setShowPassword(false);
  }, [tab]);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) { setError("Please fill in all fields."); return; }
    setLoading(true);
    setError("");
    setAuthNotice("Authenticating guild credentials...");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      localStorage.setItem("last_login_uid_v1", email.trim().toLowerCase());
    } catch {
      // Fallback: Check if there's an approved join request that hasn't been "claimed" (created) yet
      try {
        const cleanPass = password.toUpperCase().startsWith("OBL") ? password.toUpperCase() : "OBL" + password;
        const q = query(collection(db, "join_requests"), where("status", "==", "approved"), where("uid", "==", cleanPass));
        const snap = await getDocs(q);

        if (!snap.empty) {
          const r = snap.docs[0].data();
          const cleanDiscord = r.discord.toLowerCase().replace(/[^a-z0-9]/g, '');
          const calculatedEmail = `${cleanDiscord}@oblivion.com`;

          if (email.toLowerCase() === calculatedEmail) {
            // Automatic creation and login
            const cred = await createUserWithEmailAndPassword(auth, email, cleanPass);
            await setDoc(doc(db, "userroles", cred.user.uid), {
              role: "member",
              memberId: cleanPass,
              email: calculatedEmail,
              displayName: r.ign,
              createdAt: new Date()
            });
            localStorage.setItem("last_login_uid_v1", email.trim().toLowerCase());
            return;
          }
        }
      } catch (innerErr) {
        console.error("Auto-setup failed:", innerErr);
      }
      setError("Invalid email or password. If you just applied, please wait for an Officer to approve your request.");
    } finally {
      setLoading(false);
      setAuthNotice("");
    }
  };



  const handleRegister = async () => {
    if (!regDiscord.trim() || !regIgn.trim() || !regUid.trim() || !regClass) {
      setError("Please fill in all fields.");
      return;
    }

    // Validate UID (must be 6 digits after possible OBL)
    let cleanUid = regUid.toUpperCase().replace(/\s/g, '');
    if (cleanUid.startsWith("OBL")) cleanUid = cleanUid.substring(3);

    if (!/^\d{6}$/.test(cleanUid)) {
      setError("UID must be exactly 6 numbers.");
      return;
    }

    const finalUid = `OBL${cleanUid}`;
    setLoading(true);
    setError("");

    try {
      const success = await submitJoinRequest({
        discord: regDiscord.trim(),
        ign: regIgn.trim(),
        uid: finalUid,
        jobClass: regClass,
        role: regRole
      });

      if (success) {
        setSubmitted(true);
      }
    } catch (registerErr) {
      setError(registerErr.message || "Failed to submit registration.");
    } finally {
      setLoading(false);
    }
  };

  const handleUidChange = (val) => {
    let v = val.toUpperCase().replace(/\s/g, '');
    if (v.length > 0 && !v.startsWith("OBL") && !/^[A-Z]/.test(v)) {
      setRegUid("OBL" + v);
    } else {
      setRegUid(v);
    }
  };

  return (
    <div className="login-page-container">
      <div className="login-ambient-glow" />
      <div style={{ width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", alignItems: "center", gap: 28, zIndex: 1, position: "relative" }}>

        {/* Logo */}
        <MotionDiv 
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{ textAlign: "center" }} 
          className="animate-float"
        >
          <div className="logo-halo-container" style={{ marginBottom: 16 }}>
            <div className="logo-halo" />
            <div className="logo-ring" />
            <div className="logo-frame-shimmer">
               <div className="logo-inner-frame">
                 <div className="logo-flare" />
                 <img
                   src={`${import.meta.env.BASE_URL}oblivion-logo.png`}
                   alt="Oblivion Guild"
                   style={{ width: 160, height: 160, objectFit: "cover", display: "block", position: "relative", zIndex: 1, borderRadius: 8 }}
                 />
               </div>
            </div>
          </div>
          <div style={{ fontSize: 11, letterSpacing: 4, color: "var(--text-muted)", textTransform: "uppercase", marginTop: 16, textShadow: "0 2px 4px rgba(158, 158, 158, 0.72)" }}>Guild Portal</div>
        </MotionDiv>

        {/* Card */}
        <MotionDiv 
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="login-card"
        >
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg,transparent,var(--accent),transparent)", opacity: 0.5 }} />

          <div style={{ display: "flex", background: "rgba(0,0,0,0.4)", borderRadius: 12, padding: 6, marginBottom: 32, boxShadow: "inset 0 4px 8px rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.05)", position: "relative", gap: 4 }}>
            <button
              onClick={() => { setTab("login"); setError(""); setSubmitted(false); }}
              style={{ flex: 1, padding: "10px 8px", borderRadius: 8, background: tab === "login" ? "linear-gradient(135deg, rgba(99,130,230,0.9), rgba(60,90,190,0.9))" : "transparent", color: tab === "login" ? "#fff" : "var(--text-muted)", fontSize: 11, fontWeight: tab === "login" ? 800 : 600, letterSpacing: 0.5, transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}
            >
              <Icon name="user" size={12} />
              Sign In
            </button>
            <button
              onClick={() => { setTab("register"); setError(""); setSubmitted(false); }}
              style={{ flex: 1, padding: "10px 8px", borderRadius: 8, background: tab === "register" ? "linear-gradient(135deg, rgba(240,192,64,0.95), rgba(210,150,40,0.95))" : "transparent", color: tab === "register" ? "#111" : "var(--text-muted)", fontSize: 11, fontWeight: tab === "register" ? 800 : 600, letterSpacing: 0.5, transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}
            >
              <Icon name="edit" size={12} />
              Sign Up
            </button>

          </div>

          {tab === "login" ? (
            <div key="tab-login" style={{ animation: "fade-in 0.4s ease-out" }}>
              <div style={{ fontFamily: "Cinzel,serif", fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Welcome</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>Sign in to access your OBLIVION Portal</div>
              {!!error && (
                <div style={{ marginBottom: 14, padding: "10px 12px", background: "rgba(224,80,80,0.15)", border: "1px solid rgba(224,80,80,0.4)", borderRadius: 8, fontSize: 12, color: "var(--red)" }}>
                  ⚠️ {error}
                </div>
              )}

              <div className="form-grid" style={{ gap: 16 }}>
                <div className="form-group">
                  <label className="form-label" style={{ color: "var(--text-secondary)" }}>Portal Email</label>
                  <input className="form-input" type="email" placeholder="yourdiscordusername@oblivion.com"
                    value={email} onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleLogin()}
                    style={{ background: "rgba(8, 10, 15, 0.5)" }} />
                  <div style={{ marginTop: 6, fontSize: 11, color: uidHintOk ? "var(--text-muted)" : "var(--gold)" }}>
                    Example email: `yourdiscordusername@oblivion.com`
                  </div>
                  <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ padding: "2px 8px", fontSize: 11 }}
                      onClick={() => setShowForgotUid(true)}
                    >
                      Forgot UID?
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ padding: "2px 8px", fontSize: 11 }}
                      onClick={() => {
                        localStorage.removeItem("last_login_uid_v1");
                        setEmail("");
                        setAuthNotice("");
                        setError("");
                      }}
                      title="Clear remembered UID/email from this device"
                    >
                      Clear remembered UID
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ color: "var(--text-secondary)" }}>Password</label>
                  <div style={{ position: "relative" }}>
                    <input className="form-input" type={showPassword ? "text" : "password"} placeholder="OBL+UID or OBL123456"
                      value={password} onChange={e => setPassword(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleLogin()}
                      onKeyUp={(e) => setCapsOn(!!e.getModifierState?.("CapsLock"))}
                      onFocus={(e) => setCapsOn(!!e.getModifierState?.("CapsLock"))}
                      style={{ background: "rgba(8, 10, 15, 0.5)", paddingRight: 84 }} />
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setShowPassword(v => !v)}
                      style={{ position: "absolute", right: 6, top: 6, padding: "3px 8px", fontSize: 11 }}
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  {capsOn && (
                    <div style={{ marginTop: 6, fontSize: 11, color: "var(--gold)" }}>
                      Caps Lock is on.
                    </div>
                  )}
                  {!capsOn && (
                    <div style={{ marginTop: 6, fontSize: 11, color: "var(--text-muted)" }}>
                      Example password: `OBL123456`
                    </div>
                  )}
                </div>
              </div>

              <button className="btn btn-primary w-full" style={{ marginTop: 24, justifyContent: "center", padding: "12px", fontSize: 13, letterSpacing: 1 }}
                onClick={handleLogin} disabled={loading}>
                {loading ? "Signing in..." : "Sign In ⚔"}
              </button>
              {loading && authNotice && (
                <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-muted)" }}>
                  {authNotice}
                </div>
              )}
            </div>
          ) : (
            <div key="tab-register" style={{ animation: "fade-in 0.4s ease-out" }}>
              {submitted ? (
                <div style={{ animation: "fade-in 0.5s ease-out", textAlign: "center", padding: "20px 0" }}>
                  <div style={{ width: 64, height: 64, background: "rgba(240,192,64,0.1)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", border: "2px solid var(--gold)" }}>
                    <Icon name="check" size={32} style={{ color: 'var(--gold)' }} />
                  </div>
                  <div style={{ fontFamily: "Cinzel,serif", fontSize: 20, fontWeight: 700, color: "var(--gold)", marginBottom: 12 }}>Registration Sent!</div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 24 }}>
                    Your application has been sent to the Officers. Please wait for approval before logging in.
                  </div>

                  <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: 16, textAlign: "left" }}>
                    <div style={{ fontSize: 11, color: "var(--gold)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>Your Login Credentials</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ fontSize: 13 }}>
                        <span style={{ color: "var(--text-muted)" }}>Username: </span>
                        <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>{regDiscord.toLowerCase().replace(/[^a-z0-9]/g, '')}@oblivion.com</span>
                      </div>
                      <div style={{ fontSize: 13 }}>
                        <span style={{ color: "var(--text-muted)" }}>Password: </span>
                        <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>{regUid.startsWith("OBL") ? regUid : "OBL" + regUid}</span>
                      </div>
                    </div>
                  </div>

                  <button className="btn btn-ghost w-full" style={{ marginTop: 24, color: 'var(--gold)', borderColor: 'var(--gold)' }} onClick={() => setTab("login")}>
                    Return to Sign In
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ textAlign: "center", marginBottom: 28 }}>
                    <div style={{ fontFamily: "Cinzel,serif", fontSize: 20, fontWeight: 700, color: "var(--gold)", marginBottom: 8, textShadow: "0 2px 8px rgba(240,192,64,0.4)" }}>Join OBLIVION</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6, padding: "0 10px" }}>Fill in your details to apply for guild membership and unlock your portal.</div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 28 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div className="form-group" style={{ position: "relative", margin: 0 }}>
                        <label className="form-label" style={{ color: "var(--gold)", fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>Discord Username</label>
                        <input className="form-input" placeholder="e.g. reaper" value={regDiscord} onChange={e => setRegDiscord(e.target.value)} style={{ background: "rgba(240, 192, 64, 0.05)", borderColor: "rgba(240,192,64,0.3)", padding: "12px 14px", fontSize: 14 }} />
                      </div>
                      <div className="form-group" style={{ position: "relative", margin: 0 }}>
                        <label className="form-label" style={{ color: "var(--gold)", fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>In-Game Name</label>
                        <input className="form-input" placeholder="e.g. DarkReaper" value={regIgn} onChange={e => setRegIgn(e.target.value)} style={{ background: "rgba(240, 192, 64, 0.05)", borderColor: "rgba(240,192,64,0.3)", padding: "12px 14px", fontSize: 14 }} />
                      </div>
                    </div>

                    <div className="form-group" style={{ position: "relative", margin: 0 }}>
                      <label className="form-label" style={{ color: "var(--gold)", fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>UID (6 numbers)</label>
                      <input className="form-input" placeholder="e.g. OBL+UID or OBL123456" value={regUid} onChange={e => handleUidChange(e.target.value)} style={{ background: "rgba(240, 192, 64, 0.05)", borderColor: "rgba(240,192,64,0.3)", padding: "12px 14px", fontSize: 14, letterSpacing: 2 }} />
                      <div style={{ position: "absolute", right: 14, top: 32, filter: "opacity(0.4) drop-shadow(0 0 4px var(--gold))" }}><Icon name="shield" size={14} /></div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div className="form-group" style={{ position: "relative", margin: 0 }}>
                        <label className="form-label" style={{ color: "var(--gold)", fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>Job Class</label>
                        <select className="form-input" value={regClass} onChange={e => setRegClass(e.target.value)} style={{ background: "rgba(0, 0, 0, 0.6)", color: "#fff", borderColor: "rgba(240,192,64,0.3)", padding: "12px 14px", fontSize: 13 }}>
                          <option value="" style={{ background: "#222" }}>Select Class</option>
                          {JOB_CLASSES.map(b => b.jobs.map(j => (
                            <option key={j.name} value={j.name} style={{ background: "#222" }}>{j.emoji} {j.name}</option>
                          )))}
                        </select>
                      </div>
                      <div className="form-group" style={{ position: "relative", margin: 0 }}>
                        <label className="form-label" style={{ color: "var(--gold)", fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>Role</label>
                        <select className="form-input" value={regRole} onChange={e => setRegRole(e.target.value)} style={{ background: "rgba(0, 0, 0, 0.6)", color: "#fff", borderColor: "rgba(240,192,64,0.3)", padding: "12px 14px", fontSize: 13 }}>
                          <option value="DPS" style={{ background: "#222" }}>DPS</option>
                          <option value="Support / Utility" style={{ background: "#222" }}>Support / Utility</option>
                        </select>
                      </div>
                    </div>

                  </div>

                  <button className="btn w-full" style={{ position: "relative", overflow: "hidden", marginTop: 8, justifyContent: "center", padding: "12px", fontSize: 13, fontWeight: 700, letterSpacing: 1, background: "linear-gradient(135deg, rgba(240,192,64,0.15), rgba(240,192,64,0.05))", color: "var(--gold)", border: "1px solid rgba(240,192,64,0.5)", boxShadow: "0 4px 12px rgba(240,192,64,0.15)" }}
                    onClick={handleRegister} disabled={loading}>
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, transparent, rgba(240,192,64,0.3), transparent)", transform: "translateX(-100%)", animation: "shimmer 2.5s infinite" }} />
                    <span style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 8 }}>
                      {loading ? <span style={{ animation: "pulse 1s infinite" }}>Submitting...</span> : <><Icon name="edit" size={14} /> Apply to Join </>}
                    </span>
                  </button>
                </>
              )}
            </div>
          )}

          {error && tab !== "login" && (
            <div style={{ marginTop: 16, padding: "10px 14px", background: "rgba(224,80,80,0.15)", border: "1px solid rgba(224,80,80,0.4)", borderRadius: 8, fontSize: 12, color: "var(--red)" }}>
              ⚠️ {error}
            </div>
          )}
        </MotionDiv>

        <MotionDiv 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
          style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", letterSpacing: 1, zIndex: 1, backgroundColor: "rgba(8,10,15,0.5)", padding: "4px 12px", borderRadius: 12, backdropFilter: "blur(4px)", border: "1px solid var(--border)" }}
        >
          Need help? DM Masters and Officers in Discord.
        </MotionDiv>
      </div>
      {showForgotUid && (
        <Modal
          title="Recover Your Login UID"
          onClose={() => setShowForgotUid(false)}
          footer={<button className="btn btn-primary" onClick={() => setShowForgotUid(false)}>Got it</button>}
        >
          <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>
            Use these steps to recover your login UID/email:
            <ol style={{ margin: "10px 0 0 18px", padding: 0 }}>
              <li>Check your Discord username used in your join request.</li>
              <li>Remove symbols/spaces and lowercase it.</li>
              <li>Add <strong>@oblivion.com</strong> at the end.</li>
              <li>Use your password format: <strong>OBL + UID</strong> (example: <strong>OBL123456</strong>).</li>
            </ol>
            <div style={{ marginTop: 10, fontSize: 12 }}>
              If still blocked, contact Masters/Officers for account verification.
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default LoginPage;
