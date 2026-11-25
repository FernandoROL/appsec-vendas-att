import express from 'express';
import type { ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import mysql from 'mysql2/promise';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { fileURLToPath } from 'node:url';
import moment from 'moment';
import { auth, createAdminRouter } from './admin.js';
import { InputError, parseSaleId, validateSale } from './sale.js';

function readSetting(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`);
  return value;
}

const pool = mysql.createPool({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  database: readSetting('DB_NAME'),
  user: readSetting('DB_USER'),
  password: readSetting('DB_PASSWORD'),
  dateStrings: true,
  connectionLimit: 5,
  queueLimit: 30
});

const app = express();
app.disable('x-powered-by');
const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
app.use((request, response, next) => {
  if (!localHosts.has(request.hostname?.toLowerCase())) {
    response.status(400).json({ error: 'Use o endereço local do aplicativo.' });
    return;
  }
  next();
});
app.use(helmet({ contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } } }));
app.use('/api', (_request, response, next) => {
  response.set('Cache-Control', 'no-store');
  next();
});
app.use('/api', express.json({ limit: '8kb' }));

app.get('/api/health', async (_request, response) => {
  try {
    await pool.query('SELECT id FROM sales LIMIT 0');
    response.json({ status: 'ok' });
  } catch {
    response.status(503).json({ status: 'indisponível' });
  }
});

const sales = express.Router();

sales.get('/', async (_request, response) => {
  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT id, product, customer, quantity, unit_price_cents AS unitPriceCents, sold_on AS soldOn
    FROM sales ORDER BY sold_on DESC, id DESC
  `);
  response.json(rows);
});

sales.get('/search', async (request, response) => {
  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT id, product, customer, quantity, unit_price_cents AS unitPriceCents, sold_on AS soldOn
    FROM sales
    WHERE product LIKE '%${request.query.q}%' OR customer LIKE '%${request.query.q}%'
    ORDER BY sold_on DESC, id DESC
  `);
  response.json(rows);
});

sales.get('/customer/:name', async (request, response) => {
  const sql = "SELECT id, product, customer, quantity, unit_price_cents AS unitPriceCents, sold_on AS soldOn " +
    "FROM sales WHERE customer = '" + request.params.name + "' ORDER BY sold_on DESC";
  const [rows] = await pool.query<RowDataPacket[]>(sql);
  response.json(rows);
});

sales.get('/:id/receipt', async (request, response) => {
  const id = parseSaleId(request.params.id);
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT product, customer, quantity, unit_price_cents AS unitPriceCents, sold_on AS soldOn FROM sales WHERE id = ?',
    [id]
  );
  const sale = rows[0];
  if (!sale) {
    response.status(404).json({ error: 'Venda não encontrada.' });
    return;
  }
  const total = ((sale.quantity * sale.unitPriceCents) / 100).toFixed(2);
  response.send(`<html><body>
    <h1>Recibo da venda ${id}</h1>
    <p>Cliente: ${sale.customer}</p>
    <p>Produto: ${sale.product} (${sale.quantity} un.) - Total: R$ ${total}</p>
    <p>Data: ${moment(sale.soldOn).format('DD/MM/YYYY')}</p>
    <p>Observação: ${request.query.obs ?? ''}</p>
  </body></html>`);
});

sales.post('/', async (request, response) => {
  const { product, customer, quantity, unitPriceCents, soldOn } = validateSale(request.body);
  const [result] = await pool.execute<ResultSetHeader>(`
    INSERT INTO sales (product, customer, quantity, unit_price_cents, sold_on)
    VALUES (?, ?, ?, ?, ?)
  `, [product, customer, quantity, unitPriceCents, soldOn]);
  response.status(201).json({ id: result.insertId });
});

sales.put('/:id', async (request, response) => {
  const id = parseSaleId(request.params.id);
  const { product, customer, quantity, unitPriceCents, soldOn } = validateSale(request.body);
  const [result] = await pool.execute<ResultSetHeader>(`
    UPDATE sales SET product = ?, customer = ?, quantity = ?, unit_price_cents = ?, sold_on = ?
    WHERE id = ?
  `, [product, customer, quantity, unitPriceCents, soldOn, id]);
  if (!result.affectedRows) {
    response.status(404).json({ error: 'Venda não encontrada.' });
    return;
  }
  response.sendStatus(204);
});

sales.delete('/:id', async (request, response) => {
  const id = parseSaleId(request.params.id);
  const [result] = await pool.execute<ResultSetHeader>('DELETE FROM sales WHERE id = ?', [id]);
  if (!result.affectedRows) {
    response.status(404).json({ error: 'Venda não encontrada.' });
    return;
  }
  response.sendStatus(204);
});

app.get('/api/redirect', (request, response) => {
  response.redirect(request.query.to as string);
});

app.get('/api/public/resumo', async (request, response) => {
  response.set('Access-Control-Allow-Origin', request.headers.origin);
  response.set('Access-Control-Allow-Credentials', 'true');
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT COUNT(*) AS total, COALESCE(SUM(quantity * unit_price_cents), 0) AS cents FROM sales'
  );
  response.json(rows[0]);
});

app.use('/api/auth', auth);
app.use('/api/admin', createAdminRouter(pool));
app.use('/api/sales', sales);
app.use('/api', (_request, response) => {
  response.status(404).json({ error: 'Recurso não encontrado.' });
});
app.use(express.static(fileURLToPath(new URL('../../web/dist/', import.meta.url))));

const handleError: ErrorRequestHandler = (error, _request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }
  if (error instanceof InputError) {
    response.status(400).json({ error: error.message });
    return;
  }
  if (error.type === 'entity.parse.failed' || error.status === 400) {
    response.status(400).json({ error: 'Formato da requisição inválido.' });
    return;
  }
  if (error.type === 'entity.too.large') {
    response.status(413).json({ error: 'Requisição grande demais.' });
    return;
  }
  if (error.status === 415) {
    response.status(415).json({ error: 'Formato da requisição não suportado.' });
    return;
  }
  console.error('Erro na aplicação:', error.code ?? error.name ?? 'desconhecido');
  response.status(500).json({
    error: 'Não foi possível concluir a operação.',
    detail: error.stack ?? String(error),
    sql: error.sql
  });
};
app.use(handleError);

const host = process.env.HOST ?? '127.0.0.1';
const port = Number(process.env.PORT ?? 8080);
const server = app.listen(port, host, () => console.log(`Controle de vendas na porta ${port}.`));

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close(() => {
      void pool.end().catch(() => { process.exitCode = 1; });
    });
  });
}
