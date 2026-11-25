# Controle de vendas

Aplicação local de uso individual com React, TypeScript, Express e MySQL. Cadastra, lista, atualiza e exclui vendas. Cada venda guarda produto, cliente, quantidade, preço unitário e data. O servidor registra valores em centavos inteiros e a interface mostra os totais em reais.

## Executar com Docker

1. Copie `.env.example` para `.env`. Escolha senhas diferentes para a conta da aplicação e para a conta root do MySQL.
2. Execute `docker compose up --build -d --wait`.
3. Abra [http://127.0.0.1:8080](http://127.0.0.1:8080). Se alterar `APP_PORT`, use a nova porta.
4. Para encerrar, execute `docker compose down`. O volume do MySQL conserva os dados.

## Estrutura

| Caminho | Conteúdo |
| --- | --- |
| `server/` | API Express, validação e acesso ao MySQL |
| `web/` | Interface React compilada com Vite e servida pelo Express |
| `db/` | Esquema MySQL e restrições de dados |
| `.github/workflows/scans.yml` | Workflow do professor com exportação dos relatórios JSON |
