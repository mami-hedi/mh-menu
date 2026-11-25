// Ce fichier tourne dans son propre processus : on active ici les VRAIES limites de débit.
process.env.TEST_REAL_LIMITS = '1';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
// Imports dynamiques : la variable doit exister avant l'évaluation des modules
const { createApp } = await import('../src/app.js');
const { pool, query } = await import('../src/config/db.js');

let server, base;
before(async () => {
  await query(`DELETE FROM users WHERE email LIKE 'rl-%@example.com'`);
  await new Promise((r) => (server = createApp().listen(0, r)));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => { await new Promise((r) => server.close(r)); await pool.end(); });

const login = (email, ip) => fetch(`${base}/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip }, body: JSON.stringify({ email, password: 'Mauvaismdp123' }),
});

test('connexion : 10 échecs par compte (même depuis des IP différentes), puis 429', async () => {
  const email = 'rl-victime@example.com';
  for (let i = 0; i < 10; i++) assert.equal((await login(email, `10.0.0.${i + 1}`)).status, 401, `tentative ${i + 1}`);
  const blocked = await login(email, '10.0.1.1');
  assert.equal(blocked.status, 429);
  assert.equal((await blocked.json()).error.code, 'RATE_LIMITED');
  // Un autre compte n'est pas affecté
  assert.equal((await login('rl-autre@example.com', '10.0.2.1')).status, 401);
});

test('connexion : limite par adresse IP (10 / 15 min), comptes différents', async () => {
  for (let i = 0; i < 10; i++) await login(`rl-ip${i}@example.com`, '10.9.9.9');
  assert.equal((await login('rl-ip-final@example.com', '10.9.9.9')).status, 429);
});

test('en-têtes de limitation exposés (draft-7)', async () => {
  const r = await login('rl-hdr@example.com', '10.7.7.7');
  assert.ok(r.headers.get('ratelimit') || r.headers.get('ratelimit-policy'));
});

test('inscription : 10 par heure et par IP', async () => {
  const reg = (i) => fetch(`${base}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.5.5.5' }, body: JSON.stringify({}) });
  for (let i = 0; i < 10; i++) assert.equal((await reg(i)).status, 400);
  assert.equal((await reg(11)).status, 429);
});
