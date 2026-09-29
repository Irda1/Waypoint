import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCountryInfo, parseCities, parseAdmin1, flagEmoji } from '../src/lib/geonames.mjs';
import { readFirstZipEntry } from '../src/lib/zip.mjs';

const fx = (n) => new URL(`./fixtures/${n}`, import.meta.url);

test('zip : lit une entrée « deflate » créée par un autre outil (Python)', () => {
  const { name, data } = readFirstZipEntry(readFileSync(fx('cities15000.zip')));
  assert.equal(name, 'cities15000.txt');
  assert.equal(data.toString('utf8'), readFileSync(fx('cities15000.txt'), 'utf8'));
});

test('zip : lit une entrée stockée et refuse un fichier qui n\'est pas un zip', () => {
  assert.equal(readFirstZipEntry(readFileSync(fx('stored.zip'))).data.toString(), 'bonjour');
  assert.throws(() => readFirstZipEntry(Buffer.from('pas un zip du tout, vraiment pas un zip du tout')), /zip invalide/);
});

test('pays : colonnes, noms fr/en, devise, langues, drapeau', () => {
  const { rows, stats } = parseCountryInfo(readFileSync(fx('countryInfo.txt'), 'utf8'), { retrievedAt: 'T' });
  assert.equal(stats.kept, 3);
  const pt = rows.find((r) => r.code === 'PT');
  assert.equal(pt.iso3, 'PRT');
  assert.equal(pt.name_fr, 'Portugal');
  assert.equal(pt.name_en, 'Portugal');
  assert.deepEqual(pt.currency_codes, ['EUR']);
  assert.deepEqual(pt.languages, ['pt', 'mwl']);
  assert.equal(pt.calling_code, '+351');
  assert.equal(pt.flag_emoji, '🇵🇹');
  assert.equal(pt.region, 'Europe');
  assert.equal(pt.geonames_id, 2264397);
  assert.equal(pt.license, 'CC BY 4.0');
  const jp = rows.find((r) => r.code === 'JP');
  assert.equal(jp.name_fr, 'Japon');
  const us = rows.find((r) => r.code === 'US');
  assert.equal(us.name_fr, 'États-Unis');
  assert.deepEqual(us.languages, ['en', 'es', 'haw', 'fr']);
  // toutes les lignes ont les mêmes clés (exigence de l'upsert en lot)
  const keys = JSON.stringify(Object.keys(rows[0]));
  assert.ok(rows.every((r) => JSON.stringify(Object.keys(r)) === keys));
});

test('pays : un format inattendu échoue bruyamment au lieu de décaler les colonnes', () => {
  assert.throws(() => parseCountryInfo('PT\tPRT\t620\n'), /colonnes/);
});

test('flagEmoji', () => assert.equal(flagEmoji('jp'), '🇯🇵'));

test('villes : tri de l\'essentiel (classe P, population, pays connu)', () => {
  const admin1 = parseAdmin1(readFileSync(fx('admin1CodesASCII.txt'), 'utf8'));
  const text = readFileSync(fx('cities15000.txt'), 'utf8');
  const { rows, stats } = parseCities(text, { admin1, countries: new Set(['PT', 'JP']), retrievedAt: 'T' });
  assert.deepEqual(rows.map((r) => r.name), ['Lisbon', 'Porto', 'Tokyo']);
  assert.equal(stats.skippedSmall, 1);
  assert.equal(stats.skippedCountry, 1);
  assert.equal(stats.skippedInvalid, 1);
  const lisbon = rows[0];
  assert.equal(lisbon.is_capital, true);
  assert.equal(lisbon.admin1, 'Lisbon');
  assert.equal(lisbon.timezone, 'Europe/Lisbon');
  assert.equal(lisbon.geonames_id, 2267057);
  assert.equal(lisbon.lat, 38.71667);
  assert.equal(rows[1].is_capital, false);
  assert.ok(!('name_fr' in lisbon), 'name_fr n\'est pas écrasé par la collecte');
});

test('villes : filtre par pays et seuil de population', () => {
  const text = readFileSync(fx('cities15000.txt'), 'utf8');
  assert.deepEqual(parseCities(text, { only: 'JP' }).rows.map((r) => r.name), ['Tokyo']);
  assert.deepEqual(parseCities(text, { minPopulation: 300000 }).rows.map((r) => r.name), ['Lisbon', 'Tokyo']);
});
