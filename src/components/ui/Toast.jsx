import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
const MotionDiv = motion.div;

const TOAST_CONFIG = {
  success: { icon: "✅", label: "Success",  borderColor: "#40c97a", glowColor: "rgba(64,201,122,0.25)", bg: "rgba(64,201,122,0.08)" },
  error:   { icon: "❌", label: "Error",    borderColor: "#e05050", glowColor: "rgba(224,80,80,0.25)",  bg: "rgba(224,80,80,0.08)"  },
  info:    { icon: "ℹ️", label: "Info",     borderColor: "#6382e6", glowColor: "rgba(99,130,230,0.25)", bg: "rgba(99,130,230,0.08)" },
  warning: { icon: "⚠️", label: "Warning",  borderColor: "#f0c040", glowColor: "rgba(240,192,64,0.25)", bg: "rgba(240,192,64,0.08)" },
};

const DURATION = 2800;

function Toast({ message, type = "success", onDone, action }) {
  const [progress, setProgress] = useState(100);
  const [isHovered, setIsHovered] = useState(false);
  const config = TOAST_CONFIG[type] || TOAST_CONFIG.success;

  useEffect(() => {
    if (isHovered) return;
    const interval = setInterval(() => {
      setProgress((p) => Math.max(0, p - (100 / (DURATION / 50))));
    }, 50);
    const timeout = setTimeout(onDone, DURATION);
    return () => { clearTimeout(timeout); clearInterval(interval); };
  }, [onDone, isHovered]);

  return (
    <AnimatePresence>
      <MotionDiv
        key="toast"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        initial={{ x: 120, opacity: 0, scale: 0.9 }}
        animate={{ x: 0, opacity: 1, scale: 1 }}
        exit={{ x: 120, opacity: 0, scale: 0.9 }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
        style={{
          position: "fixed",
          bottom: 28,
          right: 28,
          zIndex: 10000,
          minWidth: 280,
          maxWidth: 380,
          background: `rgba(10, 14, 24, 0.92)`,
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: `1px solid ${config.borderColor}40`,
          borderLeft: `4px solid ${config.borderColor}`,
          borderRadius: 14,
          boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 20px ${config.glowColor}`,
          overflow: "hidden",
        }}
      >
        {/* Main content */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px" }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: config.bg,
            border: `1px solid ${config.borderColor}30`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18,
          }}>
            {config.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", color: config.borderColor, marginBottom: 2 }}>
              {config.label}
            </div>
            <div style={{ fontSize: 13, color: "#e8eaf6", lineHeight: 1.5, fontWeight: 500 }}>
              {message}
            </div>
            {action && (
              <button
                onClick={() => { action.onClick(); onDone(); }}
                style={{
                  marginTop: 6,
                  padding: "4px 10px",
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 900,
                  background: config.borderColor,
                  color: "white",
                  border: "none",
                  cursor: "pointer",
                  boxShadow: `0 0 10px ${config.glowColor}`
                }}
              >
                {action.label.toUpperCase()}
              </button>
            )}
          </div>
          <button
            onClick={onDone}
            style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.25)", fontSize: 16, padding: 4, flexShrink: 0 }}
            onMouseEnter={e => e.currentTarget.style.color = "rgba(255,255,255,0.7)"}
            onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.25)"}
          >
            ×
          </button>
        </div>

        {/* Progress bar */}
        <div style={{ height: 3, background: "rgba(255,255,255,0.05)", position: "relative" }}>
          <MotionDiv
            style={{
              height: "100%",
              background: `linear-gradient(90deg, ${config.borderColor}, ${config.borderColor}80)`,
              boxShadow: `0 0 8px ${config.glowColor}`,
              width: `${progress}%`,
              transition: "width 0.05s linear",
            }}
          />
        </div>
      </MotionDiv>
    </AnimatePresence>
  );
}

export default Toast;
