const test = require('node:test');
const assert = require('node:assert/strict');

const { _test } = require('../src/services/onedrive-backup');

test('agenda o backup no domingo durante a hora das 2h em São Paulo', () => {
  const duringWindow = new Date('2026-10-04T05:37:00.000Z');
  assert.equal(_test.scheduledRunKey(duringWindow), 'weekly-2026-10-04');
});

test('não agenda fora da janela semanal', () => {
  const beforeWindow = new Date('2026-10-04T04:59:00.000Z');
  const nextDay = new Date('2026-10-05T05:15:00.000Z');
  assert.equal(_test.scheduledRunKey(beforeWindow), '');
  assert.equal(_test.scheduledRunKey(nextDay), '');
});
