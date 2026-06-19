import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import type { SaveState } from "../types";
import "./CanvasPane.mobile.css";

type CanvasMobileChromeProps = {
  title: string;
  placeholder: string;
  saveState: SaveState;
  exportStatus: "pdf" | "json" | "error" | null;
  taskStatus: "created" | "error" | null;
  selectionCount: number;
  isAiOpen: boolean;
  isPinned: boolean;
  isTrashed: boolean;
  onTitleChange: (title: string) => void;
  onClose: () => void;
  onToggleAi: () => void;
  onOpenInfo: () => void;
  onFitContent: () => void;
  onCreateTask: () => void;
  onOpenNativeMenu: () => void;
  onTogglePin: () => void;
  onRestore: () => void;
  onDelete: () => void;
  onClearCanvas: () => void;
};

function getStatusTone(saveState: SaveState) {
  return saveState === "saving" ? "saving" : "saved";
}

function CanvasMobileBackGlyph() {
  return (
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <path
        d="M14.75 5.25 8 12l6.75 6.75M8.75 12H20"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

export default function CanvasMobileChrome({
  title,
  placeholder,
  saveState,
  exportStatus,
  taskStatus,
  selectionCount,
  isAiOpen,
  isPinned,
  isTrashed,
  onTitleChange,
  onClose,
  onToggleAi,
  onOpenInfo,
  onFitContent,
  onCreateTask,
  onOpenNativeMenu,
  onTogglePin,
  onRestore,
  onDelete,
  onClearCanvas
}: CanvasMobileChromeProps) {
  const { t } = useTranslation();
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);
  const statusTone = getStatusTone(saveState);
  const displayTitle = title.trim() || placeholder;

  useEffect(() => {
    setTitleDraft(title);
  }, [title]);

  const handleRenameSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onTitleChange(titleDraft);
    setIsRenameOpen(false);
  };

  const closeTransientSheets = () => {
    setIsMenuOpen(false);
    setIsRenameOpen(false);
  };

  return (
    <>
      <div className="canvas-mobile-chrome" aria-label={t("canvas.mobile.chromeLabel")}>
        <header className="canvas-mobile-header">
          <button
            type="button"
            className="canvas-mobile-icon-button is-back"
            onClick={onClose}
            aria-label={t("note.mobileBack")}
            title={t("note.mobileBack")}
          >
            <CanvasMobileBackGlyph />
          </button>

          <button
            type="button"
            className="canvas-mobile-title-chip"
            onClick={() => {
              closeTransientSheets();
              setIsRenameOpen(true);
            }}
            aria-label={t("canvas.mobile.rename")}
            title={t("canvas.mobile.rename")}
          >
            <span className={`canvas-mobile-save-dot is-${statusTone}`} aria-hidden="true" />
            <span className="canvas-mobile-title-copy">
              <strong>{displayTitle}</strong>
              <small>{t(`saveState.${saveState}`)}</small>
            </span>
          </button>

          <div className="canvas-mobile-header-actions">
            <button
              type="button"
              className={`canvas-mobile-icon-button is-ai ${isAiOpen ? "is-active" : ""}`}
              onClick={() => {
                closeTransientSheets();
                onToggleAi();
              }}
              aria-label={t("canvas.aiButton")}
              title={t("canvas.aiButton")}
            >
              <span aria-hidden="true">AI</span>
            </button>
            <button
              type="button"
              className="canvas-mobile-icon-button is-menu"
              onClick={() => {
                setIsRenameOpen(false);
                setIsMenuOpen(true);
              }}
              aria-label={t("orbit.mobileMenu")}
              title={t("orbit.mobileMenu")}
            >
              <span aria-hidden="true" />
            </button>
          </div>
        </header>

        {(exportStatus || taskStatus) ? (
          <div className="canvas-mobile-toast-row" role="status">
            {exportStatus ? (
              <span className={`canvas-mobile-status-chip is-${exportStatus}`}>
                {t(`canvas.exportStatus.${exportStatus}`)}
              </span>
            ) : null}
            {taskStatus ? (
              <span className={`canvas-mobile-status-chip is-task-${taskStatus}`}>
                {taskStatus === "created" ? t("canvas.taskCreated") : t("canvas.taskFailed")}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {isRenameOpen ? (
        <div className="canvas-mobile-sheet-layer" role="presentation">
          <button
            type="button"
            className="canvas-mobile-sheet-backdrop"
            onClick={() => setIsRenameOpen(false)}
            aria-label={t("canvas.mobile.closeSheet")}
          />
          <form className="canvas-mobile-rename-sheet" onSubmit={handleRenameSubmit}>
            <div className="canvas-mobile-sheet-handle" aria-hidden="true" />
            <header>
              <div>
                <span>{t("canvas.mobile.renameKicker")}</span>
                <strong>{t("canvas.mobile.rename")}</strong>
              </div>
              <button
                type="button"
                className="canvas-mobile-sheet-close"
                onClick={() => setIsRenameOpen(false)}
                aria-label={t("canvas.mobile.closeSheet")}
              >
                <span aria-hidden="true" />
              </button>
            </header>
            <label>
              <span>{t("canvas.titlePlaceholder")}</span>
              <input
                autoFocus
                value={titleDraft}
                onChange={(event) => setTitleDraft(event.target.value)}
                placeholder={placeholder}
              />
            </label>
            <footer>
              <button type="button" onClick={() => setIsRenameOpen(false)}>
                {t("orbit.cancel")}
              </button>
              <button type="submit" className="is-primary">
                {t("folders.save")}
              </button>
            </footer>
          </form>
        </div>
      ) : null}

      {isMenuOpen ? (
        <div className="canvas-mobile-sheet-layer" role="presentation">
          <button
            type="button"
            className="canvas-mobile-sheet-backdrop"
            onClick={() => setIsMenuOpen(false)}
            aria-label={t("canvas.mobile.closeSheet")}
          />
          <section className="canvas-mobile-menu-sheet" role="dialog" aria-modal="true" aria-label={t("orbit.mobileMenu")}>
            <div className="canvas-mobile-sheet-handle" aria-hidden="true" />
            <header>
              <div>
                <span>{t("canvas.mobile.menuKicker")}</span>
                <strong>{t("canvas.mobile.menuTitle")}</strong>
              </div>
              <button
                type="button"
                className="canvas-mobile-sheet-close"
                onClick={() => setIsMenuOpen(false)}
                aria-label={t("canvas.mobile.closeSheet")}
              >
                <span aria-hidden="true" />
              </button>
            </header>
            <div className="canvas-mobile-action-grid">
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenInfo();
                }}
              >
                <span className="canvas-mobile-action-icon is-info" aria-hidden="true" />
                <span>
                  <strong>{t("canvas.infoTab")}</strong>
                  <small>{t("canvas.mobile.infoHint")}</small>
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onFitContent();
                }}
              >
                <span className="canvas-mobile-action-icon is-fit" aria-hidden="true" />
                <span>
                  <strong>{t("canvas.mobile.fit")}</strong>
                  <small>{t("canvas.mobile.fitHint")}</small>
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onCreateTask();
                }}
                disabled={selectionCount === 0}
              >
                <span className="canvas-mobile-action-icon is-task" aria-hidden="true" />
                <span>
                  <strong>{t("note.createTaskShort")}</strong>
                  <small>{selectionCount > 0 ? t("canvas.mobile.selectionCount", { count: selectionCount }) : t("canvas.taskSelectionRequired")}</small>
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenNativeMenu();
                }}
              >
                <span className="canvas-mobile-action-icon is-native" aria-hidden="true" />
                <span>
                  <strong>{t("canvas.mobile.nativeMenu")}</strong>
                  <small>{t("canvas.mobile.nativeMenuHint")}</small>
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onTogglePin();
                }}
              >
                <span className="canvas-mobile-action-icon is-pin" aria-hidden="true" />
                <span>
                  <strong>{isPinned ? t("note.unpin") : t("note.pin")}</strong>
                  <small>{t("canvas.mobile.pinHint")}</small>
                </span>
              </button>
              {isTrashed ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onRestore();
                  }}
                >
                  <span className="canvas-mobile-action-icon is-restore" aria-hidden="true" />
                  <span>
                    <strong>{t("note.restore")}</strong>
                    <small>{t("canvas.mobile.restoreHint")}</small>
                  </span>
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onClearCanvas();
                }}
              >
                <span className="canvas-mobile-action-icon is-clear" aria-hidden="true" />
                <span>
                  <strong>{t("canvas.clearCanvas")}</strong>
                  <small>{t("canvas.mobile.clearHint")}</small>
                </span>
              </button>
              <button
                type="button"
                className="is-danger"
                onClick={() => {
                  setIsMenuOpen(false);
                  onDelete();
                }}
              >
                <span className="canvas-mobile-action-icon is-delete" aria-hidden="true" />
                <span>
                  <strong>{isTrashed ? t("note.deletePermanently") : t("note.moveToTrash")}</strong>
                  <small>{t("canvas.mobile.deleteHint")}</small>
                </span>
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
