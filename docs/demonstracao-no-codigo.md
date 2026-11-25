# Demonstração das correções no código do CRUD de vendas

Abra cada ligação para comparar a linha publicada na versão vulnerável (53ec73f) com a linha corrigida (0150da8). Os blocos são recortes do fonte, com a indentação externa removida. A chave administrativa antiga está ocultada.

Na apresentação de cinco minutos, uma sequência possível é **S4** para explicar a mudança no código e **C2** para mostrar uma correção de versão. Os outros casos permitem responder a perguntas do professor.

[Scan inicial #6](https://github.com/FernandoROL/appsec-vendas-att/actions/runs/45570628750) · [Scan corrigido #8](https://github.com/FernandoROL/appsec-vendas-att/actions/runs/45574100921) · [Demonstração com MySQL](https://github.com/FernandoROL/appsec-vendas-att/actions/runs/45574100901)

## Navegação para a apresentação

- [S1 · Assinatura com chave fixa](#caso-s1)
- [S2 · Senha administrativa verificada com MD5](#caso-s2)
- [S3 · Download fora do diretório de exportações](#caso-s3)
- [S4 · Execução de código na fórmula de desconto](#caso-s4)
- [S5 · Comando de compactação interpretado pelo shell](#caso-s5)
- [C1 · Lodash e alteração de propriedades profundas](#caso-c1)
- [C2 · Versão vulnerável do parser INI](#caso-c2)
- [C3 · Minimist no relatório de linha de comando](#caso-c3)
- [C4 · Moment e datas de origem externa](#caso-c4)
- [A1 · Injeção de SQL na busca por produto ou cliente](#caso-a1)
- [A2 · Injeção de SQL no filtro por cliente](#caso-a2)
- [A3 · Conteúdo interpretado como HTML no recibo](#caso-a3)
- [A4 · HTML injetado no rótulo de busca do React](#caso-a4)
- [A5 · Redirecionamento para destino arbitrário](#caso-a5)
- [A6 · CORS com origem refletida e credenciais](#caso-a6)
- [A7 · Privilégios do processo no contêiner](#caso-a7)
- [A8 · Destino do webhook e remoção de validator](#caso-a8)
- [A9 · Detalhes internos nas respostas de erro](#caso-a9)
- [A10 · Células de exportação CSV](#caso-a10)
- [A11 · Axios e a dependência transitiva follow-redirects](#caso-a11)
- [A12 · Cliente HTTP do relatório mensal](#caso-a12)
- [A13 · Pacotes sem uso direto no CRUD](#caso-a13)

<a id="caso-s1"></a>

## S1 · Assinatura com chave fixa

**Antes**

[server/admin.ts · L24 (valor da chave omitido)](https://github.com/FernandoROL/appsec-vendas-att/blob/53ec73fa03d3cc9d4e3aa76174da53c8ff9a5ea7/server/admin.ts#L24)

```ts
return crypto.createHmac('sha256', '[chave omitida]').update(payload).digest('base64url');
```

**Depois**

[server/admin.ts · L48–49](https://github.com/FernandoROL/appsec-vendas-att/blob/0150da83573d63dc3b3c78c5af7ade6f96c7a7c3/server/admin.ts#L48-L49)

```ts
const token = randomBytes(32).toString('base64url');
sessions.set(token, Date.now() + 30 * 60_000);
```

[server/admin.ts · L58](https://github.com/FernandoROL/appsec-vendas-att/blob/0150da83573d63dc3b3c78c5af7ade6f96c7a7c3/server/admin.ts#L58)

```ts
if (!token || (sessions.get(token) ?? 0) <= Date.now()) {
```

O servidor trocou o token assinado com uma chave embutida por 32 bytes aleatórios. Guarda a validade no Map de sessões e confere o vencimento a cada pedido.

**Na demonstração.** Aponte o mesmo token em sessions.set e sessions.get. O teste do painel mostra 401 sem sessão e 200 após o login.

<a id="caso-s2"></a>

## S2 · Senha administrativa verificada com MD5

**Antes**

[server/admin.ts · L31–32](https://github.com/FernandoROL/appsec-vendas-att/blob/53ec73fa03d3cc9d4e3aa76174da53c8ff9a5ea7/server/admin.ts#L31-L32)

```ts
const hash = crypto.createHash('md5').update(String(password)).digest('hex');
if (username !== ADMIN_USER || hash !== ADMIN_PASSWORD_MD5) {
```

**Depois**

[server/admin.ts · L16–18](https://github.com/FernandoROL/appsec-vendas-att/blob/0150da83573d63dc3b3c78c5af7ade6f96c7a7c3/server/admin.ts#L16-L18)

```ts
const salt = randomBytes(16);
const configured = process.env.ADMIN_PASSWORD;
const expected = configured && configured.length >= 16 ? scryptSync(configured, salt, 64) : null;
```

[server/admin.ts · L39–40](https://github.com/FernandoROL/appsec-vendas-att/blob/0150da83573d63dc3b3c78c5af7ade6f96c7a7c3/server/admin.ts#L39-L40)

```ts
const actual = await derive(password, salt, expected.length) as Buffer;
if (!timingSafeEqual(actual, expected)) {
```

O valor de referência passou a ser derivado da senha configurada por instalação, com scrypt e sal aleatório. A senha recebida passa pela mesma derivação e os dois resultados são comparados em tempo constante.

**Na demonstração.** Mostre onde ADMIN_PASSWORD entra na inicialização e onde a senha digitada é verificada. Sem a configuração mínima, a rota de login responde 503.

<a id="caso-s3"></a>

## S3 · Download fora do diretório de exportações

**Antes**

[server/admin.ts · L82–83](https://github.com/FernandoROL/appsec-vendas-att/blob/53ec73fa03d3cc9d4e3aa76174da53c8ff9a5ea7/server/admin.ts#L82-L83)

```ts
const file = path.join(EXPORT_DIR, request.query.file as string);
response.send(fs.readFileSync(file));
```

**Depois**

[server/admin.ts · L89](https://github.com/FernandoROL/appsec-vendas-att/blob/0150da83573d63dc3b3c78c5af7ade6f96c7a7c3/server/admin.ts#L89)

```ts
files.set(name, fullPath);
```

[server/admin.ts · L95](https://github.com/FernandoROL/appsec-vendas-att/blob/0150da83573d63dc3b3c78c5af7ade6f96c7a7c3/server/admin.ts#L95)

```ts
const file = typeof name === 'string' ? files.get(name) : undefined;
```

[server/admin.ts · L97](https://github.com/FernandoROL/appsec-vendas-att/blob/0150da83573d63dc3b3c78c5af7ade6f96c7a7c3/server/admin.ts#L97)

```ts
response.sendStatus(404);
```

[server/admin.ts · L100](https://github.com/FernandoROL/appsec-vendas-att/blob/0150da83573d63dc3b3c78c5af7ade6f96c7a7c3/server/admin.ts#L100)

```ts
response.download(file);
```

O nome recebido passou a selecionar um caminho no registro de arquivos emitidos. Somente uma exportação ou compactação concluída registra um caminho que a API poderá devolver.

**Na demonstração.** Compare o CSV recém-gerado, que retornou 200, com inexistente.csv, que retornou 404 na demonstração.

<a id="caso-s4"></a>

## S4 · Execução de código na fórmula de desconto

**Antes**

[server/admin.ts · L100](https://github.com/FernandoROL/appsec-vendas-att/blob/53ec73fa03d3cc9d4e3aa76174da53c8ff9a5ea7/server/admin.ts#L100)

```ts
const result = eval(request.body.expression);
```

**Depois**

[server/admin.ts · L114](https://github.com/FernandoROL/appsec-vendas-att/blob/0150da83573d63dc3b3c78c5af7ade6f96c7a7c3/server/admin.ts#L114)

```ts
response.json({ result: calculate(request.body?.expression, request.body?.preco) });
```

[server/formula.ts · L18–19](https://github.com/FernandoROL/appsec-vendas-att/blob/0150da83573d63dc3b3c78c5af7ade6f96c7a7c3/server/formula.ts#L18-L19)

```ts
if (token === 'preco' && typeof price === 'number' && Number.isFinite(price)) return price;
if (!token || !/^\d+(?:\.\d+)?$/.test(token)) throw invalid();
```

[server/formula.ts · L41](https://github.com/FernandoROL/appsec-vendas-att/blob/0150da83573d63dc3b3c78c5af7ade6f96c7a7c3/server/formula.ts#L41)

```ts
if (position !== tokens.length || !Number.isFinite(result)) throw invalid();
```

A rota removeu eval e delegou a conta a um parser aritmético. Ele reconhece números, preco, parênteses e quatro operadores, exige o consumo de toda a expressão e valida o resultado.

**Na demonstração.** Abra calculate e siga a expressão preco * (1 - 0.1). Com preco igual a 100 o teste obteve 90. O nome desconhecido retornou 400.

<a id="caso-s5"></a>

## S5 · Comando de compactação interpretado pelo shell

**Antes**

[server/admin.ts · L88–89](https://github.com/FernandoROL/appsec-vendas-att/blob/53ec73fa03d3cc9d4e3aa76174da53c8ff9a5ea7/server/admin.ts#L88-L89)

```ts
const name = request.body.name ?? 'exportacoes';
childProcess.exec(`tar -czf ${os.tmpdir()}/${name}.tgz -C ${EXPORT_DIR} .`, (error, stdout, stderr) => {
```

**Depois**

[server/admin.ts · L15](https://github.com/FernandoROL/appsec-vendas-att/blob/0150da83573d63dc3b3c78c5af7ade6f96c7a7c3/server/admin.ts#L15)

```ts
const runFile = promisify(execFile);
```

[server/admin.ts · L105](https://github.com/FernandoROL/appsec-vendas-att/blob/0150da83573d63dc3b3c78c5af7ade6f96c7a7c3/server/admin.ts#L105)

```ts
if (typeof name !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(name)) throw new InputError('Nome inválido.');
```

[server/admin.ts · L108](https://github.com/FernandoROL/appsec-vendas-att/blob/0150da83573d63dc3b3c78c5af7ade6f96c7a7c3/server/admin.ts#L108)

```ts
await runFile('tar', ['-czf', fullPath, '-C', await directory, '.'], { timeout: 15000 });
```

execFile recebe o programa tar e uma lista de argumentos. O nome do arquivo aceita até 64 letras, dígitos, hífens ou sublinhados e recebe um identificador único antes da chamada.

**Na demonstração.** Aponte tar como executável fixo e fullPath como argumento separado. O teste gerou o arquivo e confirmou que o download tinha conteúdo.

<a id="caso-c1"></a>

## C1 · Lodash e alteração de propriedades profundas

**Antes**

[package.json · L18](https://github.com/FernandoROL/appsec-vendas-att/blob/53ec73fa03d3cc9d4e3aa76174da53c8ff9a5ea7/package.json#L18)

```json
"lodash": "4.17.15",
```

[server/admin.ts · L121](https://github.com/FernandoROL/appsec-vendas-att/blob/53ec73fa03d3cc9d4e3aa76174da53c8ff9a5ea7/server/admin.ts#L121)

```ts
preferences[request.body.key] = request.body.value;
```

[server/admin.ts · L124](https://github.com/FernandoROL/appsec-vendas-att/blob/53ec73fa03d3cc9d4e3aa76174da53c8ff9a5ea7/server/admin.ts#L124)

```ts
Object.assign(preferences, _.zipObjectDeep([request.body.path], [request.body.value]));
```

**Depois**

[server/admin.ts · L133](https://github.com/FernandoROL/appsec-vendas-att/blob/0150da83573d63dc3b3c78c5af7ade6f96c7a7c3/server/admin.ts#L133)

```ts
!fields.every(field => field === 'currency' || field === 'locale')) {
```

[server/admin.ts · L136–137](https://github.com/FernandoROL/appsec-vendas-att/blob/0150da83573d63dc3b3c78c5af7ade6f96c7a7c3/server/admin.ts#L136-L137)

```ts
if (fields.includes('currency')) preferences.currency = value;
if (fields.includes('locale')) preferences.locale = value;
```

lodash 4.17.15 saiu do manifesto e do lockfile. As duas formas de entrada, key e path, agora passam por uma lista permitida. A escrita ocorre em propriedades explícitas.

**Na demonstração.** Abra as atribuições a currency e locale. Os testes mostram locale aceito e tema recusado. O advisory é GHSA-p6mc-m468-83gw.

<a id="caso-c2"></a>

## C2 · Versão vulnerável do parser INI

**Antes**

[package-lock.json · L1579–1580](https://github.com/FernandoROL/appsec-vendas-att/blob/53ec73fa03d3cc9d4e3aa76174da53c8ff9a5ea7/package-lock.json#L1579-L1580)

```json
"node_modules/ini": {
"version": "1.3.5",
```

[scripts/relatorio.mjs · L11](https://github.com/FernandoROL/appsec-vendas-att/blob/53ec73fa03d3cc9d4e3aa76174da53c8ff9a5ea7/scripts/relatorio.mjs#L11)

```js
const config = args.config ? ini.parse(fs.readFileSync(args.config, 'utf-8')) : {};
```

**Depois**

[package-lock.json · L1540–1541](https://github.com/FernandoROL/appsec-vendas-att/blob/0150da83573d63dc3b3c78c5af7ade6f96c7a7c3/package-lock.json#L1540-L1541)

```json
"node_modules/ini": {
"version": "5.0.0",
```

[scripts/relatorio.mjs · L10](https://github.com/FernandoROL/appsec-vendas-att/blob/0150da83573d63dc3b3c78c5af7ade6f96c7a7c3/scripts/relatorio.mjs#L10)

```js
const config = values.config ? ini.parse(fs.readFileSync(values.config, 'utf8')) : {};
```

O manifesto e o lockfile passaram de ini 1.3.5 para 5.0.0. A aplicação continua chamando ini.parse quando o operador usa --config. A atualização do pacote elimina o advisory selecionado.

**Na demonstração.** Mostre a versão resolvida nos dois lockfiles. O teste com uma configuração [api] leu a URL e calculou R$ 77,70. Advisory GHSA-qqgx-2p2h-9c37.

<a id="caso-c3"></a>

## C3 · Minimist no relatório de linha de comando

**Antes**

[package.json · L19](https://github.com/FernandoROL/appsec-vendas-att/blob/53ec73fa03d3cc9d4e3aa76174da53c8ff9a5ea7/package.json#L19)

```json
"minimist": "1.2.5",
```

[scripts/relatorio.mjs · L10](https://github.com/FernandoROL/appsec-vendas-att/blob/53ec73fa03d3cc9d4e3aa76174da53c8ff9a5ea7/scripts/relatorio.mjs#L10)

```js
const args = minimist(process.argv.slice(2), { string: ['url', 'config'], default: { url: 'http://127.0.0.1:8080' } });
```

**Depois**

[scripts/relatorio.mjs · L3](https://github.com/FernandoROL/appsec-vendas-att/blob/0150da83573d63dc3b3c78c5af7ade6f96c7a7c3/scripts/relatorio.mjs#L3)

```js
import { parseArgs } from 'node:util';
```

[scripts/relatorio.mjs · L6–9](https://github.com/FernandoROL/appsec-vendas-att/blob/0150da83573d63dc3b3c78c5af7ade6f96c7a7c3/scripts/relatorio.mjs#L6-L9)

```js
const { values } = parseArgs({ options: {
url: { type: 'string', default: 'http://127.0.0.1:8080' },
config: { type: 'string' }
} });
```

minimist 1.2.5 saiu do projeto. O CLI usa o parseArgs do Node e declara explicitamente as opções de texto url e config. Uma opção desconhecida interrompe o comando.

**Na demonstração.** Compare process.argv entregue ao parser antigo com o contrato das duas opções. A regressão verificou a recusa da opção desconhecida. Advisory GHSA-xvch-5gv4-984h.

<a id="caso-c4"></a>

## C4 · Moment e datas de origem externa

**Antes**

[package.json · L20](https://github.com/FernandoROL/appsec-vendas-att/blob/53ec73fa03d3cc9d4e3aa76174da53c8ff9a5ea7/package.json#L20)

```json
"moment": "2.29.1",
```

[scripts/relatorio.mjs · L21](https://github.com/FernandoROL/appsec-vendas-att/blob/53ec73fa03d3cc9d4e3aa76174da53c8ff9a5ea7/scripts/relatorio.mjs#L21)

```js
const byMonth = _.groupBy(sales, sale => moment(sale.soldOn).format('YYYY-MM'));
```

**Depois**

[scripts/relatorio.mjs · L17–18](https://github.com/FernandoROL/appsec-vendas-att/blob/0150da83573d63dc3b3c78c5af7ade6f96c7a7c3/scripts/relatorio.mjs#L17-L18)

```js
if (typeof sale.soldOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(sale.soldOn)) {
throw new Error('A API retornou uma data de venda inválida.');
```

[scripts/relatorio.mjs · L20](https://github.com/FernandoROL/appsec-vendas-att/blob/0150da83573d63dc3b3c78c5af7ade6f96c7a7c3/scripts/relatorio.mjs#L20)

```js
const month = sale.soldOn.slice(0, 7);
```

moment 2.29.1 saiu do projeto. O relatório valida o formato AAAA-MM-DD antes de extrair os sete caracteres de ano e mês. A API do CRUD valida separadamente a data de calendário.

**Na demonstração.** Mostre a guarda antes de slice. O CLI aceita uma API escolhida pelo operador. Na regressão, data fora do formato foi recusada. Advisory GHSA-wc69-rhjr-hc9g.

<a id="caso-a1"></a>

## A1 · Injeção de SQL na busca por produto ou cliente

**Antes**

[server/index.ts · L68](https://github.com/FernandoROL/appsec-vendas-att/blob/53ec73fa03d3cc9d4e3aa76174da53c8ff9a5ea7/server/index.ts#L68)

```ts
WHERE product LIKE '%${request.query.q}%' OR customer LIKE '%${request.query.q}%'
```

**Depois**

[server/index.ts · L66–67](https://github.com/FernandoROL/appsec-vendas-att/blob/0150da83573d63dc3b3c78c5af7ade6f96c7a7c3/server/index.ts#L66-L67)

```ts
const pattern = '%' + term.replace(/[!%_]/g, '!$&') + '%';
const [rows] = await pool.execute<RowDataPacket[]>(`
```

[server/index.ts · L69](https://github.com/FernandoROL/appsec-vendas-att/blob/0150da83573d63dc3b3c78c5af7ade6f96c7a7c3/server/index.ts#L69)

```ts
FROM sales WHERE product LIKE ? ESCAPE '!' OR customer LIKE ? ESCAPE '!'
```

[server/index.ts · L71](https://github.com/FernandoROL/appsec-vendas-att/blob/0150da83573d63dc3b3c78c5af7ade6f96c7a7c3/server/index.ts#L71)

```ts
`, [pattern, pattern]);
```

A consulta de busca usa dois parâmetros vinculados pelo driver. O padrão é montado em separado, e os caracteres especiais de LIKE são escapados para permitir pesquisa literal.

**Na demonstração.** Use a busca por Ana D’Ávila (com apóstrofo). Aponte os dois sinais de interrogação e os dois valores de pattern na chamada.

<a id="caso-a2"></a>

## A2 · Injeção de SQL no filtro por cliente

**Antes**

[server/index.ts · L76–77](https://github.com/FernandoROL/appsec-vendas-att/blob/53ec73fa03d3cc9d4e3aa76174da53c8ff9a5ea7/server/index.ts#L76-L77)

```ts
"FROM sales WHERE customer = '" + request.params.name + "' ORDER BY sold_on DESC";
const [rows] = await pool.query<RowDataPacket[]>(sql);
```

**Depois**

[server/index.ts · L76](https://github.com/FernandoROL/appsec-vendas-att/blob/0150da83573d63dc3b3c78c5af7ade6f96c7a7c3/server/index.ts#L76)

```ts
const [rows] = await pool.execute<RowDataPacket[]>(`
```

[server/index.ts · L78–79](https://github.com/FernandoROL/appsec-vendas-att/blob/0150da83573d63dc3b3c78c5af7ade6f96c7a7c3/server/index.ts#L78-L79)

```ts
FROM sales WHERE customer = ? ORDER BY sold_on DESC
`, [request.params.name]);
```

O filtro por cliente trocou a concatenação do nome por um parâmetro de igualdade em pool.execute. O driver recebe o nome inteiro como valor.

**Na demonstração.** Compare o sinal de interrogação com o array [request.params.name]. A demonstração localizou a venda pelo nome completo com apóstrofo.

<a id="caso-a3"></a>

## A3 · Conteúdo interpretado como HTML no recibo

**Antes**

[server/index.ts · L93](https://github.com/FernandoROL/appsec-vendas-att/blob/53ec73fa03d3cc9d4e3aa76174da53c8ff9a5ea7/server/index.ts#L93)

```ts
response.send(`<html><body>
```

[server/index.ts · L95](https://github.com/FernandoROL/appsec-vendas-att/blob/53ec73fa03d3cc9d4e3aa76174da53c8ff9a5ea7/server/index.ts#L95)

```ts
<p>Cliente: ${sale.customer}</p>
```

[server/index.ts · L98](https://github.com/FernandoROL/appsec-vendas-att/blob/53ec73fa03d3cc9d4e3aa76174da53c8ff9a5ea7/server/index.ts#L98)

```ts
<p>Observação: ${request.query.obs ?? ''}</p>
```

**Depois**

[server/index.ts · L96](https://github.com/FernandoROL/appsec-vendas-att/blob/0150da83573d63dc3b3c78c5af7ade6f96c7a7c3/server/index.ts#L96)

```ts
response.type('text/plain').send([
```

[server/index.ts · L98](https://github.com/FernandoROL/appsec-vendas-att/blob/0150da83573d63dc3b3c78c5af7ade6f96c7a7c3/server/index.ts#L98)

```ts
`Cliente: ${sale.customer}`,
```

[server/index.ts · L101](https://github.com/FernandoROL/appsec-vendas-att/blob/0150da83573d63dc3b3c78c5af7ade6f96c7a7c3/server/index.ts#L101)

```ts
`Observação: ${note}`
```

O recibo passou de HTML interpolado para uma resposta text/plain. Cliente, produto e observação são apresentados como texto. O ID numérico do título era o falso positivo pontual discutido na triagem.

**Na demonstração.** Abra o recibo e a verificação do Content-Type. O teste confirmou text/plain e o valor de R$ 77,70.

<a id="caso-a4"></a>

## A4 · HTML injetado no rótulo de busca do React

**Antes**

[web/src/main.tsx · L88](https://github.com/FernandoROL/appsec-vendas-att/blob/53ec73fa03d3cc9d4e3aa76174da53c8ff9a5ea7/web/src/main.tsx#L88)

```tsx
setSearchLabel(`Resultados para <strong>${query}</strong>`);
```

[web/src/main.tsx · L220](https://github.com/FernandoROL/appsec-vendas-att/blob/53ec73fa03d3cc9d4e3aa76174da53c8ff9a5ea7/web/src/main.tsx#L220)

```tsx
{searchLabel && <p className="search-label" dangerouslySetInnerHTML={{ __html: searchLabel }} />}
```

**Depois**

[web/src/main.tsx · L87](https://github.com/FernandoROL/appsec-vendas-att/blob/0150da83573d63dc3b3c78c5af7ade6f96c7a7c3/web/src/main.tsx#L87)

```tsx
setSearchLabel(query);
```

[web/src/main.tsx · L219](https://github.com/FernandoROL/appsec-vendas-att/blob/0150da83573d63dc3b3c78c5af7ade6f96c7a7c3/web/src/main.tsx#L219)

```tsx
{searchLabel && <p className="search-label">Resultados para <strong>{searchLabel}</strong></p>}
```

O estado agora guarda o termo digitado. O elemento strong faz parte do JSX e o React renderiza o termo como texto. A propriedade dangerouslySetInnerHTML foi removida.

**Na demonstração.** Compare o conteúdo de setSearchLabel nas duas versões. Na linha do JSX, destaque as chaves em torno de searchLabel.

<a id="caso-a5"></a>

## A5 · Redirecionamento para destino arbitrário

**Antes**

[server/index.ts · L136](https://github.com/FernandoROL/appsec-vendas-att/blob/53ec73fa03d3cc9d4e3aa76174da53c8ff9a5ea7/server/index.ts#L136)

```ts
response.redirect(request.query.to as string);
```

**Depois**

[server/index.ts · L139–140](https://github.com/FernandoROL/appsec-vendas-att/blob/0150da83573d63dc3b3c78c5af7ade6f96c7a7c3/server/index.ts#L139-L140)

```ts
if (request.query.to !== '/') throw new InputError('Destino inválido.');
response.redirect('/');
```

A rota passou a aceitar somente o destino previsto para a navegação local. O endereço fornecido pelo usuário deixou de compor o cabeçalho de redirecionamento.

**Na demonstração.** Mostre o teste do destino inválido (400) e a resposta 302 cujo cabeçalho Location contém a raiz da aplicação.

<a id="caso-a6"></a>

## A6 · CORS com origem refletida e credenciais

**Antes**

[server/index.ts · L140–141](https://github.com/FernandoROL/appsec-vendas-att/blob/53ec73fa03d3cc9d4e3aa76174da53c8ff9a5ea7/server/index.ts#L140-L141)

```ts
response.set('Access-Control-Allow-Origin', request.headers.origin);
response.set('Access-Control-Allow-Credentials', 'true');
```

**Depois**

[server/index.ts · L143](https://github.com/FernandoROL/appsec-vendas-att/blob/0150da83573d63dc3b3c78c5af7ade6f96c7a7c3/server/index.ts#L143)

```ts
app.get('/api/public/resumo', async (_request, response) => {
```

[server/index.ts · L147–148](https://github.com/FernandoROL/appsec-vendas-att/blob/0150da83573d63dc3b3c78c5af7ade6f96c7a7c3/server/index.ts#L147-L148)

```ts
response.json(rows[0]);
});
```

Os dois cabeçalhos CORS foram retirados da rota de resumo. A resposta continua entregando o agregado à interface da mesma origem. CORS determina se outra origem pode ler a resposta no navegador.

**Na demonstração.** Abra o teste originCheck em test/demo.mjs. Ele envia uma origem diferente e confere a ausência de Access-Control-Allow-Origin.

<a id="caso-a7"></a>

## A7 · Privilégios do processo no contêiner

**Antes**

[Dockerfile · L17–18](https://github.com/FernandoROL/appsec-vendas-att/blob/53ec73fa03d3cc9d4e3aa76174da53c8ff9a5ea7/Dockerfile#L17-L18)

```dockerfile
EXPOSE 8080
CMD ["node", "dist/server/index.js"]
```

**Depois**

[Dockerfile · L17–19](https://github.com/FernandoROL/appsec-vendas-att/blob/0150da83573d63dc3b3c78c5af7ade6f96c7a7c3/Dockerfile#L17-L19)

```dockerfile
USER node
EXPOSE 8080
CMD ["node", "dist/server/index.js"]
```

A instrução USER node foi inserida no estágio final, antes de CMD. O processo que atende as vendas passou a executar com o usuário node da imagem.

**Na demonstração.** Compare o fim dos Dockerfiles. O job de demonstração verificou que o UID do processo no contêiner era diferente de zero.

<a id="caso-a8"></a>

## A8 · Destino do webhook e remoção de validator

**Antes**

[server/admin.ts · L106](https://github.com/FernandoROL/appsec-vendas-att/blob/53ec73fa03d3cc9d4e3aa76174da53c8ff9a5ea7/server/admin.ts#L106)

```ts
if (typeof request.body.host !== 'string' || !validator.isLength(request.body.host, { min: 3, max: 253 })) {
```

[server/admin.ts · L110–111](https://github.com/FernandoROL/appsec-vendas-att/blob/53ec73fa03d3cc9d4e3aa76174da53c8ff9a5ea7/server/admin.ts#L110-L111)

```ts
const result = await fetch(`http://${request.body.host}/webhook`);
response.json({ status: result.status, body: (await result.text()).slice(0, 500) });
```

**Depois**

[server/admin.ts · L118–119](https://github.com/FernandoROL/appsec-vendas-att/blob/0150da83573d63dc3b3c78c5af7ade6f96c7a7c3/server/admin.ts#L118-L119)

```ts
const host = process.env.WEBHOOK_HOST;
if (!host || !/^[a-z0-9.-]+$/i.test(host) || request.body?.host !== host) {
```

[server/admin.ts · L122–123](https://github.com/FernandoROL/appsec-vendas-att/blob/0150da83573d63dc3b3c78c5af7ade6f96c7a7c3/server/admin.ts#L122-L123)

```ts
const result = await fetch(`https://${host}/webhook`, {
method: 'HEAD', redirect: 'error', signal: AbortSignal.timeout(3000)
```

[server/admin.ts · L125](https://github.com/FernandoROL/appsec-vendas-att/blob/0150da83573d63dc3b3c78c5af7ade6f96c7a7c3/server/admin.ts#L125)

```ts
response.json({ status: result.status });
```

A validação por comprimento foi substituída pela correspondência com o único host configurado pelo operador. A requisição usa HTTPS, HEAD, prazo de três segundos e rejeita redirecionamentos. A resposta expõe somente o status.

**Na demonstração.** Mostre de onde vem WEBHOOK_HOST. A execução registrou 400 para um host fora da configuração. A remoção de validator 13.6.0 também aparece no lockfile.

<a id="caso-a9"></a>

## A9 · Detalhes internos nas respostas de erro

**Antes**

[server/index.ts · L180–181](https://github.com/FernandoROL/appsec-vendas-att/blob/53ec73fa03d3cc9d4e3aa76174da53c8ff9a5ea7/server/index.ts#L180-L181)

```ts
detail: error.stack ?? String(error),
sql: error.sql
```

**Depois**

[server/index.ts · L179–180](https://github.com/FernandoROL/appsec-vendas-att/blob/0150da83573d63dc3b3c78c5af7ade6f96c7a7c3/server/index.ts#L179-L180)

```ts
console.error('Erro na aplicação:', error.code ?? error.name ?? 'desconhecido');
response.status(500).json({ error: 'Não foi possível concluir a operação.' });
```

A resposta 500 deixou de incluir a pilha e a consulta SQL. O servidor registra o código ou a categoria do erro localmente e retorna uma mensagem genérica ao cliente.

**Na demonstração.** Compare as duas saídas do tratador, o log local e o JSON enviado ao navegador. Este caso é demonstrado pela revisão do código.

<a id="caso-a10"></a>

## A10 · Células de exportação CSV

**Antes**

[server/admin.ts · L73](https://github.com/FernandoROL/appsec-vendas-att/blob/53ec73fa03d3cc9d4e3aa76174da53c8ff9a5ea7/server/admin.ts#L73)

```ts
[row.id, row.product, row.customer, row.quantity, row.unit_price_cents, row.sold_on].join(',')
```

**Depois**

[server/admin.ts · L67–68](https://github.com/FernandoROL/appsec-vendas-att/blob/0150da83573d63dc3b3c78c5af7ade6f96c7a7c3/server/admin.ts#L67-L68)

```ts
if (/^[=+@\-\t\r\n]/.test(text.trimStart()) || /^[\t\r\n]/.test(text)) text = "'" + text;
return '"' + text.replaceAll('"', '""') + '"';
```

[server/admin.ts · L84](https://github.com/FernandoROL/appsec-vendas-att/blob/0150da83573d63dc3b3c78c5af7ade6f96c7a7c3/server/admin.ts#L84)

```ts
[row.id, row.product, row.customer, row.quantity, row.unit_price_cents, row.sold_on].map(csvCell).join(',')
```

A exportação aplica csvCell a cada coluna. A função protege prefixos de fórmula tratados pelo código, duplica aspas internas e envolve cada campo em aspas.

**Na demonstração.** Mostre map(csvCell) antes de join. O teste de exportação verificou conteúdo e download. A lógica específica de escape pode ser mostrada na função csvCell.

<a id="caso-a11"></a>

## A11 · Axios e a dependência transitiva follow-redirects

**Antes**

[package.json · L14](https://github.com/FernandoROL/appsec-vendas-att/blob/53ec73fa03d3cc9d4e3aa76174da53c8ff9a5ea7/package.json#L14)

```json
"axios": "0.21.1",
```

[web/src/main.tsx · L86](https://github.com/FernandoROL/appsec-vendas-att/blob/53ec73fa03d3cc9d4e3aa76174da53c8ff9a5ea7/web/src/main.tsx#L86)

```tsx
const { data } = await axios.get<Sale[]>('/api/sales/search', { params: { q: query } });
```

**Depois**

[web/src/main.tsx · L40](https://github.com/FernandoROL/appsec-vendas-att/blob/0150da83573d63dc3b3c78c5af7ade6f96c7a7c3/web/src/main.tsx#L40)

```tsx
const response = await fetch(url, options);
```

[web/src/main.tsx · L85–86](https://github.com/FernandoROL/appsec-vendas-att/blob/0150da83573d63dc3b3c78c5af7ade6f96c7a7c3/web/src/main.tsx#L85-L86)

```tsx
const response = await request('/api/sales/search?' + new URLSearchParams({ q: query }));
setSales(await response.json());
```

A busca do navegador usa fetch por meio de request e codifica q com URLSearchParams. Axios 0.21.1 e sua dependência transitiva follow-redirects 1.13.0 saíram do lockfile.

**Na demonstração.** Abra os dois lockfiles e procure node_modules/axios e node_modules/follow-redirects. A mudança retirou os dois pacotes do grafo da aplicação.

<a id="caso-a12"></a>

## A12 · Cliente HTTP do relatório mensal

**Antes**

[scripts/relatorio.mjs · L8](https://github.com/FernandoROL/appsec-vendas-att/blob/53ec73fa03d3cc9d4e3aa76174da53c8ff9a5ea7/scripts/relatorio.mjs#L8)

```js
import fetch from 'node-fetch';
```

[scripts/relatorio.mjs · L14](https://github.com/FernandoROL/appsec-vendas-att/blob/53ec73fa03d3cc9d4e3aa76174da53c8ff9a5ea7/scripts/relatorio.mjs#L14)

```js
const response = await fetch(`${baseUrl}/api/sales`);
```

**Depois**

[scripts/relatorio.mjs · L11–12](https://github.com/FernandoROL/appsec-vendas-att/blob/0150da83573d63dc3b3c78c5af7ade6f96c7a7c3/scripts/relatorio.mjs#L11-L12)

```js
const endpoint = new URL('/api/sales', config.api?.url ?? values.url);
const response = await fetch(endpoint, { redirect: 'error', signal: AbortSignal.timeout(10000) });
```

A importação de node-fetch 2.6.0 foi removida. O CLI usa fetch nativo do Node 24, rejeita redirecionamentos e aplica um prazo de dez segundos.

**Na demonstração.** Compare a origem da função fetch. O teste do relatório consultou a mesma API de vendas e retornou o total mensal.

<a id="caso-a13"></a>

## A13 · Pacotes sem uso direto no CRUD

**Antes**

[package.json · L23](https://github.com/FernandoROL/appsec-vendas-att/blob/53ec73fa03d3cc9d4e3aa76174da53c8ff9a5ea7/package.json#L23)

```json
"underscore": "1.12.0",
```

[package.json · L25](https://github.com/FernandoROL/appsec-vendas-att/blob/53ec73fa03d3cc9d4e3aa76174da53c8ff9a5ea7/package.json#L25)

```json
"ws": "7.4.5"
```

**Depois**

[package.json · L15–20](https://github.com/FernandoROL/appsec-vendas-att/blob/0150da83573d63dc3b3c78c5af7ade6f96c7a7c3/package.json#L15-L20)

```json
"dependencies": {
"express": "^5.0.0",
"helmet": "^8.0.0",
"mysql2": "^3.0.0",
"ini": "5.0.0"
},
```

underscore 1.12.0 e ws 7.4.5 saíram de dependencies e do lockfile. Não havia chamada direta dessas bibliotecas no código revisado. O tratamento foi retirar os componentes afetados.

**Na demonstração.** Mostre a lista completa de dependências de execução após a limpeza. A presença de um pacote vulnerável no inventário não comprova uso da função afetada.

## Quais avisos SCA foram tratados por cada mudança?

Uma única atualização ou remoção pode resolver vários avisos do mesmo pacote. As 49 linhas abaixo reproduzem os grupos do OSV na execução #6. A execução #8 registrou zero grupos. A triagem individual apresentada na atividade corresponde aos quatro casos C1–C4.

| Dependência | Advisory do grupo no #6 | Mudança no código |
|---|---|---|
| axios 0.21.1 | [GHSA-3g43-6gmg-66jw](https://osv.dev/vulnerability/GHSA-3g43-6gmg-66jw) | A11 |
| axios 0.21.1 | [GHSA-3p68-rc4w-qgx5](https://osv.dev/vulnerability/GHSA-3p68-rc4w-qgx5) | A11 |
| axios 0.21.1 | [GHSA-43fc-jf86-j433](https://osv.dev/vulnerability/GHSA-43fc-jf86-j433) | A11 |
| axios 0.21.1 | [GHSA-5c9x-8gcm-mpgx](https://osv.dev/vulnerability/GHSA-5c9x-8gcm-mpgx) | A11 |
| axios 0.21.1 | [GHSA-62hf-57xw-28j9](https://osv.dev/vulnerability/GHSA-62hf-57xw-28j9) | A11 |
| axios 0.21.1 | [GHSA-6chq-wfr3-2hj9](https://osv.dev/vulnerability/GHSA-6chq-wfr3-2hj9) | A11 |
| axios 0.21.1 | [GHSA-7q8q-rj6j-mhjq](https://osv.dev/vulnerability/GHSA-7q8q-rj6j-mhjq) | A11 |
| axios 0.21.1 | [GHSA-898c-q2cr-xwhg](https://osv.dev/vulnerability/GHSA-898c-q2cr-xwhg) | A11 |
| axios 0.21.1 | [GHSA-cph5-m8f7-6c5x](https://osv.dev/vulnerability/GHSA-cph5-m8f7-6c5x) | A11 |
| axios 0.21.1 | [GHSA-fvcv-3m26-pcqx](https://osv.dev/vulnerability/GHSA-fvcv-3m26-pcqx) | A11 |
| axios 0.21.1 | [GHSA-hfxv-24rg-xrqf](https://osv.dev/vulnerability/GHSA-hfxv-24rg-xrqf) | A11 |
| axios 0.21.1 | [GHSA-j5f8-grm9-p9fc](https://osv.dev/vulnerability/GHSA-j5f8-grm9-p9fc) | A11 |
| axios 0.21.1 | [GHSA-jr5f-v2jv-69x6](https://osv.dev/vulnerability/GHSA-jr5f-v2jv-69x6) | A11 |
| axios 0.21.1 | [GHSA-m7pr-hjqh-92cm](https://osv.dev/vulnerability/GHSA-m7pr-hjqh-92cm) | A11 |
| axios 0.21.1 | [GHSA-mmx7-hfxf-jppx](https://osv.dev/vulnerability/GHSA-mmx7-hfxf-jppx) | A11 |
| axios 0.21.1 | [GHSA-p92q-9vqr-4j8v](https://osv.dev/vulnerability/GHSA-p92q-9vqr-4j8v) | A11 |
| axios 0.21.1 | [GHSA-pf86-5x62-jrwf](https://osv.dev/vulnerability/GHSA-pf86-5x62-jrwf) | A11 |
| axios 0.21.1 | [GHSA-pjwm-pj3p-43mv](https://osv.dev/vulnerability/GHSA-pjwm-pj3p-43mv) | A11 |
| axios 0.21.1 | [GHSA-pmwg-cvhr-8vh7](https://osv.dev/vulnerability/GHSA-pmwg-cvhr-8vh7) | A11 |
| axios 0.21.1 | [GHSA-vf2m-468p-8v99](https://osv.dev/vulnerability/GHSA-vf2m-468p-8v99) | A11 |
| axios 0.21.1 | [GHSA-w9j2-pvgh-6h63](https://osv.dev/vulnerability/GHSA-w9j2-pvgh-6h63) | A11 |
| axios 0.21.1 | [GHSA-wf5p-g6vw-rhxx](https://osv.dev/vulnerability/GHSA-wf5p-g6vw-rhxx) | A11 |
| axios 0.21.1 | [GHSA-xhjh-pmcv-23jw](https://osv.dev/vulnerability/GHSA-xhjh-pmcv-23jw) | A11 |
| axios 0.21.1 | [GHSA-xx6v-rp6x-q39c](https://osv.dev/vulnerability/GHSA-xx6v-rp6x-q39c) | A11 |
| follow-redirects 1.13.0 | [GHSA-74fj-2j2h-c42q](https://osv.dev/vulnerability/GHSA-74fj-2j2h-c42q) | A11 |
| follow-redirects 1.13.0 | [GHSA-cxjh-pqwp-8mfp](https://osv.dev/vulnerability/GHSA-cxjh-pqwp-8mfp) | A11 |
| follow-redirects 1.13.0 | [GHSA-jchw-25xp-jwwc](https://osv.dev/vulnerability/GHSA-jchw-25xp-jwwc) | A11 |
| follow-redirects 1.13.0 | [GHSA-pw2r-vq6v-hr8c](https://osv.dev/vulnerability/GHSA-pw2r-vq6v-hr8c) | A11 |
| follow-redirects 1.13.0 | [GHSA-r4q5-vmmm-2653](https://osv.dev/vulnerability/GHSA-r4q5-vmmm-2653) | A11 |
| ini 1.3.5 | [GHSA-qqgx-2p2h-9c37](https://osv.dev/vulnerability/GHSA-qqgx-2p2h-9c37) | C2 |
| lodash 4.17.15 | [GHSA-29mw-wpgm-hmr9](https://osv.dev/vulnerability/GHSA-29mw-wpgm-hmr9) | C1 |
| lodash 4.17.15 | [GHSA-35jh-r3h4-6jhm](https://osv.dev/vulnerability/GHSA-35jh-r3h4-6jhm) | C1 |
| lodash 4.17.15 | [GHSA-p6mc-m468-83gw](https://osv.dev/vulnerability/GHSA-p6mc-m468-83gw) | C1 |
| lodash 4.17.15 | [GHSA-r5fr-rjxr-66jc](https://osv.dev/vulnerability/GHSA-r5fr-rjxr-66jc) | C1 |
| lodash 4.17.15 | [GHSA-xxjr-mmjv-4gpg](https://osv.dev/vulnerability/GHSA-xxjr-mmjv-4gpg) | C1 |
| minimist 1.2.5 | [GHSA-xvch-5gv4-984h](https://osv.dev/vulnerability/GHSA-xvch-5gv4-984h) | C3 |
| moment 2.29.1 | [GHSA-8hfj-j24r-96c4](https://osv.dev/vulnerability/GHSA-8hfj-j24r-96c4) | C4 |
| moment 2.29.1 | [GHSA-wc69-rhjr-hc9g](https://osv.dev/vulnerability/GHSA-wc69-rhjr-hc9g) | C4 |
| node-fetch 2.6.0 | [GHSA-r683-j2x4-v87g](https://osv.dev/vulnerability/GHSA-r683-j2x4-v87g) | A12 |
| node-fetch 2.6.0 | [GHSA-w7rc-rwvf-8q5r](https://osv.dev/vulnerability/GHSA-w7rc-rwvf-8q5r) | A12 |
| underscore 1.12.0 | [GHSA-cf4h-3jhx-xvhq](https://osv.dev/vulnerability/GHSA-cf4h-3jhx-xvhq) | A13 |
| underscore 1.12.0 | [GHSA-qpx9-hpmf-5gmw](https://osv.dev/vulnerability/GHSA-qpx9-hpmf-5gmw) | A13 |
| validator 13.6.0 | [GHSA-9965-vmph-33xx](https://osv.dev/vulnerability/GHSA-9965-vmph-33xx) | A8 |
| validator 13.6.0 | [GHSA-qgmg-gppg-76g5](https://osv.dev/vulnerability/GHSA-qgmg-gppg-76g5) | A8 |
| validator 13.6.0 | [GHSA-vghf-hv5q-vc2g](https://osv.dev/vulnerability/GHSA-vghf-hv5q-vc2g) | A8 |
| validator 13.6.0 | [GHSA-xx4c-jj58-r7x6](https://osv.dev/vulnerability/GHSA-xx4c-jj58-r7x6) | A8 |
| ws 7.4.5 | [GHSA-3h5v-q93c-6h6q](https://osv.dev/vulnerability/GHSA-3h5v-q93c-6h6q) | A13 |
| ws 7.4.5 | [GHSA-6fc8-4gx4-v693](https://osv.dev/vulnerability/GHSA-6fc8-4gx4-v693) | A13 |
| ws 7.4.5 | [GHSA-96hv-2xvq-fx4p](https://osv.dev/vulnerability/GHSA-96hv-2xvq-fx4p) | A13 |
