import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  createLocorisBackupBlob,
  createReadableVaultZipBlob,
  getReadableVaultZipFileName,
  getVaultBackupFileName,
  parseLocorisBackupBlob,
  restoreLocorisBackupBlob,
  type VaultBackupParseResult
} from "../lib/exportImport/vaultBackup";
import {
  openBlobFileWithDialog,
  saveBlobFileWithDialog
} from "../lib/nativeFileIntegration";
import type { LocalVaultKind } from "../lib/localVaults";
import type { AppLanguage } from "../types";
import ConfirmDialog from "./ConfirmDialog";
import {
  usePrivateVaultWarning,
  type PrivateVaultWarningContext
} from "./PrivateVaultWarningDialog";
import "./BackupSettingsPanel.css";

type BackupBusyState = "backup" | "readable" | "restore" | null;
type BackupFeedback = {
  tone: "success" | "error" | "info";
  text: string;
} | null;

interface BackupSettingsPanelProps {
  activeLocalVaultId: string;
  vaultName: string;
  vaultKind: LocalVaultKind;
  language: AppLanguage;
}

function BackupIcon() {
  return (
    <svg viewBox="0 0 22 22" aria-hidden="true" focusable="false">
      <path d="M6.2 7.2a5.3 5.3 0 0 1 9.7 2.8h.3a2.9 2.9 0 0 1 0 5.8H6.1a3.5 3.5 0 0 1 .1-7Z" />
      <path d="M11 8.4v5.2" className="backup-card-icon-accent" />
      <path d="m8.7 11.2 2.3 2.4 2.3-2.4" className="backup-card-icon-accent" />
    </svg>
  );
}

