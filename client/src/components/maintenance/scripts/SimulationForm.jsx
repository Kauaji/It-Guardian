import { useState } from "react";
import { ClipboardCheck } from "lucide-react";

export default function SimulationForm({ script, devices, serviceOrders, alerts, onRegister }) {
  const [assetId, setAssetId] = useState("");
  const [serviceOrderId, setServiceOrderId] = useState("");
  const [alertId, setAlertId] = useState("");
  const [mode, setMode] = useState("simulated");
  const [notes, setNotes] = useState("");
  const highRisk = script.riskLevel === "high" || script.riskLevel === "critical";

  async function handleSubmit(event) {
    event.preventDefault();
    const baseConfirmation =
      "Esta ação apenas registrará uma simulação/intenção de execução. Nenhum comando será executado na máquina ou no servidor.";

    if (!window.confirm(baseConfirmation)) return;

    if (highRisk) {
      const riskConfirmation =
        "Este script foi marcado como alto risco. A execução real não está disponível nesta versão. Deseja apenas registrar a simulação?";
      if (!window.confirm(riskConfirmation)) return;
    }

    try {
      await onRegister(script.id, {
        assetId,
        serviceOrderId,
        alertId,
        mode,
        notes,
        confirmed: true,
        riskAcknowledged: highRisk
      });

      setNotes("");
    } catch {
      // A mensagem amigável já é exibida pelo App.
    }
  }

  return (
    <form className="script-simulation-form" onSubmit={handleSubmit}>
      <label>
        Máquina
        <select value={assetId} onChange={(event) => setAssetId(event.target.value)}>
          <option value="">Sem máquina vinculada</option>
          {devices.map((device) => (
            <option key={device.id} value={device.id}>
              {device.name} - {device.ip || "sem IP"}
            </option>
          ))}
        </select>
      </label>
      <label>
        Ordem de Serviço
        <select value={serviceOrderId} onChange={(event) => setServiceOrderId(event.target.value)}>
          <option value="">Sem OS vinculada</option>
          {serviceOrders.map((order) => (
            <option key={order.id} value={order.id}>
              {order.number} - {order.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        Aviso
        <select value={alertId} onChange={(event) => setAlertId(event.target.value)}>
          <option value="">Sem aviso vinculado</option>
          {alerts.map((alert) => (
            <option key={alert.id} value={alert.id}>
              {alert.title} - {alert.hostName || "sem máquina"}
            </option>
          ))}
        </select>
      </label>
      <label>
        Modo
        <select value={mode} onChange={(event) => setMode(event.target.value)}>
          <option value="simulated">Simulado</option>
          <option value="prepared">Preparado</option>
        </select>
      </label>
      <label className="script-simulation-notes">
        Observação
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Contexto do registro. Nenhum comando será executado."
          rows={3}
        />
      </label>
      <button type="submit" className="primary-action compact-action">
        <ClipboardCheck size={16} />
        Registrar simulação
      </button>
    </form>
  );
}
