import { useCallback, useState } from "react";
import { reauthenticateRemoteAssistance } from "../../../api.js";

// Formulario de pedido (motivo, modo, senha) e reautenticacao do tecnico.
// A senha vive so no estado do React e e zerada assim que o pedido termina.
export function useRemoteReauth({ token, asset, serviceOrder }) {
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");
  const [requestedMode, setRequestedMode] = useState("view");

  // Troca a senha por um token de reautenticacao de uso unico.
  const reauthenticate = useCallback(async () => {
    const confirmation = await reauthenticateRemoteAssistance({
      token,
      password,
      assetId: asset.id,
      serviceOrderId: serviceOrder?.id
    });
    return confirmation.token;
  }, [asset?.id, password, serviceOrder?.id, token]);

  const clearPassword = useCallback(() => setPassword(""), []);

  const reset = useCallback(() => {
    setReason("");
    setPassword("");
    setRequestedMode("view");
  }, []);

  return {
    reason,
    setReason,
    password,
    setPassword,
    requestedMode,
    setRequestedMode,
    reauthenticate,
    clearPassword,
    reset
  };
}
