/**
 * Troca ON DELETE CASCADE por ON DELETE RESTRICT nas duas chaves estrangeiras
 * que ligam a auditoria da assistencia remota a linhas que podem, no futuro,
 * ganhar um caminho de exclusao real (ativo, sessao). Hoje nenhuma rota
 * apaga essas linhas de verdade -- a unica remocao de ativo e soft-delete --
 * mas o CASCADE deixava aberto que uma feature futura de "excluir ativo
 * definitivamente" apagasse silenciosamente todo o historico de assistencia
 * remota junto, exatamente a trilha que precisa sobreviver ao ativo para
 * investigacao.
 *
 * O nome da constraint e descoberto dinamicamente via information_schema em
 * vez de assumido pela convencao padrao (`<tabela>_<coluna>_fkey`), para nao
 * quebrar silenciosamente se o nome real divergir por qualquer motivo.
 */
async function replaceForeignKeyDeleteAction(db, {
  table,
  column,
  referencedTable,
  referencedColumn,
  newAction
}) {
  const existing = await db(
    `
      SELECT tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = 'public'
        AND tc.table_name = $1
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = $2
    `,
    [table, column]
  );

  for (const row of existing.rows) {
    await db(`ALTER TABLE ${table} DROP CONSTRAINT ${row.constraint_name}`);
  }

  await db(`
    ALTER TABLE ${table}
    ADD CONSTRAINT ${table}_${column}_fkey
    FOREIGN KEY (${column}) REFERENCES ${referencedTable}(${referencedColumn})
    ON DELETE ${newAction}
  `);
}

export const migration013RemoteAssistanceAuditIntegrity = {
  id: "013-remote-assistance-audit-integrity",
  async up(db) {
    await replaceForeignKeyDeleteAction(db, {
      table: "remote_assistance_sessions",
      column: "asset_id",
      referencedTable: "agent_assets",
      referencedColumn: "asset_id",
      newAction: "RESTRICT"
    });
    await replaceForeignKeyDeleteAction(db, {
      table: "remote_assistance_events",
      column: "session_id",
      referencedTable: "remote_assistance_sessions",
      referencedColumn: "id",
      newAction: "RESTRICT"
    });
  }
};
