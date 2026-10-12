import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categoryFromOsm, parseGoogleMapsLink, photonPlaces } from './addPlace.ts';

const LISBOA = { lat: 38.7223, lng: -9.1393 };

test('categoryFromOsm : tri de la collecte, puis famille la plus proche', () => {
  assert.equal(categoryFromOsm('tourism', 'museum'), 'musee');
  assert.equal(categoryFromOsm('amenity', 'cafe'), 'cafe');
  assert.equal(categoryFromOsm('amenity', 'pharmacy'), 'pharmacie');
  assert.equal(categoryFromOsm('shop', 'pastry'), 'cafe');
  assert.equal(categoryFromOsm('shop', 'books'), 'shopping');
  assert.equal(categoryFromOsm('natural', 'peak'), 'nature');
  assert.equal(categoryFromOsm('tourism', 'hotel'), null);
  assert.equal(categoryFromOsm('highway', 'bus_stop'), null);
});

test('photonPlaces : garde les lieux nommés, typés et proches, sans doublon', () => {
  const f = (name: string, key: string, value: string, lng: number, lat: number, id = 1, type = 'N') => ({ geometry: { coordinates: [lng, lat] }, properties: { name, osm_type: type, osm_id: id, osm_key: key, osm_value: value, street: 'Rua de Belém', housenumber: '84', city: 'Lisbonne' } });
  const json = { features: [
    f('Pastéis de Belém', 'shop', 'pastry', -9.2033, 38.6975, 1),
    f('Pastéis de Belém', 'shop', 'pastry', -9.2033, 38.6975, 1),
    f('Hôtel', 'tourism', 'hotel', -9.14, 38.72, 2),
    f('Porto', 'tourism', 'museum', -8.61, 41.15, 3),
    f('', 'tourism', 'museum', -9.14, 38.72, 4),
    f('Mosteiro dos Jerónimos', 'historic', 'monastery', -9.2063, 38.6979, 5, 'W'),
  ] };
  const out = photonPlaces(json, LISBOA);
  assert.deepEqual(out.map((p) => p.name), ['Pastéis de Belém', 'Mosteiro dos Jerónimos']);
  assert.equal(out[0].category, 'cafe');
  assert.equal(out[0].address, 'Rua de Belém 84, Lisbonne');
  assert.equal(out[1].osm_type, 'way');
  assert.ok(out[0].km > 5 && out[0].km < 7);
  assert.deepEqual(photonPlaces(null, LISBOA), []);
});

test('parseGoogleMapsLink : lien de lieu, repère précis, liens courts et textes ordinaires', () => {
  assert.deepEqual(parseGoogleMapsLink('https://www.google.com/maps/place/Miradouro+de+Santa+Luzia/@38.7116,-9.1301,17z'),
    { kind: 'place', name: 'Miradouro de Santa Luzia', lat: 38.7116, lng: -9.1301 });
  assert.deepEqual(parseGoogleMapsLink('https://www.google.fr/maps/place/Torre+de+Bel%C3%A9m/@38.69,-9.21,15z/data=!4m6!3m5!1s0x1:0x2!8m2!3d38.6916!4d-9.2160'),
    { kind: 'place', name: 'Torre de Belém', lat: 38.6916, lng: -9.216 });
  assert.deepEqual(parseGoogleMapsLink('https://maps.google.com/?q=Time+Out+Market&ll=1,2'), { kind: 'unreadable' });
  assert.deepEqual(parseGoogleMapsLink('https://www.google.com/maps/search/?api=1&query=38.71,-9.13'), { kind: 'unreadable' });
  assert.deepEqual(parseGoogleMapsLink(' https://maps.app.goo.gl/AbCd123 '), { kind: 'short', url: 'https://maps.app.goo.gl/AbCd123' });
  assert.equal(parseGoogleMapsLink('musée'), null);
  assert.equal(parseGoogleMapsLink('https://www.openstreetmap.org/node/1'), null);
  assert.equal(parseGoogleMapsLink('https://evil.example/maps/place/x/@1,2'), null);
});
