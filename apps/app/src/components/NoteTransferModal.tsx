import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { NoteExportFormat } from "../lib/exportImport/noteExport";
import "./NoteTransferModal.css";

type NoteTransferTab = "export" | "import";
type NoteTransferStatus = {
  tone: "success" | "error" | "info";
  text: string;
} | null;

interface NoteTransferModalProps {
  open: boolean;
  status: NoteTransferStatus;
  busyFormat: NoteExportFormat | "copy" | "import" | null;
  onClose: () => void;
  onCopyMarkdown: () => void | Promise<void>;
  onExport: (format: NoteExportFormat) => void | Promise<void>;
  onImportMarkdown: () => void | Promise<void>;
}

const EXPORT_OPTIONS: Array<{
  id: NoteExportFormat;
  titleKey: string;
  descriptionKey: string;
  chipKey: string;
}> = [
  {
    id: "pdf",
    titleKey: "note.transferExportPdf",
    descriptionKey: "note.transferExportPdfDescription",
    chipKey: "note.transferExportPdfChip"
  },
  {
    id: "docx",
    titleKey: "note.transferExportDocx",
    descriptionKey: "note.transferExportDocxDescription",
    chipKey: "note.transferExportDocxChip"
  },
  {
    id: "html",
    titleKey: "note.transferExportHtml",
    descriptionKey: "note.transferExportHtmlDescription",
    chipKey: "note.transferExportHtmlChip"
  },
  {
    id: "markdown",
    titleKey: "note.transferExportMarkdown",
    descriptionKey: "note.transferExportMarkdownDescription",
    chipKey: "note.transferExportMarkdownChip"
  }
];

function CloseIcon() {
  return <span aria-hidden="true">×</span>;
}

function TransferGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M6 7.5h9.3" />
      <path d="m12.2 4.4 3.1 3.1-3.1 3.1" />
      <path d="M18 16.5H8.7" />
      <path d="m11.8 13.4-3.1 3.1 3.1 3.1" />
    </svg>
  );
}

export default function NoteTransferModal({
  open,
  status,
  busyFormat,
  onClose,
  onCopyMarkdown,
  onExport,
  onImportMarkdown
}: NoteTransferModalProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<NoteTransferTab>("export");
  const titleId = useId();
  const modalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    setTab("export");

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusTimer = window.setTimeout(() => {
      modalRef.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus({ preventScroll: true });
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="note-transfer-layer" role="presentation">
      <button
        type="button"
        className="note-transfer-dim"
        aria-label={t("orbit.closeModal")}
        onClick={onClose}
      />

      <section
        ref={modalRef}
        className="note-transfer-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="note-transfer-sheen" aria-hidden="true" />
        <header className="note-transfer-head">
          <span className="note-transfer-glyph" aria-hidden="true">
            <TransferGlyph />
          </span>
          <div>
            <p className="note-transfer-kicker">{t("note.transferKicker")}</p>
            <h3 id={titleId}>{t("note.transferTitle")}</h3>
            <p>{t("note.transferDescription")}</p>
          </div>
          <button
            type="button"
            className="note-transfer-close"
            onClick={onClose}
            aria-label={t("orbit.closeModal")}
          >
            <CloseIcon />
          </button>
        </header>

        <div className="note-transfer-tabs" role="tablist" aria-label={t("note.transferTabs")}>
          <button
            type="button"
            className={tab === "export" ? "is-active" : ""}
            onClick={() => setTab("export")}
            role="tab"
            aria-selected={tab === "export"}
          >
            {t("note.transferExportTab")}
          </button>
          <button
            type="button"
            className={tab === "import" ? "is-active" : ""}
            onClick={() => setTab("import")}
            role="tab"
            aria-selected={tab === "import"}
          >
            {t("note.transferImportTab")}
          </button>
        </div>

        {tab === "export" ? (
          <div className="note-transfer-body">
            <div className="note-transfer-option-grid">
              {EXPORT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className="note-transfer-option"
                  onClick={() => void onExport(option.id)}
                  disabled={busyFormat !== null}
                >
                  <span className="note-transfer-option-head">
                    <strong>{t(option.titleKey)}</strong>
                    <span>{busyFormat === option.id ? t("note.transferWorking") : t(option.chipKey)}</span>
                  </span>
                  <p>{t(option.descriptionKey)}</p>
                </button>
              ))}
            </div>

            <button
              type="button"
              className="note-transfer-copy-action"
              onClick={() => void onCopyMarkdown()}
              disabled={busyFormat !== null}
            >
              {busyFormat === "copy" ? t("note.transferWorking") : t("note.copyMarkdown")}
            </button>
          </div>
        ) : (
          <div className="note-transfer-body">
            <button
              type="button"
              className="note-transfer-import-card"
              onClick={() => void onImportMarkdown()}
              disabled={busyFormat !== null}
            >
              <span className="note-transfer-option-head">
                <strong>{t("note.importMarkdown")}</strong>
                <span>{busyFormat === "import" ? t("note.transferWorking") : "MD"}</span>
              </span>
              <p>{t("note.transferImportMarkdownDescription")}</p>
            </button>
            <p className="note-transfer-note">{t("note.transferImportWarning")}</p>
          </div>
        )}

        {status ? (
          <p className={`note-transfer-status is-${status.tone}`}>{status.text}</p>
        ) : null}
      </section>
    </div>
  );
}

