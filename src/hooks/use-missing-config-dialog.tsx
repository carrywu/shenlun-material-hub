"use client";

import { useState, useCallback } from "react";
import { MissingConfigDialog } from "@/components/ui/missing-config-dialog";

type ConfigType = "ai" | "weweRss" | "role";

interface DialogState {
  open: boolean;
  configType: ConfigType;
}

/**
 * Hook to manage MissingConfigDialog state.
 * Returns the dialog element and functions to show each type.
 *
 * Usage:
 * ```tsx
 * const { dialogElement, showAiDialog, showWeweRssDialog, showRoleDialog } = useMissingConfigDialog();
 * return (
 *   <>
 *     {dialogElement}
 *     <button onClick={showAiDialog}>Test</button>
 *   </>
 * );
 * ```
 */
export function useMissingConfigDialog() {
  const [state, setState] = useState<DialogState>({
    open: false,
    configType: "ai",
  });

  const showDialog = useCallback((configType: ConfigType) => {
    setState({ open: true, configType });
  }, []);

  const hideDialog = useCallback(() => {
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  const dialogElement = (
    <MissingConfigDialog
      open={state.open}
      onOpenChange={hideDialog}
      configType={state.configType}
    />
  );

  return {
    dialogElement,
    showDialog,
    showAiDialog: useCallback(() => showDialog("ai"), [showDialog]),
    showWeweRssDialog: useCallback(() => showDialog("weweRss"), [showDialog]),
    showRoleDialog: useCallback(() => showDialog("role"), [showDialog]),
    hideDialog,
  };
}
