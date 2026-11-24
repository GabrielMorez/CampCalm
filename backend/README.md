# CampCalm — Backend

API REST em **Node.js 24+, TypeScript e Fastify**, com autenticação JWT, sessões persistentes no PostgreSQL, integração Geoapify e regras de domínio para disponibilidade/reservas.

Para executar **o projeto inteiro do zero**, comece pelo [README da raiz](../README.md). Este arquivo detalha a API.

## 1. Pré-requisitos

- Node.js 24+ e npm.
- PostgreSQL 17 + PostGIS executando pelo `docker-compose.yml` **na raiz do projeto**.
- Migrations aplicadas ao banco `campcalm`.
- Arquivo `.env` **na raiz** com `DATABASE_*`, `JWT_SECRET`, `GEOAPIFY_API_KEY` e `CORS_ORIGINS`.

Não é necessário instalar PostgreSQL diretamente no Windows: ele roda no Docker.

## 2. Iniciar no Windows (mais simples)

Com Docker Desktop aberto, execute **na raiz do repositório**:

```powershell
powershell -ExecutionPolicy Bypass -File .\backend\scripts\iniciar-dev.ps1
```

Esse script sobe o banco, aplica apenas as migrations pendentes e abre a API em uma nova janela. Não apaga dados. Em seguida, inicie o [frontend](../frontend/README.md) em outro terminal.

### Iniciar manualmente

Na **raiz** do projeto:

```powershell
docker compose up -d db
docker compose --profile tools run --rm migrate
```

Na pasta `backend`:

```powershell
cd backend
npm install
npm run dev
```

A API deve responder em **<http://localhost:3000>**. Deixe o terminal aberto.

> Se você executa o Node fora do script PowerShell, confira se as variáveis do `.env` da raiz estão sendo carregadas pelo processo. O script `iniciar-dev.ps1` faz isso explicitamente. No Linux/macOS, você pode executar `set -a; . ../.env; set +a; npm run dev` a partir da pasta `backend`, para exportar as variáveis. No Windows, prefira o script PowerShell.

## 3. Variáveis de ambiente

O arquivo `/.env.example` é a referência. Os parâmetros principais são:

| Variável | Exemplo local | Finalidade |
| --- | --- | --- |
| `NODE_ENV` | `development` | Ambiente da aplicação |
| `PORT` | `3000` | Porta da API |
| `DATABASE_HOST` | `localhost` | Host do Postgres para API no host |
| `DATABASE_PORT` | `5432` | Porta do Postgres |
| `DATABASE_NAME` | `campcalm` | Nome do banco |
| `DATABASE_USER` | `campcalm` | Usuário |
| `DATABASE_PASSWORD` | **definir** | Senha do banco local |
| `JWT_SECRET` | **gerar** | Assinatura dos access tokens |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Origens web permitidas |
| `GEOAPIFY_API_KEY` | **obter do provedor** | Geocodificação de endereços |

Gerar `JWT_SECRET`:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

O segredo não deve ser enviado ao Git. **Nunca use `VITE_GEOAPIFY_API_KEY`: a chave pertence exclusivamente ao backend.**

## 4. Verificar o funcionamento

```powershell
Invoke-RestMethod http://localhost:3000/health
Invoke-RestMethod http://localhost:3000/ready
```

Resultados esperados:

- `/health`: indica `status = ok` (servidor HTTP ativo).
- `/ready`: indica `status = ready` (PostgreSQL acessível).

Um `/health` saudável **não garante** que o banco esteja acessível; confira os dois.

## 5. Endpoints do MVP

| Método | Rota | Autenticação |
| --- | --- | --- |
| `GET` | `/health` | Pública |
| `GET` | `/ready` | Pública |
| `POST` | `/auth/register` | Pública |
| `POST` | `/auth/login` | Pública |
| `POST` | `/auth/refresh` | Refresh token |
| `POST` | `/auth/logout` | Refresh token |
| `GET` | `/auth/me` | Bearer |
| `GET` | `/geocoding/search?q=Indaial` | Pública (Geoapify configurada) |
| `GET` | `/campings?latitude=-26.9&longitude=-49.2&radiusKm=50` | Pública |
| `GET` | `/campings/:campingId/available-spaces?startDate=AAAA-MM-DD&endDate=AAAA-MM-DD` | Pública |
| `POST` | `/campings` | Bearer |
| `GET` | `/me/campings` | Bearer |
| `PUT` | `/campings/:campingId/address` | Bearer + OWNER/MANAGER |
| `POST` | `/campings/:campingId/spaces` | Bearer + OWNER/MANAGER |
| `GET` | `/campings/:campingId/spaces` | Bearer + OWNER/MANAGER |
| `POST` | `/reservations` | Bearer |
| `GET` | `/campings/:campingId/reservations` | Bearer + OWNER/MANAGER |
| `POST` | `/reservations/:reservationId/approve` | Bearer + OWNER/MANAGER |
| `POST` | `/reservations/:reservationId/refuse` | Bearer + OWNER/MANAGER |

