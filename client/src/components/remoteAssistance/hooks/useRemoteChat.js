import { useCallback, useEffect, useRef, useState } from "react";
import { sendRemoteAssistanceChatMessage } from "../../../api.js";

// Chat tecnico <-> usuario local. As mensagens do usuario chegam junto dos
// quadros (replaceMessages); as do tecnico sao acrescentadas ao enviar.
export function useRemoteChat({ token, session, viewerToken, setError }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [open, setOpen] = useState(true);
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages]);

  const send = useCallback(
    async (event) => {
      event.preventDefault();
      const text = draft.trim();
      if (!text || sending) return;
      setSending(true);
      try {
        const result = await sendRemoteAssistanceChatMessage({ token, sessionId: session.id, viewerToken, text });
        setDraft("");
        if (result.message) {
          setMessages((previous) => (previous.some((item) => item.id === result.message.id) ? previous : [...previous, result.message]));
        }
      } catch (chatError) {
        setError(chatError.message);
      } finally {
        setSending(false);
      }
    },
    [draft, sending, session?.id, setError, token, viewerToken]
  );

  const toggle = useCallback(() => setOpen((value) => !value), []);

  const reset = useCallback(() => {
    setMessages([]);
    setDraft("");
    setOpen(true);
  }, []);

  return { messages, replaceMessages: setMessages, draft, setDraft, sending, open, toggle, logRef, send, reset };
}
