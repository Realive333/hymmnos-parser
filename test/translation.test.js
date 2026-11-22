import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { GoogleGenAI } from '@google/genai';
import { createApp } from '../server.js';

test('streams thoughts, structured translation, and usage with the selected model', async () => {
  const calls = [];
  const createClient = () => ({ models: { async generateContentStream(options) {
    calls.push(options);
    return (async function* () {
      yield { candidates: [{ content: { parts: [{ thought: true, text: '考察' }] } }] };
      yield { candidates: [{ content: { parts: [{ text: '{"hymmnos":"Was yea ra hymme.",' }] } }] };
      yield { candidates: [{ content: { parts: [{ text: '"words":[]}' }] }, finishReason: 'STOP' }],
        usageMetadata: { promptTokenCount: 123, candidatesTokenCount: 10 } };
    })();
  } } });
  const server = createApp({ createClient, model: 'gemini-3.8-flash' }).listen(0, '127.0.0.1');
  try {
    await new Promise(resolve => server.once('listening', resolve));
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/translate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inputText: '私は歌う' }),
    });
    const events = (await response.text()).trim().split('\n\n').map(line => JSON.parse(line.slice(6)));
    assert.equal(calls[0].model, 'gemini-3.8-flash');
    assert.equal(calls[0].config.responseMimeType, 'application/json');
    assert.equal(calls[0].config.thinkingConfig.includeThoughts, true);
    assert.match(calls[0].contents, /私は歌う/);
    assert.deepEqual(events.map(event => event.type), ['thought', 'response', 'response', 'done']);
    assert.equal(JSON.parse(events.at(-1).full).hymmnos, 'Was yea ra hymme.');
    assert.equal(events.at(-1).usage.promptTokenCount, 123);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('installed Gemini SDK sends the requested schema and parses the streamed response', async () => {
  let requestBody;
  const gemini = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    requestBody = JSON.parse(Buffer.concat(chunks).toString());
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.end('data: ' + JSON.stringify({ candidates: [{ content: { parts: [
      { text: '{"hymmnos":"Was yea ra hymme.","words":[]}' },
    ] }, finishReason: 'STOP' }] }) + '\n\n');
  }).listen(0, '127.0.0.1');
  await new Promise(resolve => gemini.once('listening', resolve));
  const app = createApp({ createClient: () => new GoogleGenAI({
    apiKey: 'test-key', apiVersion: 'v1beta',
    httpOptions: { baseUrl: `http://127.0.0.1:${gemini.address().port}` },
  }) }).listen(0, '127.0.0.1');
  try {
    await new Promise(resolve => app.once('listening', resolve));
    const response = await fetch(`http://127.0.0.1:${app.address().port}/api/translate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inputText: '歌う' }),
    });
    const events = (await response.text()).trim().split('\n\n').map(line => JSON.parse(line.slice(6)));
    assert.equal(events.at(-1).type, 'done');
    assert.equal(requestBody.generationConfig.responseMimeType, 'application/json');
    assert.deepEqual(requestBody.generationConfig.responseJsonSchema.required, ['hymmnos', 'words']);
    assert.equal(requestBody.generationConfig.thinkingConfig.includeThoughts, true);
  } finally {
    await new Promise(resolve => app.close(resolve));
    await new Promise(resolve => gemini.close(resolve));
  }
});

test('reverse translation uses plain text, and incomplete responses report an error', async () => {
  let options;
  const createClient = () => ({ models: { async generateContentStream(request) {
    options = request;
    return (async function* () {
      yield { candidates: [{ content: { parts: [{ text: '不完全' }] }, finishReason: 'MAX_TOKENS' }] };
    })();
  } } });
  const server = createApp({ createClient }).listen(0, '127.0.0.1');
  try {
    await new Promise(resolve => server.once('listening', resolve));
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/translate-back`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hymmnosText: 'Was yea ra hymme.' }),
    });
    const events = (await response.text()).trim().split('\n\n').map(line => JSON.parse(line.slice(6)));
    assert.equal(options.model, 'gemini-3.5-flash-lite');
    assert.equal(options.config.responseMimeType, undefined);
    assert.equal(events.at(-1).type, 'error');
    assert.ok(!events.some(event => event.type === 'done'));
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
