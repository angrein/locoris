import type { CSSProperties } from "react";

import LocalVaultSwitcher, { type LocalVaultSwitcherItem } from "../LocalVaultSwitcher";
import type { LocalVaultKind } from "../../lib/localVaults";
import "./OrbitalCommandBar.css";

type OrbitalSurfaceMode = "map" | "planner";
type CommandChipTone = "default" | "success" | "warning" | "error";
type CommandIconKind =
  | "map"
  | "planner"
  | "play"
  | "pause"
  | "plan"
  | "trash"
  | "settings"
  | "zoom-in"
  | "zoom-out"
  | "center"
  | "reset"
  | "close"
  | "sync"
  | "focus"
  | "autofocus"
  | "update";

interface CommandChip {
  tone: CommandChipTone;
  text: string;
  title?: string;
}

interface OrbitalCommandBarLabels {
  title: string;
  subtitle: string;
  close: string;
  mapMode: string;
  plannerMode: string;
  pause: string;
  resume: string;
  zoomIn: string;
  zoomOut: string;
  resetView: string;
  centerSelection: string;
  focusMode: string;
  autoFocus: string;
  settings: string;
  trash: string;
  localVault: string;
}

interface OrbitalCommandBarProps {
  labels: OrbitalCommandBarLabels;
  surfaceMode: OrbitalSurfaceMode;
  plannerAvailable: boolean;
  activeVaultLabel: string;
  localVaultOptions: LocalVaultSwitcherItem[];
  activeLocalVaultId: string;
  autoFocusEnabled: boolean;
  sceneFocusActive: boolean;
  syncStatusChip?: CommandChip;
  syncTransportChip?: CommandChip | null;
  updateChip?: {
    text: string;
    title?: string;
  } | null;
  isOrbitalMotionEnabled: boolean;
  isPaused: boolean;
  temporalSignalsEnabled: boolean;
  temporalLayerVisible: boolean;
  temporalLayerLabel: string;
  temporalLayerShowLabel: string;
  temporalLayerHideLabel: string;
  hasTrash: boolean;
  hasSettings: boolean;
  showClose: boolean;
  onSurfaceModeChange: (mode: OrbitalSurfaceMode) => void;
  onSelectLocalVault: (localVaultId: string) => void;
  onCreateLocalVault?: (input: {
    name: string;
    vaultKind: LocalVaultKind;
    passphrase?: string;
  }) => string | void | Promise<string | void>;
  onToggleMotion: () => void;
  onToggleTemporalLayer: () => void;
  onOpenTrash: () => void;
  onOpenSettings: () => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onCenterSelection: () => void;
  onResetView: () => void;
  onClose: () => void;
}

function CommandIcon({ kind }: { kind: CommandIconKind }) {
  return <span className={`orbital-command-icon is-${kind}`} aria-hidden="true" />;
}

function CommandIconButton({
  icon,
  label,
  active = false,
  danger = false,
  disabled = false,
  onClick
}: {
  icon: CommandIconKind;
  label: string;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`orbital-command-button orbital-command-icon-button ${active ? "is-active" : ""} ${
        danger ? "is-danger" : ""
      }`}
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active || undefined}
      disabled={disabled}
    >
      <CommandIcon kind={icon} />
    </button>
  );
}

function StatusChip({
  icon,
  text,
  title,
  tone = "default",
  asButton = false,
  onClick
}: {
  icon: CommandIconKind;
  text: string;
  title?: string;
  tone?: CommandChipTone | "accent";
  asButton?: boolean;
  onClick?: () => void;
}) {
  const className = `orbital-command-status-chip is-${tone}`;
  const content = (
    <>
      <CommandIcon kind={icon} />
      <span className="orbital-command-status-text">{text}</span>
    </>
  );

  if (asButton && onClick) {
    return (
      <button type="button" className={className} title={title ?? text} onClick={onClick}>
        {content}
      </button>
    );
  }

  return (
    <span className={className} title={title ?? text}>
      {content}
    </span>
  );
}

