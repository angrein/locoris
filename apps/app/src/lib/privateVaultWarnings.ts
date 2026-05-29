import type { LocalVaultKind } from "./localVaults";
import {
  readPersistentString,
  writePersistentString
} from "./persistentClientStorage";

export type PrivateVaultWarningKind = "ai" | "export" | "backupExact" | "backupReadable";

export interface PrivateVaultWarningContext {
  localVaultId: string;
  vaultKind: LocalVaultKind;
  vaultName: string;
}

const PRIVATE_VAULT_WARNING_STORAGE_KEY = "zen:private-vault-warnings:v1";

function readAcknowledgements() {
  const raw = readPersistentString(PRIVATE_VAULT_WARNING_STORAGE_KEY);

  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);

    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, boolean>)
      : {};
  } catch {
    return {};
  }
}

function writeAcknowledgements(value: Record<string, boolean>) {
  writePersistentString(PRIVATE_VAULT_WARNING_STORAGE_KEY, JSON.stringify(value));
}

function buildAcknowledgementKey(localVaultId: string, kind: PrivateVaultWarningKind) {
  return `${localVaultId}:${kind}`;
}

export function shouldRequestPrivateVaultWarning(
  kind: PrivateVaultWarningKind,
  context: PrivateVaultWarningContext | null | undefined
) {
  if (!context || context.vaultKind !== "private" || !context.localVaultId) {
    return false;
  }

  return readAcknowledgements()[buildAcknowledgementKey(context.localVaultId, kind)] !== true;
}

export function acknowledgePrivateVaultWarning(
  kind: PrivateVaultWarningKind,
  context: PrivateVaultWarningContext
) {
  if (context.vaultKind !== "private" || !context.localVaultId) {
    return;
  }

  const acknowledgements = readAcknowledgements();
  acknowledgements[buildAcknowledgementKey(context.localVaultId, kind)] = true;
  writeAcknowledgements(acknowledgements);
}
