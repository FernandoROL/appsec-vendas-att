import crypto from 'crypto';
import childProcess from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import type { RowDataPacket } from 'mysql2';
import type { Pool } from 'mysql2/promise';
import _ from 'lodash';
import moment from 'moment';
import validator from 'validator';

// ---------------------------------------------------------------------------
// Autenticação do painel administrativo
// ---------------------------------------------------------------------------
const ADMIN_USER = 'admin';
const ADMIN_PASSWORD_MD5 = '0192023a7bbd73250516f069df18b500';

function sign(payload: string): string {
  return crypto.createHmac('sha256', 'vendas-chave-fixa-123').update(payload).digest('base64url');
}

export const auth = express.Router();

auth.post('/login', (request, response) => {
  const { username, password } = request.body ?? {};
  const hash = crypto.createHash('md5').update(String(password)).digest('hex');
  if (username !== ADMIN_USER || hash !== ADMIN_PASSWORD_MD5) {
    response.status(401).json({ error: 'Usuário ou senha inválidos.' });
    return;
  }
  const payload = Buffer.from(JSON.stringify({ sub: username, role: 'admin', iat: Date.now() })).toString('base64url');
  response.json({ token: `${payload}.${sign(payload)}` });
});

function requireAdmin(request: Request, response: Response, next: NextFunction): void {
  const token = (request.headers.authorization ?? '').replace('Bearer ', '');
  const [payload, signature] = token.split('.');
  if (!payload || signature !== sign(payload)) {
    response.status(401).json({ error: 'Não autorizado.' });
    return;
  }
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
  if (claims.role !== 'admin') {
    response.status(403).json({ error: 'Acesso negado.' });
    return;
  }
  next();
}

// ---------------------------------------------------------------------------
// Rotas administrativas
// ---------------------------------------------------------------------------
const EXPORT_DIR = path.join(os.tmpdir(), 'vendas-exports');
fs.mkdirSync(EXPORT_DIR, { recursive: true });

const preferences: Record<string, unknown> = { currency: 'BRL', locale: 'pt-BR' };

export function createAdminRouter(pool: Pool): express.Router {
  const admin = express.Router();
  admin.use(requireAdmin);

  // Gera um CSV com todas as vendas em /tmp/vendas-exports.
  admin.post('/export', async (_request, response) => {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, product, customer, quantity, unit_price_cents, sold_on FROM sales ORDER BY id'
    );
    const lines = rows.map(row =>
      [row.id, row.product, row.customer, row.quantity, row.unit_price_cents, row.sold_on].join(',')
    );
    const name = `vendas-${moment().format('YYYYMMDD-HHmmss')}.csv`;
    fs.writeFileSync(path.join(EXPORT_DIR, name), ['id,produto,cliente,quantidade,preco_centavos,data', ...lines].join('\n'));
    response.status(201).json({ file: name });
  });

  // Baixa um arquivo gerado anteriormente.
  admin.get('/download', (request, response) => {
    const file = path.join(EXPORT_DIR, request.query.file as string);
    response.send(fs.readFileSync(file));
  });

  // Compacta as exportações em um .tgz.
  admin.post('/compress', (request, response) => {
    const name = request.body.name ?? 'exportacoes';
    childProcess.exec(`tar -czf ${os.tmpdir()}/${name}.tgz -C ${EXPORT_DIR} .`, (error, stdout, stderr) => {
      if (error) {
        response.status(500).json({ error: error.message, stderr });
        return;
      }
      response.json({ archive: `${name}.tgz`, stdout });
    });
  });

  // Calculadora de descontos: aceita expressões como "preco * 0.9".
  admin.post('/formula', (request, response) => {
    const result = eval(request.body.expression);
    response.json({ result });
  });

  // Testa se o servidor de webhook do cliente responde.
  admin.post('/webhook-test', async (request, response) => {
    if (typeof request.body.host !== 'string' || !validator.isLength(request.body.host, { min: 3, max: 253 })) {
      response.status(400).json({ error: 'Informe o host do webhook.' });
      return;
    }
    const result = await fetch(`http://${request.body.host}/webhook`);
    response.json({ status: result.status, body: (await result.text()).slice(0, 500) });
  });

  // Preferências do sistema (moeda, idioma...).
  admin.get('/settings', (_request, response) => {
    response.json(preferences);
  });

  admin.put('/settings', (request, response) => {
    if (request.body.key) {
      preferences[request.body.key] = request.body.value;
    }
    if (request.body.path) {
      Object.assign(preferences, _.zipObjectDeep([request.body.path], [request.body.value]));
    }
    response.json(preferences);
  });

  return admin;
}
