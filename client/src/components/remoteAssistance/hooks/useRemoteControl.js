import { useCallback, useEffect, useRef, useState } from "react";
import { sendRemoteAssistanceInput, updateRemoteAssistanceControl } from "../../../api.js";
import { MOUSE_MOVE_MIN_INTERVAL_MS, isForwardableKey, mouseButtonName, normalizeKey, pointerPosition } from "../utils/input.js";
import { isControlActive } from "../utils/viewState.js";

// Controle remoto: liberar/solicitar controle, travar entrada local e
// encaminhar mouse/teclado a partir da area da tela remota.
export function useRemoteControl({
  frontendControlEnabled,
  session,
  requestedMode,
  token,
  viewerToken,
  setSession,
  setError,
  perform,
  screenRef
}) {
  const [keyboardLocked, setKeyboardLocked] = useState(false);
  const lastMouseMoveRef = useRef(0);
  const controlActive = isControlActive({ frontendControlEnabled, session, requestedMode });

  useEffect(() => {
    if (!controlActive) setKeyboardLocked(false);
  }, [controlActive]);

  const sendInput = useCallback(
    (command) => {
      if (!controlActive) return;
      sendRemoteAssistanceInput({ token, sessionId: session.id, viewerToken, command }).catch((inputError) => {
        setError(inputError.message);
      });
    },
    [controlActive, session?.id, setError, token, viewerToken]
  );

  const toggleControl = useCallback(async () => {
    if (!frontendControlEnabled) return;
    await perform(async () => {
      const result = await updateRemoteAssistanceControl({
        token,
        sessionId: session.id,
        viewerToken,
        enabled: !session.remoteControlEnabled
      });
      setSession(result.session);
      if (!result.session.remoteControlEnabled) screenRef.current?.blur();
    });
  }, [frontendControlEnabled, perform, screenRef, session, setSession, token, viewerToken]);

  const toggleKeyboardLock = useCallback(() => {
    if (!controlActive) return;
    const next = !keyboardLocked;
    setKeyboardLocked(next);
    sendInput({ type: "block_input", enabled: next });
  }, [controlActive, keyboardLocked, sendInput]);

  const screenHandlers = {
    onMouseMove(event) {
      const now = performance.now();
      if (now - lastMouseMoveRef.current < MOUSE_MOVE_MIN_INTERVAL_MS) return;
      lastMouseMoveRef.current = now;
      sendInput({
        type: "mouse_move",
        ...pointerPosition(event.currentTarget.getBoundingClientRect(), event.clientX, event.clientY)
      });
    },
    onMouseDown: (event) => handleMouseButton(event, "down"),
    onMouseUp: (event) => handleMouseButton(event, "up"),
    onWheel(event) {
      if (!controlActive) return;
      event.preventDefault();
      sendInput({ type: "mouse_wheel", delta: event.deltaY });
    },
    onContextMenu(event) {
      if (controlActive) event.preventDefault();
    },
    onKeyDown: (event) => handleKey(event, "down"),
    onKeyUp: (event) => handleKey(event, "up")
  };

  function handleMouseButton(event, action) {
    if (!controlActive) return;
    event.preventDefault();
    sendInput({
      type: "mouse_move",
      ...pointerPosition(event.currentTarget.getBoundingClientRect(), event.clientX, event.clientY)
    });
    sendInput({ type: "mouse_button", button: mouseButtonName(event.button), action });
  }

  function handleKey(event, action) {
    if (!controlActive) return;
    const key = normalizeKey(event.key);
    if (isForwardableKey(key)) {
      event.preventDefault();
      sendInput({ type: "key", key, action });
    }
  }

  const reset = useCallback(() => setKeyboardLocked(false), []);

  return { controlActive, keyboardLocked, toggleControl, toggleKeyboardLock, screenHandlers, reset };
}
