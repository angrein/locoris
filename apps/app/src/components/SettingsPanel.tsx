import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Update } from "@tauri-apps/plugin-updater";

import type { LocalVaultKind, LocalVaultProfile } from "../lib/localVaults";
import {
  checkForDesktopUpdate,
  getDesktopAppVersion,
  installDesktopUpdate,
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
    tokenExpiresAt?: number | null;
    userId?: string | null;
    userName?: string;
    userEmail?: string;
  }) => void;
  onDeleteConnection: (connectionId: string) => void;
  onUpdateConnection: (
    connectionId: string,
    patch: Partial<Omit<SyncConnection, "id" | "provider" | "createdAt">>
  ) => void;
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

function SettingsGlyph() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M8.2 2.5h3.6l.4 1.8a5.8 5.8 0 0 1 1.3.6l1.7-.8 2.6 2.6-.8 1.7c.24.42.45.86.6 1.33l1.8.4v3.6l-1.8.4a5.9 5.9 0 0 1-.6 1.3l.8 1.7-2.6 2.6-1.7-.8a5.8 5.8 0 0 1-1.33.6l-.4 1.8H8.2l-.4-1.8a5.8 5.8 0 0 1-1.3-.6l-1.7.8-2.6-2.6.8-1.7a5.8 5.8 0 0 1-.6-1.3l-1.8-.4v-3.6l1.8-.4a6.2 6.2 0 0 1 .6-1.33l-.8-1.7 2.6-2.6 1.7.8c.42-.24.86-.45 1.3-.6l.4-1.8Z" />
      <circle cx="10" cy="10" r="2.6" className="settings-row-icon-core" />
    </svg>
  );
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

