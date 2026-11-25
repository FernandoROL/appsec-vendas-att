// Executar somente com a instância isolada do job de demonstração.
import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
const capture = promisify(execFile);

const base = 'http://127.0.0.1:8080';
async function api(method, route, status, body, token) {
  const res = await fetch(base + route, { method, redirect: 'manual', headers: {
    'Content-Type': 'application/json', Connection: 'close', ...(token ? { Authorization: 'Bearer ' + token } : {})
  }, body: body === undefined ? undefined : JSON.stringify(body) });
  assert.equal(res.status, status, method + ' ' + route.split('?')[0]);
  console.log(method, route.split('?')[0], res.status);
  return res;
}

assert.equal((await (await api('GET','/api/health',200)).json()).status,'ok');
const sale = { product: 'Cabo USB', customer: "Ana D'Ávila", quantity: 2, unitPriceCents: 2590, soldOn: '2026-11-25' };
const { id } = await (await api('POST','/api/sales',201,sale)).json();
try {
  assert.equal((await (await api('GET','/api/sales',200)).json()).some(s => s.id === id), true);
  await api('PUT','/api/sales/' + id,204,{ ...sale, quantity: 3 });
  const search = await (await api('GET','/api/sales/search?q=' + encodeURIComponent(sale.customer),200)).json();
  assert.equal(search.find(s => s.id === id).quantity, 3);
  assert.ok((await (await api('GET','/api/sales/customer/' + encodeURIComponent(sale.customer),200)).json()).some(s => s.id === id));
  const receipt = await api('GET',`/api/sales/${id}/receipt`,200);
  assert.match(receipt.headers.get('content-type'),/^text\/plain/);
  assert.match(await receipt.text(),/77\.70/);
  const summary = await api('GET','/api/public/resumo',200);
  assert.equal(Number((await summary.json()).cents),7770);
  const cli = execFileSync(process.execPath,['scripts/relatorio.mjs','--url',base],{encoding:'utf8'});
  assert.match(cli,/2026-11: 1 venda\(s\), R\$ 77\.70/);
  console.log(cli.trim());
  await api('GET','/api/admin/settings',401);
  const { token } = await (await api('POST','/api/auth/login',200,{username:'admin',password:process.env.ADMIN_PASSWORD})).json();
  assert.equal((await (await api('POST','/api/admin/formula',200,{expression:'preco * (1 - 0.1)',preco:100},token)).json()).result,90);
  await api('POST','/api/admin/formula',400,{expression:'desconhecido'},token);
  await api('PUT','/api/admin/settings',400,{key:'tema',value:'claro'},token);
  await api('PUT','/api/admin/settings',200,{key:'locale',value:'pt-BR'},token);
  const csv = await (await api('POST','/api/admin/export',201,{},token)).json();
  assert.match(await (await api('GET','/api/admin/download?file=' + csv.file,200,undefined,token)).text(),/Cabo USB/);
  const tgz = await (await api('POST','/api/admin/compress',200,{name:'demonstracao'},token)).json();
  assert.ok((await (await api('GET','/api/admin/download?file=' + tgz.archive,200,undefined,token)).arrayBuffer()).byteLength > 0);
  await api('GET','/api/admin/download?file=inexistente.csv',404,undefined,token);
  await api('POST','/api/admin/webhook-test',400,{host:'invalido.example'},token);
  const originCheck = await fetch(base + '/api/public/resumo',{ headers:{Origin:'https://example.org'} });
  assert.equal(originCheck.headers.get('access-control-allow-origin'),null);
  await api('GET','/api/redirect?to=invalido',400);
  assert.equal((await api('GET','/api/redirect?to=%2F',302)).headers.get('location'),'/');
  const chrome = process.env.DEMO_CHROME;
  if (chrome) {
    await capture(chrome,['--headless','--disable-gpu','--disable-dev-shm-usage','--hide-scrollbars',
      '--user-data-dir=/tmp/vendas-chrome','--window-size=1380,900','--virtual-time-budget=6000',
      '--screenshot=demonstracao.png',base],{timeout: 60000});
  }
} finally {
  await api('DELETE','/api/sales/' + id,204);
}
assert.equal((await (await api('GET','/api/sales',200)).json()).length,0);
console.log('Venda fictícia cadastrada, alterada, consultada e excluída. Total após edição: R$ 77,70.');
