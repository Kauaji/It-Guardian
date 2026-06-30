import { useCallback, useState } from "react";

export default function useUnsavedChanges(isDirty) {
  const [pendingAction, setPendingAction] = useState(null);

  const requestAction = useCallback((action) => {
    if (!isDirty) {
      action();
      return true;
    }

    setPendingAction(() => action);
    return false;
  }, [isDirty]);

  const continueEditing = useCallback(() => {
    setPendingAction(null);
  }, []);

  const discardChanges = useCallback(() => {
    const action = pendingAction;
    setPendingAction(null);
    action?.();
  }, [pendingAction]);

  return {
    confirmationOpen: Boolean(pendingAction),
    requestAction,
    continueEditing,
    discardChanges
  };
}

