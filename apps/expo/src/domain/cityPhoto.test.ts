import { test } from 'node:test';
import assert from 'node:assert/strict';
import { photoFromSummary, resizeThumb } from './cityPhoto.ts';

const kyoto = {
  type: 'standard',
  coordinates: { lat: 35.0116, lon: 135.7681 },
  originalimage: { source: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Kyoto_skyline.jpg', width: 4000, height: 2600 },
  thumbnail: { source: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Kyoto_skyline.jpg/320px-Kyoto_skyline.jpg', width: 320, height: 208 },
};

test('miniature Wikimedia redimensionnée', () => {
  assert.equal(resizeThumb(kyoto.thumbnail.source, 1280), 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Kyoto_skyline.jpg/1280px-Kyoto_skyline.jpg');
  assert.equal(resizeThumb('https://exemple.org/photo.jpg', 1280), 'https://exemple.org/photo.jpg');
});

test('photo gardée quand la page est bien celle de la ville', () => {
  const p = photoFromSummary(kyoto, 35.02, 135.75);
  assert.ok(p);
  assert.match(p.uri, /1280px-/);
  assert.match(p.small, /640px-/);
});

test('photo écartée : autre lieu, homonymie, carte, portrait, trop petite', () => {
  assert.equal(photoFromSummary(kyoto, 48.85, 2.35), null);
  assert.equal(photoFromSummary({ ...kyoto, type: 'disambiguation' }, 35.02, 135.75), null);
  assert.equal(photoFromSummary({ ...kyoto, originalimage: { source: 'https://x/Carte.svg', width: 2000, height: 1000 } }, 35.02, 135.75), null);
  assert.equal(photoFromSummary({ ...kyoto, originalimage: { ...kyoto.originalimage, width: 1000, height: 1500 } }, 35.02, 135.75), null);
  assert.equal(photoFromSummary({ ...kyoto, originalimage: { ...kyoto.originalimage, width: 500, height: 300 } }, 35.02, 135.75), null);
  assert.equal(photoFromSummary(null, 0, 0), null);
});
