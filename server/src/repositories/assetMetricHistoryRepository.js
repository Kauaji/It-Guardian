import { randomUUID } from "node:crypto";
import { query } from "../database.js";

/**
 * `db` injetavel para rodar dentro da mesma transacao do heartbeat
 * (`agentRepository.js`'s `recordAgentInventory`) - mesmo padrao de
 * `addAssetHistory` em assetHistoryRepository.js.
 */
export async function insertAssetMetricSample({
  assetId,
  source = "agent",
  cpuUsagePercent = null,
  memoryUsagePercent = null,
  memoryUsedBytes = null,
  memoryTotalBytes = null,
  diskUsagePercent = null,
  diskUsedBytes = null,
  diskTotalBytes = null,
  collectedAt,
  db = query
}) {
  await db(
    `
      INSERT INTO asset_metric_history (
        id, asset_id, source, cpu_usage_percent, memory_usage_percent,
        memory_used_bytes, memory_total_bytes, disk_usage_percent,
        disk_used_bytes, disk_total_bytes, collected_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `,
    [
      randomUUID(),
      assetId,
      source,
      cpuUsagePercent,
      memoryUsagePercent,
      memoryUsedBytes,
      memoryTotalBytes,
      diskUsagePercent,
      diskUsedBytes,
      diskTotalBytes,
      collectedAt
    ]
  );
}

function fromRow(row) {
  return {
    collectedAt: row.collected_at,
    cpuUsagePercent: row.cpu_usage_percent,
    memoryUsagePercent: row.memory_usage_percent,
    diskUsagePercent: row.disk_usage_percent
  };
}

/**
 * Uma unica consulta indexada (asset_id, collected_at >= since), sem
 * date_trunc/width_bucket/LEFT() - nao verificados contra o pg-mem usado
 * nos testes. Agrupamento/downsampling fica todo em JS puro
 * (assetMetricHistoryService.js's bucketSamples), nao aqui.
 */
export async function listAssetMetricSamples({ assetId, since, limit }) {
  const result = await query(
    `
      SELECT collected_at, cpu_usage_percent, memory_usage_percent, disk_usage_percent
      FROM asset_metric_history
      WHERE asset_id = $1 AND collected_at >= $2
      ORDER BY collected_at ASC
      LIMIT $3
    `,
    [assetId, since, limit]
  );

  return result.rows.map(fromRow);
}
