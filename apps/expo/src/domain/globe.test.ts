import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { globeHtml } from './globe.ts';

test('public/globe.html est à jour avec le générateur', () => {
  const file = readFileSync(new URL('../../public/globe.html', import.meta.url), 'utf8');
  assert.equal(file, globeHtml());
});

test('la page du globe contient un script valide', () => {
  const scripts = [...globeHtml().matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.ok(scripts.length > 0);
  assert.doesNotThrow(() => new Function(scripts[scripts.length - 1][1]));
});

test('public/regions.html est à jour avec le générateur', async () => {
  const { regionsHtml } = await import('./regionsMap.ts');
  const file = readFileSync(new URL('../../public/regions.html', import.meta.url), 'utf8');
  assert.equal(file, regionsHtml());
  const scripts = [...regionsHtml().matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.doesNotThrow(() => new Function(scripts[scripts.length - 1][1]));
});

test('public/route.html est à jour avec le générateur et son script est valide', async () => {
  const { routeHtml } = await import('./routeGlobe.ts');
  const file = readFileSync(new URL('../../public/route.html', import.meta.url), 'utf8');
  assert.equal(file, routeHtml());
  const scripts = [...routeHtml().matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.doesNotThrow(() => new Function(scripts[scripts.length - 1][1]));
});

test('cadrage de la planète animée : en haut sur téléphone, à droite sur grand écran', async () => {
  const { routeGlobeOnScreen } = await import('./routeGlobe.ts');
  const phone = routeGlobeOnScreen(390, 500);
  assert.ok(phone.dy < 0 && phone.dx > 0 && phone.radius > 60 && phone.radius < 200);
  const desk = routeGlobeOnScreen(1280, 500);
  assert.ok(desk.dx > 300 && desk.dy === 0);
});

test('itinéraire passé à la planète : lng,lat,Nom par ville, séparateurs retirés des noms', async () => {
  const { routeParam } = await import('./routeGlobe.ts');
  assert.equal(routeParam([{ lat: 48.8566, lng: 2.3522, name: 'Paris' }, { lat: 41.39, lng: 2.17, name: 'Saint-Denis, La Réunion; x' }]),
    '2.352,48.857,Paris;2.170,41.390,Saint-Denis  La Réunion  x');
  assert.equal(routeParam([]), '');
});
