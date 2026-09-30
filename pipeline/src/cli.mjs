#!/usr/bin/env node
// Pipeline de collecte Waypoint.
//
//   node src/cli.mjs countries [--file countryInfo.txt] [--dry-run]
//   node src/cli.mjs cities    [--country PT] [--min-population 15000] [--file cities15000.zip] [--dry-run]
//   node src/cli.mjs places    --city 12 | --name Lisbonne [--radius 6000] [--dry-run]
//   node src/cli.mjs images    [--max 20] [--country PT] [--redo]
//   node src/cli.mjs queue     [--max 3]      (traite les villes demandées par l'app)
//   node src/cli.mjs rates                    (taux de change du jour, BCE)
//
// --dry-run : lit et trie, n'écrit rien en base.
import { parseArgs } from 'node:util';
import { loadConfig, requireSupabase } from './lib/config.mjs';
import { createSupabase } from './lib/supabase.mjs';
import { countriesPass } from './passes/countries.mjs';
import { citiesPass } from './passes/cities.mjs';
import { placesPass } from './passes/places.mjs';
import { imagesPass } from './passes/images.mjs';
import { queuePass } from './passes/queue.mjs';
import { ratesPass } from './passes/rates.mjs';

const { values: flags, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    'dry-run': { type: 'boolean', default: false },
    redo: { type: 'boolean', default: false },
    file: { type: 'string' },
    'admin1-file': { type: 'string' },
    country: { type: 'string' },
    'min-population': { type: 'string', default: '15000' },
    city: { type: 'string' },
    name: { type: 'string' },
    radius: { type: 'string' },
    max: { type: 'string' },
  },
});

const command = positionals[0];
const cfg = loadConfig();
const log = (...a) => console.log(...a);

async function main() {
  if (!['countries', 'cities', 'places', 'images', 'queue', 'rates'].includes(command)) {
    console.error('Commande : countries | cities | places | images | queue | rates (voir l\'en-tête de src/cli.mjs)');
    process.exit(2);
  }
  // En simulation, on peut travailler sans base uniquement avec des fichiers locaux
  const offline = flags['dry-run'] && !cfg.supabaseUrl;
  if (!offline) requireSupabase(cfg);
  const sb = createSupabase({ url: cfg.supabaseUrl, serviceKey: cfg.serviceKey, dryRun: flags['dry-run'], log });
  if (offline) {
    sb.select = async () => [];
    sb.insert = async (_t, row) => ({ id: null, ...row });
    sb.patch = async () => {};
    sb.rpc = async () => null;
  }

  switch (command) {
    case 'countries':
      return countriesPass({ sb, cfg, file: flags.file, log });
    case 'cities':
      return citiesPass({ sb, cfg, file: flags.file, admin1File: flags['admin1-file'], country: flags.country, minPopulation: Number(flags['min-population']), log });
    case 'places': {
      let city;
      if (flags.city) [city] = await sb.select('cities', `select=id,name,lat,lng,population&id=eq.${Number(flags.city)}`);
      else if (flags.name) [city] = await sb.select('cities', `select=id,name,lat,lng,population&or=(name.ilike.${encodeURIComponent(flags.name)},name_fr.ilike.${encodeURIComponent(flags.name)})&order=population.desc.nullslast&limit=1`);
      else throw new Error('places : indiquer --city <id> ou --name <nom>');
      if (!city) throw new Error('Ville introuvable en base (lancer d\'abord les passes countries et cities).');
      return placesPass({ sb, cfg, city, radiusM: flags.radius ? Number(flags.radius) : null, log });
    }
    case 'images':
      return imagesPass({ sb, cfg, max: Number(flags.max || 20), country: flags.country, redo: !!flags.redo, log });
    case 'queue':
      return queuePass({ sb, cfg, max: Number(flags.max || 3), log });
    case 'rates':
      return ratesPass({ sb, cfg, log });
    default:
  }
}

main().then((stats) => { if (stats) log(JSON.stringify(stats)); }).catch((err) => {
  console.error(`Erreur : ${err.message}`);
  process.exit(1);
});
