export const migration034RustdeskTransport = {
  id: "034-rustdesk-transport",
  async up(db) {
    // So o identificador do dispositivo (publico por natureza no protocolo
    // RustDesk, como um numero de telefone) fica no banco. A senha de sessao
    // nunca e persistida aqui -- mora apenas no relay efemero, junto do frame
    // e do chat de assistencia remota (ver server/src/services/remoteAssistanceRelay.js).
    await db(`
      ALTER TABLE agent_assets
      ADD COLUMN IF NOT EXISTS rustdesk_id TEXT,
      ADD COLUMN IF NOT EXISTS rustdesk_id_updated_at TIMESTAMPTZ;
    `);
  }
};
