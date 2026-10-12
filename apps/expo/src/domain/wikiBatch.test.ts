import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pageThumbs, wikidataPages } from './wiki.ts';

test('wikidataPages : page française, sinon anglaise, sinon rien', () => {
  const json = { entities: {
    Q243: { sitelinks: { frwiki: { title: 'Tour Eiffel' }, enwiki: { title: 'Eiffel Tower' } } },
    Q9: { sitelinks: { enwiki: { title: 'Somewhere' } } },
    Q7: { sitelinks: {} },
  } };
  const m = wikidataPages(json, ['Q243', 'Q9', 'Q7', 'Q404']);
  assert.deepEqual(m.get('Q243'), { lang: 'fr', title: 'Tour Eiffel' });
  assert.deepEqual(m.get('Q9'), { lang: 'en', title: 'Somewhere' });
  assert.equal(m.get('Q7'), null);
  assert.equal(m.get('Q404'), null);
  assert.equal(wikidataPages(null, ['Q1']).get('Q1'), null);
});

test('pageThumbs : suit les titres normalisés et les redirections', () => {
  const json = { query: {
    normalized: [{ from: 'Tour_Eiffel', to: 'Tour Eiffel' }],
    redirects: [{ from: 'Louvre', to: 'Musée du Louvre' }],
    pages: [
      { title: 'Tour Eiffel', thumbnail: { source: 'https://x/330px-Eiffel.jpg' } },
      { title: 'Musée du Louvre', thumbnail: { source: 'https://x/330px-Louvre.jpg' } },
      { title: 'Sans image' },
    ],
  } };
  const m = pageThumbs(json, ['Tour_Eiffel', 'Louvre', 'Sans image', 'Inconnu']);
  assert.equal(m.get('Tour_Eiffel'), 'https://x/330px-Eiffel.jpg');
  assert.equal(m.get('Louvre'), 'https://x/330px-Louvre.jpg');
  assert.equal(m.get('Sans image'), null);
  assert.equal(m.get('Inconnu'), null);
});
