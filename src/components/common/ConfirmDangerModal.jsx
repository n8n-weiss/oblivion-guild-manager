import React, { useMemo, useState } from "react";
import Modal from "../ui/Modal";

export default function ConfirmDangerModal({
  open,
  title = "Confirm Action",
  message,
  token = "DELETE",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onCancel,
  onConfirm
}) {
  const [value, setValue] = useState("");
  const isMatch = useMemo(() => value.trim().toUpperCase() === token, [value, token]);

  React.useEffect(() => {
    if (!open) setValue("");
  }, [open]);

  if (!open) return null;

  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={(
        <>
          <button className="btn btn-ghost" onClick={onCancel}>{cancelLabel}</button>
          <button className="btn btn-danger" disabled={!isMatch} onClick={() => onConfirm?.()}>
            {confirmLabel}
          </button>
        </>
      )}
    >
      <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>
        <div style={{ marginBottom: 10 }}>{message}</div>
        <div style={{ marginBottom: 6, fontSize: 12 }}>
          Type <strong>{token}</strong> to continue.
        </div>
        <input
          className="form-input"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={`Type ${token}`}
        />
      </div>
    </Modal>
  );
}
