import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, rmdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseDictionary } from '../update_dict.js';
import { HYMMNOS_DICTIONARY } from '../src/hymmnos_dictionary.js';

test('imports quoted commas, quotes, newlines, and repeated words', () => {
  const csv = '\uFEFFword,meaning,pronunciation,tags,dialect\r\n' +
    'hymme,"song, ""sing""\nagain",,verb,central\r\n' +
    'hymme,another meaning,,noun,other\r\n';
  const entries = parseDictionary(csv);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].meaning, 'song, "sing"\nagain');
  assert.equal(entries[1].word, 'hymme');
  assert.equal(entries[1].dialect, 'other');
});

test('rejects malformed or empty imports before writing a dictionary', () => {
  assert.throws(() => parseDictionary('word,meaning,pronunciation,tags\nword,"unfinished'));
  assert.throws(() => parseDictionary('word,meaning,pronunciation,tags\nword,meaning'));
  assert.throws(() => parseDictionary('word,meaning,pronunciation,tags\n'));
});

test('CLI preserves the old dictionary on failure and writes a valid import', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hymmnos-dictionary-'));
  try {
    mkdirSync(join(dir, 'src'));
    const output = join(dir, 'src', 'hymmnos_dictionary.js');
    const original = 'export const HYMMNOS_DICTIONARY = ' + JSON.stringify([
      { word: 'hymme', meaning: 'sing', pronunciation: '', tags: ['verb'], dialect: '' },
      { word: 'hymme', meaning: 'song', pronunciation: '', tags: ['noun'], dialect: '' },
    ]) + ';';
    writeFileSync(output, original);
    writeFileSync(join(dir, '単語辞書.csv'), 'word,meaning,pronunciation,tags\nword,"unfinished');
    const script = fileURLToPath(new URL('../update_dict.js', import.meta.url));
    const result = spawnSync(process.execPath, [script], { cwd: dir });
    assert.notEqual(result.status, 0);
    assert.equal(readFileSync(output, 'utf8'), original);
    writeFileSync(join(dir, '単語辞書.csv'), 'word,meaning,pronunciation,tags\nhymme,sing,,verb');
    const incomplete = spawnSync(process.execPath, [script], { cwd: dir });
    assert.notEqual(incomplete.status, 0);
    assert.equal(readFileSync(output, 'utf8'), original);
    writeFileSync(join(dir, '単語辞書.csv'), 'word,meaning,pronunciation,tags\nhymme,sing,,verb\nhymme,changed,,noun');
    const changed = spawnSync(process.execPath, [script], { cwd: dir });
    assert.notEqual(changed.status, 0);
    assert.equal(readFileSync(output, 'utf8'), original);
    const valid = spawnSync(process.execPath, [script, '--allow-changes'], { cwd: dir });
    assert.equal(valid.status, 0, valid.stderr.toString());
    assert.match(readFileSync(output, 'utf8'), /"word": "hymme"/);
    const complete = spawnSync(process.execPath, [script], { cwd: dir });
    assert.equal(complete.status, 0, complete.stderr.toString());
  } finally {
    rmSync(join(dir, '単語辞書.csv'), { force: true });
    rmSync(join(dir, 'src', 'hymmnos_dictionary.js'), { force: true });
    rmdirSync(join(dir, 'src'));
    rmdirSync(dir);
  }
});

test('checked-in dictionary entries have the shape used by the app', () => {
  assert.ok(HYMMNOS_DICTIONARY.length > 0);
  for (const entry of HYMMNOS_DICTIONARY) {
    assert.equal(typeof entry.word, 'string');
    assert.ok(entry.word);
    assert.equal(typeof entry.meaning, 'string');
    assert.equal(typeof entry.pronunciation, 'string');
    assert.ok(Array.isArray(entry.tags));
    assert.ok(entry.tags.every(tag => typeof tag === 'string'));
    assert.equal(typeof entry.dialect, 'string');
  }
});
