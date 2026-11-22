import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

test('new backend responds correctly without live provider credentials', async (t) => {
  const reservation = createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const server = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    windowsHide: true,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'production',
      DOTENV_CONFIG_PATH: '.env.smoke-disabled',
      GEMINI_API_KEY: '',
      WHATSAPP_ACCESS_TOKEN: '',
      WHATSAPP_PHONE_NUMBER_ID: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  server.stdout.on('data', chunk => { output += chunk; });
  server.stderr.on('data', chunk => { output += chunk; });
  let startupError;
  server.on('error', error => { startupError = error; });
  t.after(async () => {
    if (server.exitCode === null && server.signalCode === null) {
      const closed = once(server, 'close');
      server.kill();
      await closed;
    }
  });
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (startupError) throw startupError;
    if (server.exitCode !== null) throw new Error(output);
    try { ready = (await fetch(`${base}/api/health`)).ok; } catch {}
    if (ready) break;
    await delay(100);
  }
  assert.ok(ready, `Server did not start: ${output}`);
  const cases = [
    ['health', 'GET', '/api/health', undefined, 200],
    ['homepage', 'GET', '/', undefined, 200],
    ['invalid analysis', 'POST', '/api/ai/analyze-email', {}, 400],
    ['missing Gemini key', 'POST', '/api/ai/analyze-email', { messageId: 'synthetic-test', subject: 'Test only' }, 502],
    ['invalid recipient', 'POST', '/api/notifications/whatsapp/verify', { phoneNumber: '' }, 400],
    ['unconfigured WhatsApp', 'POST', '/api/notifications/whatsapp/verify', { phoneNumber: '+15555550123' }, 503],
    ['invalid webhook', 'POST', '/api/gmail/watch-webhook', {}, 400],
    ['synthetic webhook', 'POST', '/api/gmail/watch-webhook', { message: { data: Buffer.from(JSON.stringify({ emailAddress: 'test@example.test', historyId: '123' })).toString('base64') } }, 200],
  ];
  for (const [name, method, path, body, expected] of cases) {
    await t.test(name, async () => {
      const response = await fetch(base + path, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(5000),
      });
      assert.equal(response.status, expected);
      if (name === 'homepage') assert.match(await response.text(), /MailBridge/);
      if (name === 'health') {
        const health = await response.json();
        assert.equal(health.geminiConfigured, false);
        assert.equal(health.whatsappConfigured, false);
      }
      if (name === 'synthetic webhook') assert.equal((await response.json()).acknowledged, true);
    });
  }
});