As rotas públicas de disponibilidade retornam apenas dados publicáveis e **não** exigem login. A solicitação de reserva requer autenticação; o `camperId` vem da conta autenticada e não deve ser informado pelo cliente.

### Exemplo: login no PowerShell

Cadastre a conta primeiro pelo frontend ou `POST /auth/register` (nome, e-mail, telefone e senha):

```powershell
$body = @{
  email = "campista.demo@example.test"
  password = "SenhaDeDemonstracao123!"
} | ConvertTo-Json

$login = Invoke-RestMethod `
  -Uri "http://localhost:3000/auth/login" `
  -Method POST -ContentType "application/json" -Body $body

$headers = @{ Authorization = "Bearer $($login.accessToken)" }
Invoke-RestMethod -Uri "http://localhost:3000/auth/me" -Headers $headers
```

Use **apenas contas e senhas fictícias** para a demonstração. Não registre tokens completos no console, em capturas públicas ou no Git.

## 6. Regras de negócio essenciais

- `User`: conta única. A mesma pessoa pode ser campista e proprietária.
- Cadastro de camping cria automaticamente o vínculo `OWNER` e o estado `PENDING_REVIEW`.
- Um camping só entra na busca pública se estiver **ativo e `APPROVED`**.
- A seleção de endereço no frontend recebe coordenadas da geocodificação e as envia ao backend junto com `addressText`.
- Reservas nascem `PENDING`, bloqueando o período até **aprovação (`CONFIRMED`) ou recusa (`REFUSED`)**.
- A proteção contra sobreposição também está no PostgreSQL, evitando reservas concorrentes para a mesma vaga.
- `OWNER` e `MANAGER` podem gerenciar espaços e decidir reservas **apenas de campings aos quais estão vinculados**.

No MVP, a aprovação inicial de *publicação* dos campings não possui tela administrativa. Veja o procedimento de demonstração em [database/README.md](../database/README.md#publicar-um-camping-de-demonstração-ambiente-local).

## 7. Testes

Na pasta `backend`:

```powershell
npm run typecheck
npm test
```

Os testes unitários e HTTP não exigem que você crie manualmente contas no banco. Para os testes abaixo, crie e migre **o banco separado `campcalm_test`** conforme o [guia de banco](../database/README.md#banco-de-testes-e-smoke-tests):

```powershell
npm run test:integration:account
npm run test:integration:auth-session
npm run test:integration:authorization
npm run test:integration:camping-space
```

Também existe o script `npm run test:integration` para verificações de reserva, caso esteja presente no `package.json` da versão utilizada.

Não execute testes de integração apontando para um banco com dados reais. Eles criam, alteram e excluem registros fictícios.

## 8. Build

```powershell
npm run typecheck
npm run build
npm start
```

No projeto atual, o script `start` executa o servidor compilado em `dist/src/server.js`. Em desenvolvimento, prefira `npm run dev`.

## 9. Solução de problemas

- **`ECONNREFUSED` ao conectar ao banco:** execute `docker compose ps` e `docker compose logs db` na raiz. Confira usuário, porta e senha em `.env`.
- **`JWT_SECRET` inválido:** gere segredo com ao menos 32 caracteres e reinicie a API.
- **`401` após algum tempo:** access token expira e pode ser renovado; se a página for recarregada, o MVP pode exigir novo login.
- **`403` em espaços/reservas:** a conta autenticada precisa ter vínculo `OWNER` ou `MANAGER` com o camping.
- **`GEOCODING_NOT_CONFIGURED`:** preencha `GEOAPIFY_API_KEY` e reinicie o processo Node.
- **`GET /campings` vazio:** campus novos ficam `PENDING_REVIEW`. Verifique `APPROVED`, `active`, raio e coordenadas.
- **CORS bloqueado:** configure `CORS_ORIGINS` com `http://localhost:5173` e reinicie a API.

> **Nota de segurança:** esta versão serve como MVP acadêmico. O transporte atual de refresh tokens em JSON e a ausência de alguns controles antiabuso precisam ser revistos antes de disponibilizar cadastros irrestritos ao público.
