import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { LocalVaultKind, LocalVaultProfile } from "../lib/localVaults";
import {
  checkForDesktopUpdate,
  initializeDesktopUpdateState,
  installAvailableDesktopUpdate,
  openDesktopUpdateReleasePage,
  readDesktopUpdateSnapshot,
  retryFailedDesktopUpdateInstall,
  subscribeDesktopUpdateState,
  supportsDesktopUpdates
} from "../lib/desktopUpdates";
import type {
  AppLanguage,
  AppSettings,
  RemoteVaultImportResult,
  SyncConnection,
  SyncVaultBinding,
  VaultEncryptionSummary
} from "../types";
import SyncSettingsPanel from "./SyncSettingsPanel";
import "./SettingsPanel.css";

type SyncFeedbackState = {
  tone: "success" | "error";
  text: string;
} | null;

interface SettingsPanelProps {
  settings: AppSettings;
  online: boolean;
  localVaults: LocalVaultProfile[];
  activeLocalVaultId: string;
  selectedLocalVaultId: string;
  syncConnections: SyncConnection[];
  syncBindings: SyncVaultBinding[];
  vaultEncryptionById: Record<string, VaultEncryptionSummary>;
  syncFeedback?: SyncFeedbackState;
  onLanguageChange: (language: AppLanguage) => void;
  onSelectLocalVault: (localVaultId: string) => void;
  onCreateLocalVault: (input: {
    name: string;
    vaultKind: LocalVaultKind;
    passphrase?: string;
  }) => string | Promise<string>;
  onRenameLocalVault: (localVaultId: string, name: string) => void;
  onDeleteLocalVault: (
    localVaultId: string,
    options?: {
      skipConfirmation?: boolean;
    }
  ) => void | Promise<void>;
  onCreateConnection: (input: {
    provider: "selfHosted" | "hosted" | "googleDrive";
    serverUrl: string;
    label?: string;
    managementToken?: string;
    sessionToken?: string;
    refreshToken?: string | null;
    tokenExpiresAt?: number | null;
    userId?: string | null;
    userName?: string;
    userEmail?: string;
  }) => void | Promise<void>;
  onDeleteConnection: (connectionId: string) => void | Promise<void>;
  onUpdateConnection: (
    connectionId: string,
    patch: Partial<Omit<SyncConnection, "id" | "provider" | "createdAt">> & {
      refreshToken?: string | null;
    }
  ) => void | Promise<void>;
  onBindVault: (input: {
    localVaultId: string;
    connectionId: string;
    remoteVaultId: string;
    remoteVaultName?: string;
    syncToken: string;
  }) => void | Promise<void>;
  onImportRemoteVault: (input: {
    connectionId: string;
    remoteVaultId: string;
    remoteVaultName: string;
    remoteVaultKind?: LocalVaultKind;
    openAfterImport?: boolean;
  }) => Promise<RemoteVaultImportResult>;
  onDeleteRemoteVault: (input: {
    connectionId: string;
    remoteVaultId: string;
  }) => Promise<void>;
  onClearBinding: (localVaultId: string) => void | Promise<void>;
  onRunVaultSync: (localVaultId: string) => void | Promise<void>;
  onEnableVaultEncryption: (input: {
    localVaultId: string;
    passphrase: string;
  }) => void | Promise<void>;
  onUnlockVaultEncryption: (input: {
    localVaultId: string;
    passphrase: string;
  }) => void | Promise<void>;
  onChangeVaultEncryptionPassphrase: (input: {
    localVaultId: string;
    currentPassphrase?: string;
    nextPassphrase: string;
  }) => void | Promise<void>;
  onDisableVaultEncryption: (input: {
    localVaultId: string;
    currentPassphrase?: string;
  }) => void | Promise<void>;
  onLockVaultEncryption: (localVaultId: string) => void | Promise<void>;
}

function LanguageGlyph() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M3.2 4.5h6.2M6.3 4.5c0 5-1.9 8.4-3.6 10.6M6.3 4.5c1.2 2.4 2.8 4.8 4.9 6.8M11.8 6.8h5M14.3 6.8v8.4M11.6 12.4h5.4" />
    </svg>
  );
}

function SyncGlyph() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M4.2 6.2h4.7" />
      <path d="m7.1 3.6 2.6 2.6-2.6 2.6" className="settings-row-icon-accent" />
      <path d="M15.8 13.8h-4.7" />
      <path d="m12.9 11.2-2.6 2.6 2.6 2.6" className="settings-row-icon-accent" />
      <path d="M6.4 13.8a4.2 4.2 0 0 0 3.6 2" />
      <path d="M13.6 6.2A4.2 4.2 0 0 0 10 4.3" />
    </svg>
  );
}

