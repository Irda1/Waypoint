import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DAY_COLORS, boundsOf, dayColor, discoverPoints, mapHtml, planPoints, safeJson, visiblePoints } from './map.ts';
import type { Place, TripItem } from './types.ts';

const pl = (id: number, over: Partial<Place> = {}): Place => ({ id, name: `Lieu ${id}`, kind: 'activity', category_code: 'musee', lat: 38.7 + id / 100, lng: -9.1, price_amount: null, visit_duration_min: 60, closed_days: [], ...over });
const item = (id: string, dayId: string, placeId: number | null, time: string | null, position = 0): TripItem => ({ id, day_id: dayId, plan: 'A', place_id: placeId, title: placeId ? null : 'Libre', category_code: null, start_time: time, duration_min: null, position, done: false });

test('points du programme : numérotés par jour dans l\'ordre horaire, étapes libres ignorées', () => {
  const places = new Map([[1, pl(1)], [2, pl(2)], [3, pl(3)]]);
  const items = [item('a', 'd1', 2, '14:00'), item('b', 'd1', 1, '09:30'), item('c', 'd1', null, '11:00'), item('d', 'd2', 3, '10:00')];
  const pts = planPoints({ days: [{ id: 'd1', day_date: '2026-10-14' }, { id: 'd2', day_date: '2026-10-15' }], items, places, rootOf: () => 'culture' });
  assert.deepEqual(pts.map((p) => [p.id, p.day, p.order]), [['plan:b', 1, 1], ['plan:a', 1, 2], ['plan:d', 2, 1]]);
  assert.equal(pts[0].color, dayColor(1));
  assert.equal(pts[2].color, dayColor(2));
});

test('couleurs de jour : cycle sans trou', () => {
  assert.equal(dayColor(1), DAY_COLORS[0]);
  assert.equal(dayColor(DAY_COLORS.length + 1), DAY_COLORS[0]);
  assert.equal(dayColor(0), DAY_COLORS[0]);
});

test('lieux à découvrir : ceux du programme sont exclus', () => {
  const c = [1, 2, 3].map((id) => ({ place: pl(id), root: 'culture' }));
  const pts = discoverPoints({ candidates: c, inTrip: new Set([2]), colorOf: () => '#123456' });
  assert.deepEqual(pts.map((p) => p.placeId), [1, 3]);
  assert.ok(pts.every((p) => p.kind === 'disc' && p.order === null));
});

test('filtres : jour, lieux à découvrir, catégories', () => {
  const places = new Map([[1, pl(1)], [2, pl(2)]]);
  const plan = planPoints({ days: [{ id: 'd1', day_date: '2026-10-14' }, { id: 'd2', day_date: '2026-10-15' }], items: [item('a', 'd1', 1, '10:00'), item('b', 'd2', 2, '10:00')], places, rootOf: () => 'culture' });
  const disc = discoverPoints({ candidates: [{ place: pl(5), root: 'nature' }, { place: pl(6), root: 'culture' }], inTrip: new Set(), colorOf: () => '#000' });
  const all = [...plan, ...disc];
  assert.equal(visiblePoints(all, { day: null, discover: false, roots: [] }).length, 2);
  assert.equal(visiblePoints(all, { day: 1, discover: false, roots: [] }).length, 1);
  assert.equal(visiblePoints(all, { day: 2, discover: true, roots: [] }).length, 3);
  assert.equal(visiblePoints(all, { day: null, discover: true, roots: ['nature'] }).length, 3);
});

test('cadre : englobe les points ; un point seul ou alignés reçoivent un cadre minimal ; vide = null', () => {
  assert.equal(boundsOf([]), null);
  const b = boundsOf([{ lat: 38.7, lng: -9.2 }, { lat: 38.8, lng: -9.1 }])!;
  assert.deepEqual([b.south, b.north, b.west, b.east], [38.7, 38.8, -9.2, -9.1]);
  const one = boundsOf([{ lat: 10, lng: 20 }])!;
  assert.ok(one.north > one.south && one.east > one.west);
  const line = boundsOf([{ lat: 10, lng: 20 }, { lat: 10, lng: 20.5 }])!;
  assert.ok(line.north > line.south);
});

test('JSON de page : « </script> » et séparateurs Unicode neutralisés', () => {
  const s = safeJson({ label: 'Café </script><script>alert(1)</script>\u2028' });
  assert.ok(!s.includes('</script>') && !s.includes('<'));
  assert.equal(JSON.parse(s).label, 'Café </script><script>alert(1)</script>\u2028');
});

test('page de carte : style clair ou sombre, messages, attribution automatique de MapLibre', () => {
  const light = mapHtml({ dark: false, start: { lat: 38.7, lng: -9.1, zoom: 11 } });
  const dark = mapHtml({ dark: true, start: { lat: 38.7, lng: -9.1, zoom: 11 } });
  assert.match(light, /openfreemap\.org\/styles\/liberty/);
  assert.match(dark, /openfreemap\.org\/styles\/dark/);
  assert.match(light, /maplibre-gl@4\.7\.1/);
  assert.match(light, /type:'select'/);
  assert.match(light, /attributionControl/);
  assert.match(light, /send\(\{type:'ready'\}\);\n  var lastError/);   // « prêt » sans attendre les tuiles
  assert.match(light, /forceStyle/);
  assert.match(light, /drawRoutes/);
  assert.match(light, /stroke-dasharray/);
  assert.ok(!light.includes('undefined') && !light.includes('NaN'));
});

test('public/map.html (web) est à jour : identique à la page générée', () => {
  const file = readFileSync(new URL('../../public/map.html', import.meta.url), 'utf8');
  assert.equal(file, mapHtml({ dark: false, start: { lat: 20, lng: 0, zoom: 2 }, fromUrl: true }));
});
