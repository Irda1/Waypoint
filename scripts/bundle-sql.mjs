// Concatène les migrations dans supabase/all-migrations.sql, à coller dans l'éditeur SQL
// de Supabase (alternative à la CLI). Le fichier est GÉNÉRÉ : ne pas l'éditer à la main.
//   node scripts/bundle-sql.mjs          # régénère le fichier
//   node scripts/bundle-sql.mjs --check  # échoue si le fichier n'est pas à jour
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const dir = fileURLToPath(new URL('../supabase/migrations/', import.meta.url));
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
const parts = files.map((f) => `-- ============================================================\n-- ${f}\n-- ============================================================\n${readFileSync(join(dir, f), 'utf8').trim()}\n`);
const header = `-- Waypoint · toutes les migrations, dans l'ordre (généré par scripts/bundle-sql.mjs)\n-- À exécuter UNE fois sur un projet Supabase neuf : éditeur SQL > New query > Run.\n\n`;
const out = new URL('../supabase/all-migrations.sql', import.meta.url);
const content = header + parts.join('\n');
if (process.argv.includes('--check')) {
  if (!existsSync(out) || readFileSync(out, 'utf8') !== content) {
    console.error('supabase/all-migrations.sql n\'est pas à jour : lancer « node scripts/bundle-sql.mjs ».');
    process.exit(1);
  }
  console.log('all-migrations.sql à jour.');
} else {
  writeFileSync(out, content);
  console.log(`${files.length} migrations regroupées dans supabase/all-migrations.sql`);
}
