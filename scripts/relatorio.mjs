// Gera um resumo mensal de vendas consultando a API local.
// Uso: node scripts/relatorio.mjs --url http://127.0.0.1:8080 [--config scripts/relatorio.ini]
import fs from 'fs';
import _ from 'lodash';
import ini from 'ini';
import minimist from 'minimist';
import moment from 'moment';
import fetch from 'node-fetch';

const args = minimist(process.argv.slice(2), { string: ['url', 'config'], default: { url: 'http://127.0.0.1:8080' } });
const config = args.config ? ini.parse(fs.readFileSync(args.config, 'utf-8')) : {};
const baseUrl = config.api?.url ?? args.url;

const response = await fetch(`${baseUrl}/api/sales`);
if (!response.ok) {
  console.error(`Falha ao consultar a API (HTTP ${response.status}).`);
  process.exit(1);
}
const sales = await response.json();

const byMonth = _.groupBy(sales, sale => moment(sale.soldOn).format('YYYY-MM'));
for (const month of Object.keys(byMonth).sort()) {
  const cents = _.sumBy(byMonth[month], sale => sale.quantity * sale.unitPriceCents);
  console.log(`${month}: ${byMonth[month].length} venda(s), R$ ${(cents / 100).toFixed(2)}`);
}
