import { randomBytes, randomUUID, scrypt, scryptSync, timingSafeEqual } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import type { RowDataPacket } from 'mysql2';
import type { Pool } from 'mysql2/promise';
import { calculate } from './formula.js';
import { InputError } from './sale.js';

const derive = promisify(scrypt);
const runFile = promisify(execFile);
const salt = randomBytes(16);
const configured = process.env.ADMIN_PASSWORD;
const expected = configured && configured.length >= 16 ? scryptSync(configured, salt, 64) : null;
const sessions = new Map<string, number>();
let activeLogins = 0;
export const auth = express.Router();

auth.post('/login', async (request, response) => {
  if (!expected) {
    response.status(503).json({ error: 'Configure a senha administrativa para habilitar o painel.' });
    return;
  }
  if (activeLogins >= 2) {
    response.sendStatus(429);
    return;
  }
  const { username, password } = request.body ?? {};
  if (username !== 'admin' || typeof password !== 'string' || password.length > 1024) {
    response.sendStatus(401);
    return;
  }
  activeLogins++;
  try {
    const actual = await derive(password, salt, expected.length) as Buffer;
    if (!timingSafeEqual(actual, expected)) {
      response.sendStatus(401);
      return;
    }
    for (const [token, expires] of sessions) {
      if (expires <= Date.now()) sessions.delete(token);
    }
    if (sessions.size >= 64) sessions.delete(sessions.keys().next().value!);
    const token = randomBytes(32).toString('base64url');
    sessions.set(token, Date.now() + 30 * 60_000);
    response.json({ token });
  } finally {
    activeLogins--;
  }
});

function requireAdmin(request: Request, response: Response, next: NextFunction): void {
  const token = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(request.headers.authorization ?? '')?.[1];
  if (!token || (sessions.get(token) ?? 0) <= Date.now()) {
    response.sendStatus(401);
    return;
  }
  next();
}

function csvCell(value: unknown): string {
  let text = String(value);
  if (/^[=+@\-\t\r\n]/.test(text.trimStart()) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}

export function createAdminRouter(pool: Pool): express.Router {
  const admin = express.Router();
  admin.use(requireAdmin);
  const directory = mkdtemp(path.join(tmpdir(), 'vendas-exports-'));
  const archiveDirectory = mkdtemp(path.join(tmpdir(), 'vendas-archives-'));
  const files = new Map<string, string>();
  const preferences = { currency: 'BRL', locale: 'pt-BR' };

  admin.post('/export', async (_request, response) => {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, product, customer, quantity, unit_price_cents, sold_on FROM sales ORDER BY id'
    );
    const lines = rows.map(row =>
      [row.id, row.product, row.customer, row.quantity, row.unit_price_cents, row.sold_on].map(csvCell).join(',')
    );
    const name = `vendas-${randomUUID()}.csv`;
    const fullPath = path.join(await directory, name);
    await writeFile(fullPath, ['id,produto,cliente,quantidade,preco_centavos,data', ...lines].join('\n'), { flag: 'wx', mode: 0o600 });
    files.set(name, fullPath);
    response.status(201).json({ file: name });
  });

  admin.get('/download', (request, response) => {
    const name = request.query.file;
    const file = typeof name === 'string' ? files.get(name) : undefined;
    if (!file) {
      response.sendStatus(404);
      return;
    }
    response.download(file);
  });

  admin.post('/compress', async (request, response) => {
    const name = request.body?.name ?? 'exportacoes';
    if (typeof name !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(name)) throw new InputError('Nome inválido.');
    const archive = `${name}-${randomUUID()}.tgz`;
    const fullPath = path.join(await archiveDirectory, archive);
    await runFile('tar', ['-czf', fullPath, '-C', await directory, '.'], { timeout: 15000 });
    files.set(archive, fullPath);
    response.json({ archive, stdout: '' });
  });

  admin.post('/formula', (request, response) => {
    response.json({ result: calculate(request.body?.expression, request.body?.preco) });
  });

  admin.post('/webhook-test', async (request, response) => {
    const host = process.env.WEBHOOK_HOST;
    if (!host || !/^[a-z0-9.-]+$/i.test(host) || request.body?.host !== host) {
      throw new InputError('Host fora da configuração do webhook.');
    }
    const result = await fetch(`https://${host}/webhook`, {
      method: 'HEAD', redirect: 'error', signal: AbortSignal.timeout(3000)
    });
    response.json({ status: result.status });
  });

  admin.get('/settings', (_request, response) => { response.json(preferences); });
  admin.put('/settings', (request, response) => {
    const { key, path: settingPath, value } = request.body ?? {};
    const fields = [key, settingPath].filter(field => field !== undefined);
    if (!fields.length || typeof value !== 'string' || value.length > 32 ||
        !fields.every(field => field === 'currency' || field === 'locale')) {
      throw new InputError('Informe currency ou locale e um valor de até 32 caracteres.');
    }
    if (fields.includes('currency')) preferences.currency = value;
    if (fields.includes('locale')) preferences.locale = value;
    response.json(preferences);
  });
  return admin;
}
