import React from "react";

export default function StatePanel({
  icon = "ℹ️",
  title = "Nothing here yet",
  description = "",
  actionLabel = "",
  onAction,
  tone = "default"
}) {
  const toneStyles = {
    default: {
      border: "1px solid rgba(255,255,255,0.12)",
      background: "rgba(255,255,255,0.02)"
    },
    warning: {
      border: "1px solid rgba(240,192,64,0.35)",
      background: "rgba(240,192,64,0.08)"
    },
    danger: {
      border: "1px solid rgba(224,80,80,0.35)",
      background: "rgba(224,80,80,0.08)"
    }
  };

  return (
    <div
      style={{
        borderRadius: 12,
        padding: "18px 16px",
        textAlign: "center",
        ...toneStyles[tone]
      }}
    >
      <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontWeight: 800, fontSize: 13, color: "var(--text-primary)" }}>{title}</div>
      {description ? (
        <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-muted)" }}>{description}</div>
      ) : null}
      {actionLabel && onAction ? (
        <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
