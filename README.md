# Sistema Web de Registro de Ponto e Banco de Horas

Sistema local minimalista para registro de ponto, pendências, banco de horas mensal, relatórios em PDF e checkpoints.

## Stack

- Frontend: React, TypeScript, Vite, TailwindCSS
- Backend: Node.js, Express, TypeScript
- Banco: PostgreSQL
- ORM: Prisma
- PDF: PDFKit

## Arquitetura

O projeto é um monorepo com `frontend` e `backend` separados. O backend concentra autenticação, validações, cálculo de banco de horas, aprovação de pendências, relatórios e checkpoints. O frontend consome a API REST e mantém apenas a experiência visual.

```text
.
├─ backend/
│  ├─ prisma/
│  │  ├─ schema.prisma
│  │  ├─ migrations/
│  │  └─ seed.ts
│  ├─ src/
│  │  ├─ config/
│  │  ├─ middleware/
│  │  ├─ routes/
│  │  ├─ services/
│  │  ├─ utils/
│  │  └─ types/
│  ├─ uploads/
│  └─ checkpoints/
├─ frontend/
│  └─ src/
│     ├─ api/
│     ├─ components/
│     ├─ hooks/
│     ├─ pages/
│     ├─ types/
│     └─ utils/
├─ docker-compose.yml
├─ package.json
└─ .env.example
```

## Banco de Dados

Tabelas principais:

- `User`: usuários, admin e funcionários. O campo `code` é o código definitivo de 6 dígitos.
- `TimeEntry`: registros de entrada e saída aprovados ou rejeitados.
- `TimeAdjustmentRequest`: pendências de criação, edição ou exclusão solicitadas por funcionário.
- `AuditLog`: histórico completo de ações sensíveis.
- `CompanySettings`: logo, razão social, CNPJ e endereço.
- `Checkpoint`: checkpoints locais do estado do banco.
- `AppSetting`: controles internos, como último checkpoint diário.

## Regras Implementadas

- Login por código de 6 dígitos e PIN de 4 dígitos.
- Admin inicial: código `000000`, PIN `1234`.
- PIN armazenado com hash PBKDF2-SHA256.
- Após 5 tentativas incorretas, o usuário é bloqueado.
- Admin desbloqueia e redefine PIN para `1234`.
- Funcionário desativado não acessa, mas mantém histórico.
- Entradas e saídas precisam alternar.
- Pendências simulam a linha do tempo enquanto aguardam aprovação.
- Entrada aberta em dia anterior bloqueia nova entrada até saída manual retroativa.
- Alteração manual do funcionário exige PIN e justificativa de até 50 caracteres.
- Admin pode lançar, editar e excluir diretamente, sempre confirmando PIN.
- Banco de horas é mensal: trabalhado no mês menos esperado no mês.
- Dias fora da escala entram no total trabalhado, mas não geram extra automático.
- Relatório mensal lista todos os dias do mês, inclusive sem ponto.
- PDF inclui cabeçalho da empresa e rodapé com data/hora de geração.
- Checkpoint automático diário e restauração com confirmação forte.

## Execução Local

1. Instale dependências:

```bash
npm install
```

2. Crie o arquivo `.env` a partir de `.env.example`:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
```

No Windows PowerShell:

```powershell
Copy-Item .env.example .env
Copy-Item backend/.env.example backend/.env
```

3. Suba o PostgreSQL:

```bash
npm run db:up
```

Se Docker não estiver instalado, crie manualmente um banco PostgreSQL e ajuste `DATABASE_URL` no `.env`.

4. Rode migrations e seed:

```bash
npm run db:migrate
npm run db:seed
```

5. Inicie backend e frontend:

```bash
npm run dev
```

URLs padrão:

- Frontend: `http://localhost:5173`
- API: `http://localhost:3333`
- Healthcheck: `http://localhost:3333/health`

## Primeiro Acesso

- Código: `000000`
- PIN: `1234`

## Scripts

- `npm run dev`: roda backend e frontend.
- `npm run build`: compila backend e frontend.
- `npm run db:up`: sobe PostgreSQL local via Docker.
- `npm run db:down`: encerra containers.
- `npm run db:migrate`: aplica migrations Prisma.
- `npm run db:seed`: cria ou atualiza o admin inicial.

## Rotas Principais

- `POST /api/auth/login`
- `POST /api/auth/change-pin`
- `GET /api/time/me/day`
- `GET /api/time/me/month`
- `POST /api/time/me/punch`
- `POST /api/time/me/adjustments`
- `GET /api/time/admin/overview`
- `POST /api/time/admin/entries`
- `PATCH /api/time/admin/entries/:id`
- `DELETE /api/time/admin/entries/:id`
- `POST /api/time/admin/adjustments/:id/approve`
- `POST /api/time/admin/adjustments/:id/reject`
- `GET /api/reports/month`
- `GET /api/reports/month/pdf`
- `GET /api/reports/period`
- `GET /api/reports/period/pdf`
- `GET/PATCH /api/company`
- `POST /api/company/logo`
- `GET/POST /api/checkpoints`
- `POST /api/checkpoints/:id/restore`

## Observações Para Supabase e Netlify

Supabase deve ser usado como banco PostgreSQL. O app React e a API Express precisam ser hospedados fora do Supabase; este projeto já inclui `netlify.toml` e `netlify/functions/api.ts` para publicar no Netlify.

No Netlify, configure estas variáveis:

```env
DATABASE_URL=postgresql://postgres:SUA_SENHA@db.uigvrohkwwpambjsyxqf.supabase.co:5432/postgres?schema=public
JWT_SECRET=troque-por-um-segredo-grande
FRONTEND_URL=https://SEU-SITE.netlify.app
VITE_API_URL=/api
```

Build command:

```bash
npm run build:netlify
```

Publish directory:

```txt
frontend/dist
```

Functions directory:

```txt
netlify/functions
```

Depois do deploy, entre com `000000 / 1234`.