function ChevronGlyph({ expanded = false }: { expanded?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path
        d={expanded ? "M5.5 7.4 10 11.9l4.5-4.5" : "M7.4 5.5 11.9 10l-4.5 4.5"}
        className="settings-row-icon-accent"
      />
    </svg>
  );
}

type SettingsView = "root" | "sync";

function UpdateGlyph() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M10 3.2v7" />
      <path d="m6.7 7.3 3.3 3.3 3.3-3.3" className="settings-row-icon-accent" />
      <path d="M4.1 13.9h11.8" />
      <path d="M5.4 16.3h9.2" />
    </svg>
  );
}

export default function SettingsPanel({
  settings,
  online,
  localVaults,
  activeLocalVaultId,
  selectedLocalVaultId,
  syncConnections,
  syncBindings,
  vaultEncryptionById,
  syncFeedback = null,
  onLanguageChange,
  onSelectLocalVault,
  onCreateLocalVault,
  onRenameLocalVault,
  onDeleteLocalVault,
  onCreateConnection,
  onDeleteConnection,
  onUpdateConnection,
  onBindVault,
  onImportRemoteVault,
  onDeleteRemoteVault,
  onClearBinding,
  onRunVaultSync,
  onEnableVaultEncryption,
  onUnlockVaultEncryption,
  onChangeVaultEncryptionPassphrase,
  onDisableVaultEncryption,
  onLockVaultEncryption
}: SettingsPanelProps) {
  const { t } = useTranslation();
  const [view, setView] = useState<SettingsView>("root");
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [desktopUpdateState, setDesktopUpdateState] = useState(() => readDesktopUpdateSnapshot());
  const languageMenuRef = useRef<HTMLDivElement | null>(null);
  const desktopUpdatesEnabled = supportsDesktopUpdates();

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!languageMenuRef.current?.contains(event.target as Node)) {
        setLanguageMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (!desktopUpdatesEnabled) {
      return;
    }

    void initializeDesktopUpdateState();

    return subscribeDesktopUpdateState(setDesktopUpdateState);
  }, [desktopUpdatesEnabled]);

  useEffect(() => {
    if (!desktopUpdatesEnabled || desktopUpdateState.phase !== "idle") {
      return;
    }

    void handleCheckDesktopUpdates();
  }, [desktopUpdatesEnabled, desktopUpdateState.phase]);

  const handleCheckDesktopUpdates = async () => {
    await checkForDesktopUpdate();
  };

  const handleInstallDesktopUpdate = async () => {
    await installAvailableDesktopUpdate();
  };

  const handleRetryDesktopUpdate = async () => {
    await retryFailedDesktopUpdateInstall();
  };

  const handleOpenDesktopReleasePage = async () => {
    await openDesktopUpdateReleasePage(
      desktopUpdateState.availableVersion ?? desktopUpdateState.lastAttemptedVersion
    );
  };

  const desktopUpdateCurrentVersion = desktopUpdateState.currentVersion;
  const desktopUpdatePublishedLabel = desktopUpdateState.releaseDate
    ? new Intl.DateTimeFormat(settings.language === "ru" ? "ru-RU" : "en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }).format(new Date(desktopUpdateState.releaseDate))
    : null;

  const desktopUpdateIssueText =
    desktopUpdateState.issueCode === "unsupported"
      ? t("settings.desktopUpdateUnsupported")
      : desktopUpdateState.issueCode === "metadata-invalid"
      ? t("settings.desktopUpdateIssueMetadataInvalid")
      : desktopUpdateState.issueCode === "download-failed"
      ? t("settings.desktopUpdateIssueDownloadFailed")
      : desktopUpdateState.issueCode === "install-failed"
      ? t("settings.desktopUpdateIssueInstallFailed")
      : desktopUpdateState.issueCode === "install-not-applied"
      ? t("settings.desktopUpdateIssueInstallNotApplied", {
          version:
            desktopUpdateState.availableVersion ??
            desktopUpdateState.lastAttemptedVersion ??
            "—"
        })
      : desktopUpdateState.issueCode === "check-failed"
      ? t("settings.desktopUpdateIssueCheckFailed")
      : null;

  const desktopUpdateDescription =
    desktopUpdateState.phase === "checking"
      ? t("settings.desktopUpdateChecking")
      : desktopUpdateState.phase === "upToDate"
      ? t("settings.desktopUpdateUpToDate", {
          version: desktopUpdateCurrentVersion ?? "—"
        })
      : desktopUpdateState.phase === "available"
      ? t("settings.desktopUpdateAvailable", {
          version: desktopUpdateState.availableVersion ?? "—"
        })
      : desktopUpdateState.phase === "downloading"
      ? t("settings.desktopUpdateDownloading", {
          progress:
            desktopUpdateState.progress === null
              ? ""
              : ` ${desktopUpdateState.progress}%`
        })
      : desktopUpdateState.phase === "restarting"
      ? t("settings.desktopUpdateRestarting")
      : desktopUpdateState.phase === "failed"
      ? desktopUpdateIssueText ?? t("settings.desktopUpdateError")
      : desktopUpdateCurrentVersion
      ? t("settings.desktopUpdateCurrent", {
          version: desktopUpdateCurrentVersion
        })
      : t("settings.desktopUpdateCurrentUnknown");

  const desktopUpdatePrimaryActionLabel =
    desktopUpdateState.phase === "checking"
      ? t("settings.desktopUpdateCheckingAction")
      : desktopUpdateState.phase === "available"
      ? t("settings.desktopUpdateInstall")
      : desktopUpdateState.phase === "downloading" ||
        desktopUpdateState.phase === "restarting"
      ? t("settings.desktopUpdateInstalling")
      : desktopUpdateState.phase === "failed" && desktopUpdateState.canRetryInstall
      ? t("settings.desktopUpdateRetry")
      : t("settings.desktopUpdateCheck");

  const desktopUpdatePrimaryAction =
    desktopUpdateState.phase === "available"
      ? handleInstallDesktopUpdate
      : desktopUpdateState.phase === "failed" && desktopUpdateState.canRetryInstall
      ? handleRetryDesktopUpdate
      : handleCheckDesktopUpdates;

  const desktopUpdatePrimaryActionDisabled =
    desktopUpdateState.phase === "checking" ||
    desktopUpdateState.phase === "downloading" ||
    desktopUpdateState.phase === "restarting";

  const shouldShowOpenReleaseAction =
    desktopUpdateState.canOpenReleasePage &&
    (desktopUpdateState.phase === "available" || desktopUpdateState.phase === "failed");

  if (view === "sync") {
    return (
      <SyncSettingsPanel
        settings={settings}
        online={online}
        localVaults={localVaults}
        activeLocalVaultId={activeLocalVaultId}
        selectedLocalVaultId={selectedLocalVaultId}
        syncConnections={syncConnections}
        syncBindings={syncBindings}
        vaultEncryptionById={vaultEncryptionById}
        syncFeedback={syncFeedback}
        onBack={() => setView("root")}
        onSelectLocalVault={onSelectLocalVault}
        onCreateLocalVault={onCreateLocalVault}
        onRenameLocalVault={onRenameLocalVault}
        onDeleteLocalVault={onDeleteLocalVault}
        onCreateConnection={onCreateConnection}
        onDeleteConnection={onDeleteConnection}
        onUpdateConnection={onUpdateConnection}
        onBindVault={onBindVault}
        onImportRemoteVault={onImportRemoteVault}
        onDeleteRemoteVault={onDeleteRemoteVault}
        onClearBinding={onClearBinding}
        onRunVaultSync={onRunVaultSync}
        onEnableVaultEncryption={onEnableVaultEncryption}
        onUnlockVaultEncryption={onUnlockVaultEncryption}
        onChangeVaultEncryptionPassphrase={onChangeVaultEncryptionPassphrase}
        onDisableVaultEncryption={onDisableVaultEncryption}
        onLockVaultEncryption={onLockVaultEncryption}
      />
    );
  }

  const currentLanguageLabel =
    settings.language === "ru" ? t("settings.languageRussian") : t("settings.languageEnglish");

  return (
    <section className="settings-panel-shell">
      <header className="settings-panel-header">
        <div className="settings-panel-heading">
          <p className="panel-kicker settings-panel-kicker">{t("settings.kicker")}</p>
          <h2 className="panel-title settings-panel-title">{t("settings.title")}</h2>
          <p className="settings-panel-caption">{t("settings.caption")}</p>
        </div>
      </header>

      <div className="settings-panel-grid">
        <section className="settings-panel-block settings-panel-block-primary">
          <div className="settings-panel-block-head">
            <p className="panel-kicker settings-panel-block-kicker">{t("settings.general")}</p>
          </div>

          <div className="settings-row-stack">
            <div className="settings-row settings-row-static is-language">
              <span className="settings-row-icon" aria-hidden="true">
                <LanguageGlyph />
              </span>
              <div className="settings-row-copy">
                <strong>{t("settings.language")}</strong>
                <span>{t("settings.languageDescription")}</span>
              </div>
              <div className="settings-language-picker" ref={languageMenuRef}>
                <button
                  type="button"
                  className="settings-row-action settings-language-trigger"
                  onClick={() => setLanguageMenuOpen((current) => !current)}
                  aria-expanded={languageMenuOpen}
                  aria-haspopup="menu"
                >
                  <span>{currentLanguageLabel}</span>
                  <span className="settings-row-action-icon" aria-hidden="true">
                    <ChevronGlyph expanded={languageMenuOpen} />
                  </span>
                </button>

                {languageMenuOpen ? (
                  <div className="settings-language-menu" role="menu">
                    <button
                      type="button"
                      className={`settings-language-option ${settings.language === "en" ? "is-active" : ""}`}
                      onClick={() => {
                        onLanguageChange("en");
                        setLanguageMenuOpen(false);
                      }}
                      role="menuitemradio"
                      aria-checked={settings.language === "en"}
                    >
                      <div className="settings-language-option-copy">
                        <strong>{t("settings.languageEnglish")}</strong>
                        <span>English</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      className={`settings-language-option ${settings.language === "ru" ? "is-active" : ""}`}
                      onClick={() => {
                        onLanguageChange("ru");
                        setLanguageMenuOpen(false);
                      }}
                      role="menuitemradio"
                      aria-checked={settings.language === "ru"}
                    >
                      <div className="settings-language-option-copy">
                        <strong>{t("settings.languageRussian")}</strong>
                        <span>Русский</span>
                      </div>
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <button
              type="button"
              className="settings-row settings-row-destination is-sync"
              onClick={() => setView("sync")}
            >
              <span className="settings-row-icon settings-destination-icon" aria-hidden="true">
                <SyncGlyph />
              </span>
              <div className="settings-row-copy">
                <strong>{t("settings.syncTitle")}</strong>
                <span>
                  {t("settings.syncDescription", {
                    vaultCount: localVaults.length,
                    connectionCount: syncConnections.length
                  })}
                </span>
              </div>
              <span className="settings-row-side">
                <span className="settings-row-count">{syncBindings.length}</span>
                <span className="settings-row-action-icon" aria-hidden="true">
                  <ChevronGlyph />
                </span>
              </span>
            </button>
          </div>
        </section>

        {desktopUpdatesEnabled ? (
          <section className="settings-panel-block settings-panel-block-updater">
            <div className="settings-panel-block-head">
              <p className="panel-kicker settings-panel-block-kicker">{t("settings.app")}</p>
            </div>

            <div className="settings-row-stack">
              <div className="settings-row settings-row-static settings-update-row is-update">
                <span className="settings-row-icon settings-destination-icon" aria-hidden="true">
                  <UpdateGlyph />
                </span>
                <div className="settings-row-copy settings-update-copy">
                  <strong>{t("settings.desktopUpdateTitle")}</strong>
                  <span>{desktopUpdateDescription}</span>
                  {desktopUpdateState.releaseBody ? (
                    <p className="settings-update-note">{desktopUpdateState.releaseBody}</p>
                  ) : null}
                  {desktopUpdatePublishedLabel ? (
                    <p className="settings-update-meta">
                      {t("settings.desktopUpdatePublished", {
                        date: desktopUpdatePublishedLabel
                      })}
                    </p>
                  ) : null}
                  {desktopUpdateState.phase === "failed" && desktopUpdateIssueText ? (
                    <p className="settings-update-error">{desktopUpdateIssueText}</p>
                  ) : null}
                  {desktopUpdateState.issueDetail ? (
                    <p className="settings-update-detail">
                      {t("settings.desktopUpdateDetail", {
                        detail: desktopUpdateState.issueDetail
                      })}
                    </p>
                  ) : null}
                  {desktopUpdateState.phase === "downloading" &&
                  desktopUpdateState.progress !== null ? (
                    <div
                      className="settings-update-progress"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={desktopUpdateState.progress}
                    >
                      <span
                        className="settings-update-progress-fill"
                        style={{ width: `${desktopUpdateState.progress}%` }}
                      />
                    </div>
                  ) : null}
                  <p className="settings-update-hint">{t("settings.desktopUpdateHint")}</p>
                </div>
                <div className="settings-update-side">
                  <span className="settings-row-count">
                    {t("settings.appVersionChip", {
                      version: desktopUpdateCurrentVersion ?? "—"
                    })}
                  </span>
                  <div className="settings-update-actions">
                    <button
                      type="button"
                      className="settings-row-action"
                      onClick={() => {
                        void desktopUpdatePrimaryAction();
                      }}
                      disabled={desktopUpdatePrimaryActionDisabled}
                    >
                      <span>{desktopUpdatePrimaryActionLabel}</span>
                    </button>
                    {shouldShowOpenReleaseAction ? (
                      <button
                        type="button"
                        className="settings-row-action settings-row-action-secondary"
                        onClick={() => {
                          void handleOpenDesktopReleasePage();
                        }}
                        disabled={desktopUpdatePrimaryActionDisabled}
                      >
                        <span>{t("settings.desktopUpdateOpenRelease")}</span>
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}
        </div>
    </section>
  );
}
