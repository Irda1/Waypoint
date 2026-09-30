import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWalkRoute, walkRouteUrl } from './routes.ts';

test('adresse OSRM : longitude puis latitude, sans double barre', () => {
  assert.equal(
    walkRouteUrl('https://exemple.test/routed-foot/', { lat: 38.7223, lng: -9.1393 }, { lat: 38.7139, lng: -9.1333 }),
    'https://exemple.test/routed-foot/route/v1/foot/-9.13930,38.72230;-9.13330,38.71390?overview=false',
  );
});

test('réponse OSRM : durée arrondie au-dessus, distance en km, réponses invalides refusées', () => {
  assert.deepEqual(parseWalkRoute({ code: 'Ok', routes: [{ duration: 1552.2, distance: 1936.2 }] }), { minutes: 26, km: 1.94 });
  assert.deepEqual(parseWalkRoute({ code: 'Ok', routes: [{ duration: 5, distance: 3 }] }), { minutes: 1, km: 0 });
  assert.equal(parseWalkRoute({ code: 'NoRoute', routes: [] }), null);
  assert.equal(parseWalkRoute({ code: 'Ok', routes: [{ duration: 'x', distance: 1 }] }), null);
  assert.equal(parseWalkRoute(null), null);
});
