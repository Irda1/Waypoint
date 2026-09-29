// Analyse des fichiers GeoNames (licence CC BY 4.0 : attribution obligatoire).
// Formats : https://download.geonames.org/export/dump/readme.txt
// Les analyseurs vérifient le nombre de colonnes et échouent bruyamment si le
// format change, plutôt que d'écrire des données décalées dans la base.

export const GEONAMES_LICENSE = 'CC BY 4.0';

const CONTINENTS = {
  AF: 'Afrique', AN: 'Antarctique', AS: 'Asie', EU: 'Europe',
  NA: 'Amérique du Nord', OC: 'Océanie', SA: 'Amérique du Sud',
};

export function flagEmoji(iso2) {
  return [...iso2.toUpperCase()].map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)).join('');
}

const namesIn = (locale) => new Intl.DisplayNames([locale], { type: 'region' });

/** countryInfo.txt : colonnes ISO, ISO3, ISO-Numeric, fips, Country, Capital, Area, Population,
 *  Continent, tld, CurrencyCode, CurrencyName, Phone, PostalCodeFormat, PostalCodeRegex,
 *  Languages, geonameid, neighbours, EquivalentFipsCode */
export function parseCountryInfo(text, { retrievedAt = new Date().toISOString() } = {}) {
  const fr = namesIn('fr');
  const en = namesIn('en');
  const rows = [];
  let read = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    read++;
    const c = line.split('\t');
    if (c.length < 17) throw new Error(`countryInfo.txt : ${c.length} colonnes au lieu de 17+ (ligne « ${line.slice(0, 40)} »)`);
    const code = c[0];
    if (!/^[A-Z]{2}$/.test(code)) continue;
    const languages = [...new Set(c[15].split(',').map((l) => l.split('-')[0].trim()).filter(Boolean))];
    rows.push({
      code,
      iso3: c[1] || null,
      name_fr: fr.of(code) || c[4],
      name_en: en.of(code) || c[4],
      capital: c[5] || null,
      region: CONTINENTS[c[8]] || null,
      currency_codes: c[10] ? [c[10]] : [],
      languages,
      calling_code: c[12] ? `+${c[12].replace(/^\+/, '')}` : null,
      flag_emoji: flagEmoji(code),
      population: c[7] ? Number(c[7]) : null,
      geonames_id: c[16] ? Number(c[16]) : null,
      source: 'geonames',
      license: GEONAMES_LICENSE,
      source_url: 'https://download.geonames.org/export/dump/countryInfo.txt',
      retrieved_at: retrievedAt,
    });
  }
  return { rows, stats: { read, kept: rows.length } };
}

/** admin1CodesASCII.txt : « PT.17<TAB>Lisbon<TAB>Lisbon<TAB>2267056 » -> { 'PT.17': 'Lisbon' } */
export function parseAdmin1(text) {
  const map = new Map();
  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;
    const c = line.split('\t');
    if (c.length < 2) continue;
    map.set(c[0], c[1]);
  }
  return map;
}

/**
 * citiesNNNN.txt (19 colonnes) : geonameid, name, asciiname, alternatenames, latitude, longitude,
 * feature class, feature code, country code, cc2, admin1, admin2, admin3, admin4, population,
 * elevation, dem, timezone, modification date.
 * Tri : uniquement les lieux habités (classe P), avec nom, coordonnées valides et pays connu.
 */
export function parseCities(text, { admin1 = new Map(), minPopulation = 15000, countries = null, only = null, retrievedAt = new Date().toISOString() } = {}) {
  const rows = [];
  const stats = { read: 0, kept: 0, skippedCountry: 0, skippedSmall: 0, skippedInvalid: 0 };
  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;
    stats.read++;
    const c = line.split('\t');
    if (c.length < 19) throw new Error(`cities : ${c.length} colonnes au lieu de 19 (ligne « ${line.slice(0, 40)} »)`);
    const [geonameId, name, ascii, , lat, lng, fclass, fcode, cc, , a1, , , , pop, , , tz] = c;
    if (fclass !== 'P') { stats.skippedInvalid++; continue; }
    const latN = Number(lat), lngN = Number(lng), popN = Number(pop || 0);
    if (!name || !Number.isFinite(latN) || !Number.isFinite(lngN) || Math.abs(latN) > 90 || Math.abs(lngN) > 180) {
      stats.skippedInvalid++; continue;
    }
    if (popN < minPopulation) { stats.skippedSmall++; continue; }
    if (only && cc !== only) continue;
    if (countries && !countries.has(cc)) { stats.skippedCountry++; continue; }
    rows.push({
      country_code: cc,
      name,
      name_ascii: ascii || null,
      admin1: admin1.get(`${cc}.${a1}`) || null,
      lat: latN,
      lng: lngN,
      population: popN || null,
      timezone: tz || null,
      is_capital: fcode === 'PPLC',
      geonames_id: Number(geonameId),
      source: 'geonames',
      license: GEONAMES_LICENSE,
      source_url: `https://www.geonames.org/${geonameId}`,
      retrieved_at: retrievedAt,
    });
  }
  stats.kept = rows.length;
  return { rows, stats };
}
