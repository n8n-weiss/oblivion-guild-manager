import React, { useEffect, useState } from "react";

export default function ConfirmTwiceButton({
  onConfirm,
  icon,
  initialLabel = "Delete",
  confirmLabel = "Confirm",
  className = "btn btn-danger btn-sm",
  title = "",
  timeoutMs = 1800,
  iconOnly = false,
  onClick,
  style,
  onMouseEnter,
  onMouseLeave
}) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), timeoutMs);
    return () => window.clearTimeout(t);
  }, [armed, timeoutMs]);

  return (
    <button
      className={className}
      title={title}
      style={armed ? { ...(style || {}), filter: "brightness(1.1)" } : style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={(e) => {
        onClick?.(e);
        if (!armed) {
          setArmed(true);
          return;
        }
        setArmed(false);
        onConfirm?.(e);
      }}
    >
      {icon}
      {!iconOnly && (armed ? ` ${confirmLabel}` : ` ${initialLabel}`)}
    </button>
  );
}
