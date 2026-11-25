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

## Versão tratada para a atividade de AppSec

Este CRUD foi desenvolvido especificamente para a atividade. A branch `appsec/vuns` preserva a versão didática anterior às correções. Use a branch `appsec/correcoes` para a demonstração funcional.

A busca e o recibo continuam disponíveis na interface. O recibo é servido como texto. Para exercitar as rotas administrativas, defina `ADMIN_PASSWORD` no .env (pelo menos 16 caracteres) antes de iniciar o Compose. O usuário é `admin`. As sessões expiram em 30 minutos e são invalidadas quando a API reinicia. Os nomes devolvidos na exportação e compactação identificam os arquivos para download durante a execução. O teste de webhook exige um único `WEBHOOK_HOST` configurado, usa HTTPS e devolve o status HTTP. A fórmula aceita números, parênteses, operações aritméticas e a variável numérica `preco`.

O workflow `scans.yml` mantém as regras e os dois relatórios do professor. A verificação funcional usa MySQL 8.4 e dados fictícios transitórios no GitHub Actions. Para repetir o relatório mensal localmente, use Node 24, execute `npm ci` e depois `npm run relatorio` com a aplicação em execução.
