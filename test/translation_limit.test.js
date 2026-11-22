import test from 'node:test';
import assert from 'node:assert/strict';
import { createTranslationLimit } from '../src/translation_limit.js';

test('rate limiter rejects excess requests and resets after a minute', () => {
  let time = 1000;
  const limit = createTranslationLimit(() => time);
  let accepted = 0;
  let status;
  let retryAfter;
  const res = {
    setHeader(name, value) { if (name === 'Retry-After') retryAfter = value; },
    status(value) { status = value; return this; },
    json() {},
  };
  for (let i = 0; i < 20; i++) limit({}, res, () => accepted++);
  assert.equal(accepted, 20);
  time += 15_000;
  limit({}, res, () => accepted++);
  assert.equal(status, 429);
  assert.equal(retryAfter, '45');
  assert.equal(accepted, 20);
  time += 45_000;
  limit({}, res, () => accepted++);
  assert.equal(accepted, 21);
});