type DesktopUpdateViewState = {
  phase: "idle" | "checking" | "upToDate" | "available" | "downloading" | "error";
  nextVersion: string | null;
  body: string | null;
  progress: number | null;
  update: Update | null;
  errorMessage: string | null;
};

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
  const [desktopAppVersion, setDesktopAppVersion] = useState<string | null>(null);
  const [desktopUpdateState, setDesktopUpdateState] = useState<DesktopUpdateViewState>({
    phase: "idle",
    nextVersion: null,
    body: null,
    progress: null,
    update: null,
    errorMessage: null
  });
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

    let cancelled = false;

    void getDesktopAppVersion()
      .then((version) => {
        if (!cancelled) {
          setDesktopAppVersion(version);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDesktopAppVersion(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [desktopUpdatesEnabled]);

  const handleCheckDesktopUpdates = async () => {
    setDesktopUpdateState((current) => ({
      ...current,
      phase: "checking",
      errorMessage: null,
      progress: null
    }));

    try {
      const result = await checkForDesktopUpdate();

      if (result.status === "unsupported") {
        setDesktopUpdateState({
          phase: "error",
          nextVersion: null,
          body: null,
          progress: null,
          update: null,
          errorMessage: t("settings.desktopUpdateUnsupported")
        });
        return;
      }

      setDesktopAppVersion(result.currentVersion);

      if (result.status === "up-to-date") {
        setDesktopUpdateState({
          phase: "upToDate",
          nextVersion: null,
          body: null,
          progress: null,
          update: null,
          errorMessage: null
        });
        return;
      }

      setDesktopUpdateState({
        phase: "available",
        nextVersion: result.nextVersion,
        body: result.body,
        progress: null,
        update: result.update,
        errorMessage: null
      });
    } catch (error) {
      setDesktopUpdateState({
        phase: "error",
        nextVersion: null,
        body: null,
        progress: null,
        update: null,
        errorMessage: error instanceof Error ? error.message : null
      });
    }
  };

  const handleInstallDesktopUpdate = async () => {
    const update = desktopUpdateState.update;

    if (!update) {
      return;
    }

    let totalBytes = 0;
    let downloadedBytes = 0;

    setDesktopUpdateState((current) => ({
      ...current,
      phase: "downloading",
      progress: 0,
      errorMessage: null
    }));

    try {
      await installDesktopUpdate(update, (event) => {
        if (event.event === "Started") {
          totalBytes = event.data.contentLength ?? 0;
          downloadedBytes = 0;
          setDesktopUpdateState((current) => ({
            ...current,
            phase: "downloading",
            progress: totalBytes > 0 ? 0 : null
          }));
          return;
        }

        if (event.event === "Progress") {
          downloadedBytes += event.data.chunkLength;
          setDesktopUpdateState((current) => ({
            ...current,
            phase: "downloading",
            progress:
              totalBytes > 0 ? Math.max(0, Math.min(100, Math.round((downloadedBytes / totalBytes) * 100))) : null
          }));
          return;
        }

        setDesktopUpdateState((current) => ({
          ...current,
          phase: "downloading",
          progress: 100
        }));
      });
    } catch (error) {
      setDesktopUpdateState((current) => ({
        ...current,
        phase: "error",
        progress: null,
        errorMessage: error instanceof Error ? error.message : null
      }));
    }
  };

  const desktopUpdateDescription =
    desktopUpdateState.phase === "checking"
      ? t("settings.desktopUpdateChecking")
      : desktopUpdateState.phase === "upToDate"
      ? t("settings.desktopUpdateUpToDate", { version: desktopAppVersion ?? "—" })
      : desktopUpdateState.phase === "available"
      ? t("settings.desktopUpdateAvailable", { version: desktopUpdateState.nextVersion ?? "—" })
      : desktopUpdateState.phase === "downloading"
      ? t("settings.desktopUpdateDownloading", {
          progress:
            desktopUpdateState.progress === null ? "" : ` ${desktopUpdateState.progress}%`
        })
      : desktopUpdateState.phase === "error"
      ? desktopUpdateState.errorMessage || t("settings.desktopUpdateError")
      : desktopAppVersion
      ? t("settings.desktopUpdateCurrent", { version: desktopAppVersion })
      : t("settings.desktopUpdateCurrentUnknown");

  const desktopUpdateActionLabel =
    desktopUpdateState.phase === "checking"
      ? t("settings.desktopUpdateCheckingAction")
      : desktopUpdateState.phase === "available"
      ? t("settings.desktopUpdateInstall")
      : desktopUpdateState.phase === "downloading"
      ? t("settings.desktopUpdateInstalling")
      : t("settings.desktopUpdateCheck");

  const desktopUpdateAction =
    desktopUpdateState.phase === "available" ? handleInstallDesktopUpdate : handleCheckDesktopUpdates;

  const desktopUpdateActionDisabled =
    desktopUpdateState.phase === "checking" || desktopUpdateState.phase === "downloading";

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
        <span className={`status-chip ${online ? "online" : "offline"}`}>
          {online ? t("settings.networkOnline") : t("settings.networkOffline")}
        </span>
      </header>

      <div className="settings-panel-block">
        <div className="settings-panel-block-head">
          <p className="panel-kicker settings-panel-block-kicker">{t("settings.general")}</p>
        </div>

        <div className="settings-row-stack">
          <div className="settings-row settings-row-static">
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
                className="settings-row-action"
                onClick={() => setLanguageMenuOpen((current) => !current)}
                aria-expanded={languageMenuOpen}
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
                    <strong>{t("settings.languageEnglish")}</strong>
                    <span>English</span>
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
                    <strong>{t("settings.languageRussian")}</strong>
                    <span>Русский</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <button type="button" className="settings-row" onClick={() => setView("sync")}>
            <span className="settings-row-icon" aria-hidden="true">
              <SyncGlyph />
            </span>
            <div className="settings-row-copy">
              <strong>{t("settings.syncTitle")}</strong>
              <span>{t("settings.syncDescription", { vaultCount: localVaults.length, connectionCount: syncConnections.length })}</span>
            </div>
            <span className="settings-row-side">
              <span className="settings-row-count">{syncBindings.length}</span>
              <span className="settings-row-action-icon" aria-hidden="true">
                <ChevronGlyph />
              </span>
            </span>
          </button>
        </div>
      </div>

      {desktopUpdatesEnabled ? (
        <div className="settings-panel-block">
          <div className="settings-panel-block-head">
            <p className="panel-kicker settings-panel-block-kicker">{t("settings.app")}</p>
          </div>

          <div className="settings-row-stack">
            <div className="settings-row settings-row-static settings-update-row">
              <span className="settings-row-icon" aria-hidden="true">
                <UpdateGlyph />
              </span>
              <div className="settings-row-copy settings-update-copy">
                <strong>{t("settings.desktopUpdateTitle")}</strong>
                <span>{desktopUpdateDescription}</span>
                {desktopUpdateState.body ? <p className="settings-update-note">{desktopUpdateState.body}</p> : null}
                <p className="settings-update-hint">{t("settings.desktopUpdateHint")}</p>
              </div>
              <div className="settings-update-side">
                <span className="settings-row-count">
                  {t("settings.appVersionChip", { version: desktopAppVersion ?? "—" })}
                </span>
                <button
                  type="button"
                  className="settings-row-action"
                  onClick={() => {
                    void desktopUpdateAction();
                  }}
                  disabled={desktopUpdateActionDisabled}
                >
                  <span>{desktopUpdateActionLabel}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="settings-panel-footnote">
        <span className="settings-panel-footnote-icon" aria-hidden="true">
          <SettingsGlyph />
        </span>
        <p>{t("settings.footnote")}</p>
      </div>
    </section>
  );
}
