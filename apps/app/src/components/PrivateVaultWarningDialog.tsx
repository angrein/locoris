import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  acknowledgePrivateVaultWarning,
  shouldRequestPrivateVaultWarning,
  type PrivateVaultWarningContext,
  type PrivateVaultWarningKind
} from "../lib/privateVaultWarnings";
import ConfirmDialog from "./ConfirmDialog";

type PendingPrivateVaultWarning = {
  kind: PrivateVaultWarningKind;
  context: PrivateVaultWarningContext;
  resolve: (confirmed: boolean) => void;
};

type ConfirmPrivateVaultActionOptions = {
  context?: PrivateVaultWarningContext | null;
};

export function usePrivateVaultWarning(defaultContext?: PrivateVaultWarningContext | null) {
  const { t } = useTranslation();
  const [pendingWarning, setPendingWarning] = useState<PendingPrivateVaultWarning | null>(null);
  const pendingWarningRef = useRef<PendingPrivateVaultWarning | null>(null);

  const confirmPrivateVaultAction = useCallback(
    (kind: PrivateVaultWarningKind, options?: ConfirmPrivateVaultActionOptions) => {
      const context = options?.context ?? defaultContext ?? null;

      if (!context || !shouldRequestPrivateVaultWarning(kind, context)) {
        return Promise.resolve(true);
      }

      if (pendingWarningRef.current) {
        pendingWarningRef.current.resolve(false);
      }

      return new Promise<boolean>((resolve) => {
        const nextWarning = {
          kind,
          context,
          resolve
        } satisfies PendingPrivateVaultWarning;

        pendingWarningRef.current = nextWarning;
        setPendingWarning(nextWarning);
      });
    },
    [defaultContext]
  );

  const closePrivateVaultWarning = useCallback((confirmed: boolean, remember: boolean) => {
    const warning = pendingWarningRef.current;

    pendingWarningRef.current = null;
    setPendingWarning(null);

    if (!warning) {
      return;
    }

    if (confirmed && remember) {
      acknowledgePrivateVaultWarning(warning.kind, warning.context);
    }

    warning.resolve(confirmed);
  }, []);

  useEffect(
    () => () => {
      if (pendingWarningRef.current) {
        pendingWarningRef.current.resolve(false);
        pendingWarningRef.current = null;
      }
    },
    []
  );

  const privateVaultWarningDialog = pendingWarning ? (
    <ConfirmDialog
      open
      kicker={t("privateVaultWarning.kicker")}
      title={t(`privateVaultWarning.${pendingWarning.kind}.title`, {
        vault: pendingWarning.context.vaultName
      })}
      message={t(`privateVaultWarning.${pendingWarning.kind}.message`, {
        vault: pendingWarning.context.vaultName
      })}
      details={[
        t(`privateVaultWarning.${pendingWarning.kind}.detailPrimary`),
        t(`privateVaultWarning.${pendingWarning.kind}.detailSecondary`)
      ]}
      confirmLabel={t(`privateVaultWarning.${pendingWarning.kind}.confirmLabel`)}
      cancelLabel={t("dialog.cancel")}
      secondaryLabel={t("privateVaultWarning.continueOnce")}
      secondaryTone="default"
      tone="default"
      onCancel={() => closePrivateVaultWarning(false, false)}
      onSecondary={() => closePrivateVaultWarning(true, false)}
      onConfirm={() => closePrivateVaultWarning(true, true)}
    />
  ) : null;

  return {
    confirmPrivateVaultAction,
    privateVaultWarningDialog
  };
}

export type { PrivateVaultWarningContext };
