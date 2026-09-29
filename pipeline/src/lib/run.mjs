// Journal des passes (table ingestion_runs) : quelle source, quand, combien de lignes.

export async function startRun(sb, { pass, source, scope = 'all', license = null }) {
  const row = await sb.insert('ingestion_runs', { pass, source, scope, license }, 'id');
  return row?.id ?? null;
}

export async function finishRun(sb, id, stats, error = null) {
  if (id == null) return;
  await sb.patch('ingestion_runs', `id=eq.${id}`, {
    status: error ? 'failed' : 'done',
    rows_read: stats.read ?? 0,
    rows_kept: stats.kept ?? 0,
    rows_written: stats.written ?? 0,
    error: error ? String(error.message || error).slice(0, 1000) : null,
    finished_at: new Date().toISOString(),
  });
}
