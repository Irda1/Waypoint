import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tripStatus } from '../lib/dates.ts';
import { countdownView } from './countdown.ts';

test('countdownView : jours, demain, jour J, et rien le reste du temps', () => {
  const at = (start: string, end: string, today: string) => countdownView(tripStatus(start, end, today));
  assert.deepEqual(at('2026-10-25', '2026-10-30', '2026-10-13'), { kind: 'days', from: '13', to: '12' });
  assert.deepEqual(at('2026-10-14', '2026-10-30', '2026-10-05'), { kind: 'days', from: '10', to: '09' });
  assert.deepEqual(at('2027-01-21', '2027-01-25', '2026-10-13'), { kind: 'days', from: '101', to: '100' });
  assert.deepEqual(at('2026-10-14', '2026-10-30', '2026-10-13'), { kind: 'tomorrow' });
  assert.deepEqual(at('2026-10-13', '2026-10-30', '2026-10-13'), { kind: 'today' });
  assert.equal(at('2026-10-12', '2026-10-30', '2026-10-13'), null);
  assert.equal(at('2026-10-01', '2026-10-05', '2026-10-13'), null);
  assert.equal(countdownView({ kind: 'undated' }), null);
});
