import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateOptions, fastest, formatKm, googleDirectionsUrl, googlePlaceUrl, osrmUrl, parseOsrm, travelOptions } from './routes.ts';

const sao = { lat: 38.7139, lng: -9.1333 };
const se = { lat: 38.7223, lng: -9.1393 };
const porto = { lat: 41.1579, lng: -8.6291 };

test('estimations : quatre modes, jamais réelles', () => {
  const o = estimateOptions(sao, se);
  assert.deepEqual(o.map((x) => x.mode), ['walk', 'bike', 'transit', 'car']);
  assert.ok(o.every((x) => !x.real));
});

test('le plus court : à pied à égalité sur quelques mètres, vélo vers 1 km', () => {
  assert.equal(fastest(estimateOptions(sao, { lat: 38.7145, lng: -9.1333 })).mode, 'walk');
  assert.equal(fastest(estimateOptions(sao, se)).mode, 'bike');
});

test('estimations : la voiture est la plus rapide sur une longue distance', () => {
  assert.equal(fastest(estimateOptions(se, porto)).mode, 'car');
});

test('durée réelle : remplace l\'estimation sauf pour les transports', () => {
  const o = travelOptions(sao, se, { walk: { minutes: 26, km: 1.94 }, car: { minutes: 5, km: 2.4 } });
  assert.deepEqual(o.find((x) => x.mode === 'walk'), { mode: 'walk', label: 'À pied', minutes: 26, real: true });
  assert.equal(o.find((x) => x.mode === 'car')!.real, true);
  assert.equal(o.find((x) => x.mode === 'bike')!.real, false);
  assert.equal(o.find((x) => x.mode === 'transit')!.real, false);
  assert.equal(fastest(o).mode, 'car');
});

test('liens Google Maps : coordonnées, ou adresse saisie de préférence', () => {
  assert.equal(googleDirectionsUrl(sao, se, 'walk'),
    'https://www.google.com/maps/dir/?api=1&origin=38.7139,-9.1333&destination=38.7223,-9.1393&travelmode=walking');
  const hotel = { ...sao, address: 'Rua Garrett 12, Lisboa' };
  assert.equal(googleDirectionsUrl(hotel, se, 'transit'),
    'https://www.google.com/maps/dir/?api=1&origin=Rua%20Garrett%2012%2C%20Lisboa&destination=38.7223,-9.1393&travelmode=transit');
  assert.match(googleDirectionsUrl(sao, se, 'bike'), /travelmode=bicycling$/);
  assert.match(googleDirectionsUrl(sao, se, 'car'), /travelmode=driving$/);
});

test('adresse OSRM : profil, longitude puis latitude, sans double barre', () => {
  assert.equal(osrmUrl('https://exemple.test/', 'foot', se, sao),
    'https://exemple.test/routed-foot/route/v1/foot/-9.13930,38.72230;-9.13330,38.71390?overview=false');
  assert.match(osrmUrl('https://exemple.test', 'car', se, sao), /routed-car\/route\/v1\/driving\//);
  assert.match(osrmUrl('https://exemple.test', 'bike', se, sao), /routed-bike\/route\/v1\/bike\//);
});

test('réponse OSRM : durée arrondie au-dessus, réponses invalides refusées', () => {
  assert.deepEqual(parseOsrm({ code: 'Ok', routes: [{ duration: 1552.2, distance: 1936.2 }] }), { minutes: 26, km: 1.94 });
  assert.deepEqual(parseOsrm({ code: 'Ok', routes: [{ duration: 5, distance: 3 }] }), { minutes: 1, km: 0 });
  assert.equal(parseOsrm({ code: 'NoRoute', routes: [] }), null);
  assert.equal(parseOsrm({ code: 'Ok', routes: [{ duration: 'x', distance: 1 }] }), null);
  assert.equal(parseOsrm(null), null);
});

test('distance lisible', () => {
  assert.equal(formatKm(0.62), '600 m');
  assert.equal(formatKm(1.94), '1,9 km');
});

test('lien Google Maps d\'un lieu : nom et coordonnées encodés', () => {
  assert.equal(googlePlaceUrl('Tour de Belém', { lat: 38.6916, lng: -9.216 }),
    'https://www.google.com/maps/search/?api=1&query=Tour%20de%20Bel%C3%A9m%2038.6916,-9.216');
});