export default function OrbitalCommandBar({
  labels,
  surfaceMode,
  plannerAvailable,
  activeVaultLabel,
  localVaultOptions,
  activeLocalVaultId,
  autoFocusEnabled,
  sceneFocusActive,
  syncStatusChip,
  syncTransportChip,
  updateChip,
  isOrbitalMotionEnabled,
  isPaused,
  temporalSignalsEnabled,
  temporalLayerVisible,
  temporalLayerLabel,
  temporalLayerShowLabel,
  temporalLayerHideLabel,
  hasTrash,
  hasSettings,
  showClose,
  onSurfaceModeChange,
  onSelectLocalVault,
  onCreateLocalVault,
  onToggleMotion,
  onToggleTemporalLayer,
  onOpenTrash,
  onOpenSettings,
  onZoomOut,
  onZoomIn,
  onCenterSelection,
  onResetView,
  onClose
}: OrbitalCommandBarProps) {
  const motionLabel = !isOrbitalMotionEnabled || isPaused ? labels.resume : labels.pause;
  const motionIcon: CommandIconKind = !isOrbitalMotionEnabled || isPaused ? "play" : "pause";
  const temporalLabel = temporalLayerVisible ? temporalLayerHideLabel : temporalLayerShowLabel;
  const hasStatus =
    autoFocusEnabled ||
    sceneFocusActive ||
    Boolean(syncStatusChip) ||
    Boolean(syncTransportChip) ||
    Boolean(updateChip);

  return (
    <header className="orbital-command-bar" style={{ "--orbital-command-actions": surfaceMode === "map" ? 8 : 4 } as CSSProperties}>
      <div className="orbital-command-brand-panel">
        <span className="orbital-command-brand-mark" aria-hidden="true">
          <span />
        </span>
        <div className="orbital-command-title">
          <h1 className="orbital-command-brand">{labels.title}</h1>
          <p className="orbital-command-subtitle">{labels.subtitle}</p>
        </div>
      </div>

      {plannerAvailable ? (
        <div className="orbital-surface-switch" role="tablist" aria-label={labels.title}>
          <button
            type="button"
            className={surfaceMode === "map" ? "is-active" : ""}
            onClick={() => onSurfaceModeChange("map")}
            aria-selected={surfaceMode === "map"}
            role="tab"
          >
            <CommandIcon kind="map" />
            <span>{labels.mapMode}</span>
          </button>
          <button
            type="button"
            className={surfaceMode === "planner" ? "is-active" : ""}
            onClick={() => onSurfaceModeChange("planner")}
            aria-selected={surfaceMode === "planner"}
            role="tab"
          >
            <CommandIcon kind="planner" />
            <span>{labels.plannerMode}</span>
          </button>
        </div>
      ) : null}

      <div className="orbital-command-vault">
        <LocalVaultSwitcher
          label={labels.localVault}
          activeLabel={activeVaultLabel}
          items={localVaultOptions}
          activeVaultId={activeLocalVaultId}
          onSelect={onSelectLocalVault}
          onCreate={onCreateLocalVault}
        />
      </div>

      {hasStatus ? (
        <div className="orbital-command-status" aria-label={labels.title}>
          {autoFocusEnabled ? <StatusChip icon="autofocus" text={labels.autoFocus} tone="accent" /> : null}
          {sceneFocusActive ? <StatusChip icon="focus" text={labels.focusMode} tone="accent" /> : null}
          {syncStatusChip ? (
            <StatusChip icon="sync" text={syncStatusChip.text} title={syncStatusChip.title} tone={syncStatusChip.tone} />
          ) : null}
          {syncTransportChip ? (
            <StatusChip
              icon="sync"
              text={syncTransportChip.text}
              title={syncTransportChip.title}
              tone={syncTransportChip.tone}
            />
          ) : null}
          {updateChip && hasSettings ? (
            <StatusChip
              icon="update"
              text={updateChip.text}
              title={updateChip.title}
              tone="warning"
              asButton
              onClick={onOpenSettings}
            />
          ) : null}
        </div>
      ) : null}

      <div className="orbital-command-actions" aria-label={labels.title}>
        {surfaceMode === "map" ? (
          <div className="orbital-command-group" aria-label={labels.mapMode}>
            <CommandIconButton icon={motionIcon} label={motionLabel} onClick={onToggleMotion} active={isOrbitalMotionEnabled && !isPaused} />
            {temporalSignalsEnabled ? (
              <CommandIconButton
                icon="plan"
                label={temporalLabel || temporalLayerLabel}
                onClick={onToggleTemporalLayer}
                active={temporalLayerVisible}
              />
            ) : null}
            <CommandIconButton icon="zoom-out" label={labels.zoomOut} onClick={onZoomOut} />
            <CommandIconButton icon="zoom-in" label={labels.zoomIn} onClick={onZoomIn} />
            <CommandIconButton icon="center" label={labels.centerSelection} onClick={onCenterSelection} />
            <CommandIconButton icon="reset" label={labels.resetView} onClick={onResetView} />
          </div>
        ) : null}

        {(hasTrash || hasSettings) && (
          <div className="orbital-command-group" aria-label={labels.settings}>
            {hasTrash ? <CommandIconButton icon="trash" label={labels.trash} onClick={onOpenTrash} danger /> : null}
            {hasSettings ? <CommandIconButton icon="settings" label={labels.settings} onClick={onOpenSettings} /> : null}
          </div>
        )}

        {showClose ? (
          <CommandIconButton icon="close" label={labels.close} onClick={onClose} danger />
        ) : null}
      </div>
    </header>
  );
}
