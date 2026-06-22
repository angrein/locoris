import type { ReactNode, Ref } from "react";
import "./SyncSettingsLayout.css";

interface SyncSettingsLayoutProps {
  title: string;
  kicker: ReactNode;
  caption: string;
  backLabel: string;
  closeLabel: string;
  backIcon: ReactNode;
  closeIcon: ReactNode;
  stageRef: Ref<HTMLDivElement>;
  wires: ReactNode;
  bindingHint?: ReactNode;
  feedback?: ReactNode;
  children: ReactNode;
  onBack: () => void;
  onClose: () => void;
}

interface SyncSettingsDialogProps {
  open: boolean;
  kicker: ReactNode;
  title: ReactNode;
  closeLabel: string;
  closeIcon: ReactNode;
  children: ReactNode;
  onClose: () => void;
}

export function SyncSettingsLayout({
  title,
  kicker,
  caption,
  backLabel,
  closeLabel,
  backIcon,
  closeIcon,
  stageRef,
  wires,
  bindingHint,
  feedback,
  children,
  onBack,
  onClose
}: SyncSettingsLayoutProps) {
  return (
    <section className="settings-panel-shell sync-settings-panel-shell">
      <header className="settings-panel-header sync-settings-panel-header has-back-action">
        <button
          type="button"
          className="settings-panel-nav-button sync-settings-panel-nav"
          onClick={onBack}
          aria-label={backLabel}
          title={backLabel}
        >
          <span className="settings-row-action-icon sync-settings-panel-nav-icon" aria-hidden="true">
            {backIcon}
          </span>
        </button>

        <div className="settings-panel-heading sync-settings-panel-heading">
          <p className="settings-panel-kicker sync-settings-panel-kicker">{kicker}</p>
          <h2 className="panel-title settings-panel-title sync-settings-panel-title">{title}</h2>
          <p className="settings-panel-caption sync-settings-panel-caption">{caption}</p>
        </div>

        <div className="settings-panel-header-actions">
          <button
            type="button"
            className="settings-panel-nav-button settings-panel-close-button sync-settings-panel-close"
            onClick={onClose}
            aria-label={closeLabel}
            title={closeLabel}
          >
            <span className="settings-panel-close-icon sync-settings-panel-close-icon" aria-hidden="true">
              {closeIcon}
            </span>
          </button>
        </div>
      </header>


      <div className="sync-settings-workspace" ref={stageRef}>
        {wires}
        {children}
      </div>

      {bindingHint}
      {feedback}
    </section>
  );
}

export function SyncSettingsDialog({
  open,
  kicker,
  title,
  closeLabel,
  closeIcon,
  children,
  onClose
}: SyncSettingsDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="sync-settings-modal-layer sync-settings-premium-dialog" role="dialog" aria-modal="true">
      <button className="sync-settings-modal-dim" aria-label={closeLabel} onClick={onClose} />
      <div className="sync-settings-modal-card">
        <div className="sync-settings-modal-head">
          <div className="sync-settings-modal-heading">
            <p className="panel-kicker">{kicker}</p>
            <h3>{title}</h3>
          </div>
          <button
            type="button"
            className="sync-settings-icon-button sync-settings-modal-close"
            onClick={onClose}
            aria-label={closeLabel}
            title={closeLabel}
          >
            {closeIcon}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
