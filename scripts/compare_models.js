import { createApp } from '../server.js';

if (!process.env.GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY を設定してください。比較には Gemini API の利用料が発生します。');
  process.exit(1);
}

const cases = [
  { label: '感情を伴う通常文', path: '/api/translate', field: 'inputText', text: '私は嬉しくて歌う。' },
  { label: '強い命令', path: '/api/translate', field: 'inputText', text: '走れ！' },
  { label: '否定', path: '/api/translate', field: 'inputText', text: '私は歌わない。' },
  { label: '一人称以外の主語', path: '/api/translate', field: 'inputText', text: '私はあなたが走るのを見る。' },
  { label: '辞書にない可能性のある語', path: '/api/translate', field: 'inputText', text: '私は量子コンピューターを修理したい。' },
  { label: '逆翻訳と想音', path: '/api/translate-back', field: 'hymmnosText', text: 'Was yea ra hymme.' },
  { label: '逆翻訳と否定', path: '/api/translate-back', field: 'hymmnosText', text: 'Wee nyasri ga na crushue.' },
];

for (const model of ['gemini-3.5-flash-lite', 'gemini-3.8-flash']) {
  const server = createApp({ model }).listen(0, '127.0.0.1');
  try {
    await new Promise(resolve => server.once('listening', resolve));
    for (const item of cases) {
      const started = performance.now();
      const response = await fetch(`http://127.0.0.1:${server.address().port}${item.path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [item.field]: item.text }),
      });
      if (!response.ok) throw new Error(`${model}: HTTP ${response.status}`);
      const events = (await response.text()).trim().split('\n\n').map(line => JSON.parse(line.slice(6)));
      const final = events.find(event => event.type === 'done');
      if (!final) throw new Error(`${model}: ${events.find(event => event.type === 'error')?.message || '応答が不完全です'}`);
      console.log(JSON.stringify({
        model, case: item.label, input: item.text, output: final.full,
        elapsedMs: Math.round(performance.now() - started), usage: final.usage ?? null,
      }));
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}