export default function BackupSettingsPanel({
  activeLocalVaultId,
  vaultName,
  vaultKind,
  language
}: BackupSettingsPanelProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<BackupBusyState>(null);
  const [feedback, setFeedback] = useState<BackupFeedback>(null);
  const [pendingRestore, setPendingRestore] = useState<{
    fileName: string;
    blob: Blob;
    parsed: VaultBackupParseResult;
  } | null>(null);
  const readableDate = useMemo(
    () => new Intl.DateTimeFormat(language === "ru" ? "ru-RU" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short"
    }),
    [language]
  );
  const privateVaultWarningContext: PrivateVaultWarningContext = {
    localVaultId: activeLocalVaultId,
    vaultKind,
    vaultName
  };
  const { confirmPrivateVaultAction, privateVaultWarningDialog } =
    usePrivateVaultWarning(privateVaultWarningContext);

  const handleSaveExactBackup = async () => {
    if (!(await confirmPrivateVaultAction("backupExact"))) {
      return;
    }

    setBusy("backup");
    setFeedback(null);

    try {
      const blob = await createLocorisBackupBlob({
        localVaultId: activeLocalVaultId,
        vaultName
      });
      const didSave = await saveBlobFileWithDialog({
        defaultPath: getVaultBackupFileName(vaultName),
        filters: [
          {
            name: "Locoris Backup",
            extensions: ["locorisbackup"]
          }
        ],
        blob,
        preferredExtension: "locorisbackup"
      });

      if (didSave) {
        setFeedback({ tone: "success", text: t("settings.backupCreated") });
      }
    } catch {
      setFeedback({ tone: "error", text: t("settings.backupCreateFailed") });
    } finally {
      setBusy(null);
    }
  };

  const handleSaveReadableZip = async () => {
    if (!(await confirmPrivateVaultAction("backupReadable"))) {
      return;
    }

    setBusy("readable");
    setFeedback(null);

    try {
      const blob = await createReadableVaultZipBlob({
        localVaultId: activeLocalVaultId,
        vaultName,
        language
      });
      const didSave = await saveBlobFileWithDialog({
        defaultPath: getReadableVaultZipFileName(vaultName),
        filters: [
          {
            name: "ZIP",
            extensions: ["zip"]
          }
        ],
        blob,
        preferredExtension: "zip"
      });

      if (didSave) {
        setFeedback({ tone: "success", text: t("settings.backupReadableCreated") });
      }
    } catch {
      setFeedback({ tone: "error", text: t("settings.backupReadableFailed") });
    } finally {
      setBusy(null);
    }
  };

  const handlePickRestoreBackup = async () => {
    setBusy("restore");
    setFeedback(null);

    try {
      const file = await openBlobFileWithDialog({
        filters: [
          {
            name: "Locoris Backup",
            extensions: ["locorisbackup", "zip", "json"]
          }
        ]
      });

      if (!file) {
        return;
      }

      const parsed = await parseLocorisBackupBlob(file.blob);
      setPendingRestore({ fileName: file.fileName, blob: file.blob, parsed });
      setFeedback({ tone: "info", text: t("settings.backupValidated") });
    } catch {
      setFeedback({ tone: "error", text: t("settings.backupInvalid") });
    } finally {
      setBusy(null);
    }
  };

  const handleConfirmRestore = async () => {
    if (!pendingRestore) {
      return;
    }

    setBusy("restore");
    setFeedback(null);

    try {
      await restoreLocorisBackupBlob({
        localVaultId: activeLocalVaultId,
        blob: pendingRestore.blob
      });
      setPendingRestore(null);
      setFeedback({ tone: "success", text: t("settings.backupRestored") });
    } catch {
      setFeedback({ tone: "error", text: t("settings.backupRestoreFailed") });
    } finally {
      setBusy(null);
    }
  };

  const restoreDate = pendingRestore?.parsed.manifest?.exportedAt
    ? readableDate.format(pendingRestore.parsed.manifest.exportedAt)
    : pendingRestore?.parsed.backup.savedAt
      ? readableDate.format(pendingRestore.parsed.backup.savedAt)
      : "";

  return (
    <>
      <div className="backup-settings-layout">
        <section className="settings-panel-block settings-panel-block-primary backup-settings-hero">
          <div className="backup-settings-hero-copy">
            <span className="backup-settings-hero-icon" aria-hidden="true">
              <BackupIcon />
            </span>
            <div>
              <p className="panel-kicker settings-panel-block-kicker">{t("settings.backupKicker")}</p>
              <h3>{t("settings.backupHeroTitle")}</h3>
              <p>{t("settings.backupHeroDescription")}</p>
            </div>
          </div>
        </section>

        <section className="settings-panel-block backup-settings-card-grid">
          <button
            type="button"
            className="backup-settings-card"
            onClick={() => void handleSaveExactBackup()}
            disabled={busy !== null}
          >
            <span className="backup-settings-card-head">
              <strong>{t("settings.backupExactTitle")}</strong>
              <span>{busy === "backup" ? t("settings.backupWorking") : t("settings.backupExactChip")}</span>
            </span>
            <p>{t("settings.backupExactDescription")}</p>
          </button>

          <button
            type="button"
            className="backup-settings-card"
            onClick={() => void handlePickRestoreBackup()}
            disabled={busy !== null}
          >
            <span className="backup-settings-card-head">
              <strong>{t("settings.backupRestoreTitle")}</strong>
              <span>{busy === "restore" ? t("settings.backupWorking") : t("settings.backupRestoreChip")}</span>
            </span>
            <p>{t("settings.backupRestoreDescription")}</p>
          </button>

          <button
            type="button"
            className="backup-settings-card"
            onClick={() => void handleSaveReadableZip()}
            disabled={busy !== null}
          >
            <span className="backup-settings-card-head">
              <strong>{t("settings.backupReadableTitle")}</strong>
              <span>{busy === "readable" ? t("settings.backupWorking") : t("settings.backupReadableChip")}</span>
            </span>
            <p>{t("settings.backupReadableDescription")}</p>
          </button>
        </section>

        <section className="settings-panel-block backup-settings-note">
          <span>{t("settings.backupSafetyTitle")}</span>
          <p>{t("settings.backupSafetyDescription")}</p>
          {feedback ? (
            <p className={`backup-settings-feedback is-${feedback.tone}`}>{feedback.text}</p>
          ) : null}
        </section>
      </div>

      <ConfirmDialog
        open={Boolean(pendingRestore)}
        kicker={t("settings.backupRestoreKicker")}
        title={t("settings.backupRestoreConfirmTitle")}
        message={
          pendingRestore
            ? t("settings.backupRestoreConfirmMessage", {
                fileName: pendingRestore.fileName,
                vaultName: pendingRestore.parsed.manifest?.vaultName ?? pendingRestore.parsed.backup.localVaultId,
                date: restoreDate
              })
            : ""
        }
        details={[t("settings.backupRestoreConfirmDetail")]}
        confirmLabel={t("settings.backupRestoreConfirm")}
        cancelLabel={t("dialog.cancel")}
        tone="danger"
        onCancel={() => setPendingRestore(null)}
        onConfirm={() => void handleConfirmRestore()}
      />
      {privateVaultWarningDialog}
    </>
  );
}
