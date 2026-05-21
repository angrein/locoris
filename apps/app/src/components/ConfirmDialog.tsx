import { useEffect, useId, useRef } from "react";

import "./ConfirmDialog.css";

type ConfirmDialogTone = "default" | "danger";

interface ConfirmDialogProps {
  open: boolean;
  kicker: string;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  tone?: ConfirmDialogTone;
  details?: string[];
  secondaryLabel?: string;
  secondaryTone?: ConfirmDialogTone;
  onSecondary?: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialogActionIcon({ tone }: { tone: ConfirmDialogTone }) {
  if (tone === "danger") {
    return (
      <svg viewBox="0 0 24 24" focusable="false">
        <path d="M7.8 8.4v8" />
        <path d="M12 8.4v8" />
        <path d="M16.2 8.4v8" />
        <path d="M5.2 6.4h13.6" />
        <path d="M9.1 6.4v-1c0-.7.6-1.3 1.3-1.3h3.2c.7 0 1.3.6 1.3 1.3v1" />
        <path d="m6.8 6.4.7 11c.1 1 .9 1.8 1.9 1.8h5.2c1 0 1.8-.8 1.9-1.8l.7-11" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" focusable="false">
      <path d="M5.4 12.6 9.7 17 18.8 7" />
    </svg>
  );
}

function ConfirmDialogGlyphIcon({ tone }: { tone: ConfirmDialogTone }) {
  if (tone === "danger") {
    return (
      <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
        <path d="M12 5.2 4.8 17.6h14.4L12 5.2Z" />
        <path d="M12 9.6v3.7" />
        <path d="M12 16.2h.1" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <path d="M6.2 12.6 10.1 16.5 18 8" />
      <path d="M12 3.9a8.1 8.1 0 1 1 0 16.2 8.1 8.1 0 0 1 0-16.2Z" />
    </svg>
  );
}

export default function ConfirmDialog({
  open,
  kicker,
  title,
  message,
  confirmLabel,
  cancelLabel,
  tone = "danger",
  details = [],
  secondaryLabel,
  secondaryTone = "default",
  onSecondary,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  const titleId = useId();
  const messageId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previouslyFocusedElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusTimer = window.setTimeout(() => {
      cancelButtonRef.current?.focus({ preventScroll: true });
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          [
            "button:not(:disabled)",
            "[href]",
            "input:not(:disabled)",
            "select:not(:disabled)",
            "textarea:not(:disabled)",
            "[tabindex]:not([tabindex='-1'])"
          ].join(",")
        ) ?? []
      ).filter((element) => !element.hasAttribute("aria-hidden"));

      if (focusableElements.length === 0) {
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocusedElement?.isConnected) {
        previouslyFocusedElement.focus({ preventScroll: true });
      }
    };
  }, [onCancel, open]);

  if (!open) {
    return null;
  }

  const dialogToneClass = tone === "danger" ? "is-danger" : "is-default";
  const secondaryToneClass = secondaryTone === "danger" ? "is-secondary-danger" : "is-secondary";

  return (
    <div
      className={`confirm-dialog-layer ${dialogToneClass}`}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={messageId}
    >
      <button
        type="button"
        className="confirm-dialog-dim"
        aria-label={cancelLabel}
        onClick={onCancel}
      />
      <div ref={dialogRef} className="confirm-dialog-window">
        <span className="confirm-dialog-sheen" aria-hidden="true" />
        <div className="confirm-dialog-head">
          <span className="confirm-dialog-glyph" aria-hidden="true">
            <span className="confirm-dialog-glyph-ring" />
            <span className="confirm-dialog-glyph-ring is-inner" />
            <ConfirmDialogGlyphIcon tone={tone} />
          </span>
          <div className="confirm-dialog-copy">
            <p className="confirm-dialog-kicker">{kicker}</p>
            <h2 className="confirm-dialog-title" id={titleId}>
              {title}
            </h2>
          </div>
        </div>

        <div className="confirm-dialog-body">
          <p className="confirm-dialog-message" id={messageId}>
            {message}
          </p>
          {details.length > 0 ? (
            <ul className="confirm-dialog-details">
              {details.map((detail, index) => (
                <li key={`${detail}-${index}`} className="confirm-dialog-detail">
                  {detail}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="confirm-dialog-actions">
          <button
            ref={cancelButtonRef}
            type="button"
            className="confirm-dialog-button is-secondary"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          {secondaryLabel && onSecondary ? (
            <button
              type="button"
              className={`confirm-dialog-button ${secondaryToneClass}`}
              onClick={onSecondary}
            >
              {secondaryLabel}
            </button>
          ) : null}
          <button type="button" className={`confirm-dialog-button ${dialogToneClass}`} onClick={onConfirm}>
            <span className="confirm-dialog-button-icon" aria-hidden="true">
              <ConfirmDialogActionIcon tone={tone} />
            </span>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
