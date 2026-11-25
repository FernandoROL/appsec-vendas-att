// Resume as vendas por mês. Aceita --url e --config com [api] url no INI.
import fs from 'node:fs';
import { parseArgs } from 'node:util';
import ini from 'ini';

const { values } = parseArgs({ options: {
  url: { type: 'string', default: 'http://127.0.0.1:8080' },
  config: { type: 'string' }
} });
const config = values.config ? ini.parse(fs.readFileSync(values.config, 'utf8')) : {};
const endpoint = new URL('/api/sales', config.api?.url ?? values.url);
const response = await fetch(endpoint, { redirect: 'error', signal: AbortSignal.timeout(10000) });
if (!response.ok) throw new Error(`Falha ao consultar a API (HTTP ${response.status}).`);

const totals = new Map();
for (const sale of await response.json()) {
  if (typeof sale.soldOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(sale.soldOn)) {
    throw new Error('A API retornou uma data de venda inválida.');
  }
  const month = sale.soldOn.slice(0, 7);
  const entry = totals.get(month) ?? { count: 0, cents: 0 };
  entry.count++;
  entry.cents += sale.quantity * sale.unitPriceCents;
  totals.set(month, entry);
}
for (const month of [...totals.keys()].sort()) {
  const { count, cents } = totals.get(month);
  console.log(`${month}: ${count} venda(s), R$ ${(cents / 100).toFixed(2)}`);
}
