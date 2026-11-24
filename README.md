# CampCalm 🌲

**Projeto acadêmico de Engenharia de Software — UNIASSELVI.**

O **CampCalm** é uma aplicação web para encontrar campings por localização, consultar espaços e valores, solicitar reservas e permitir que os responsáveis aprovem ou recusem as solicitações.

Este repositório reúne **frontend React + Vite + TypeScript**, **API Node.js + Fastify + TypeScript** e **PostgreSQL 17 + PostGIS no Docker**.

> **Objetivo deste guia:** permitir que o avaliador execute o projeto **do zero, na própria máquina**, sem instalar PostgreSQL manualmente. O Docker é usado para o banco; a API e o frontend são executados pelo Node.js em terminais separados.

## 1. Pré-requisitos

- **Git** (para clonar o repositório).
- **Node.js 24 ou superior** e npm (`node --version` e `npm --version`).
- **Docker Desktop** aberto (Windows) ou Docker Engine com **Docker Compose v2** (`docker compose version`).
- **Internet** para instalar dependências, baixar a imagem PostGIS e consultar endereços via Geoapify.
- **Uma chave da Geoapify** para a busca por cidades e endereços: <https://myprojects.geoapify.com/>. A API permanece utilizável sem a chave, mas a busca de endereços do frontend não funciona.

**Portas locais padrão:** PostgreSQL `5432`, API `3000` e frontend `5173`. Deixe-as livres.

## 2. Obter o projeto

No PowerShell ou em um terminal:

```powershell
git clone https://github.com/GabrielMorez/CampCalm.git
cd CampCalm
```

Se o projeto foi entregue como ZIP, basta extraí-lo e abrir o terminal na **raiz**, onde está o `docker-compose.yml`.

A estrutura principal é:

```text
CampCalm/
├── .env.example                 # Modelo de configuração da API e do Docker
├── docker-compose.yml           # PostgreSQL/PostGIS e executor de migrations
├── backend/
│   ├── scripts/
│   │   ├── iniciar-dev.ps1       # Inicialização automática no Windows
│   │   └── executar-api.ps1
│   ├── src/                      # API, aplicação, domínio e infraestrutura
│   └── README.md
├── frontend/
│   ├── .env.example
│   ├── src/
│   └── README.md
└── database/
    ├── migrations/              # 001, 002 e 003
    ├── rollbacks/               # Scripts de reversão
    ├── tests/                   # Smoke tests SQL
    ├── scripts/migrate.sh
    └── README.md
```

## 3. Configuração inicial (obrigatória)

Na **raiz do repositório**, copie o exemplo de ambiente:

```powershell
Copy-Item .env.example .env
notepad .env
```

Configure ao menos estes valores:

```dotenv
NODE_ENV=development
PORT=3000
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=campcalm
DATABASE_USER=campcalm
DATABASE_PASSWORD=SUBSTITUA_POR_UMA_SENHA_LOCAL
JWT_SECRET=SUBSTITUA_POR_UM_SEGREDO_ALEATORIO_COM_PELO_MENOS_32_CARACTERES
GEOAPIFY_API_KEY=SUA_CHAVE_GEOAPIFY
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Troque os valores `SUBSTITUA...` antes de executar. Para gerar um segredo JWT, execute:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Copie a saída para `JWT_SECRET`. **Não publique `.env`, senhas, tokens ou chaves de API no Git.** A chave da Geoapify deve ficar no `.env` da raiz, **não** no frontend.

> No Docker, `DATABASE_PASSWORD` inicializa a senha do banco **na primeira criação do volume**. Se já existir um volume, editar o `.env` não altera automaticamente a senha do PostgreSQL.

## 4. Inicialização rápida no Windows (recomendado)

Abra o Docker Desktop e, na **raiz** do CampCalm, execute:

```powershell
powershell -ExecutionPolicy Bypass -File .\backend\scripts\iniciar-dev.ps1
```

O script existente:

1. Verifica Docker, Node.js, npm, `.env` e `JWT_SECRET`.
2. Inicializa o contêiner PostgreSQL/PostGIS (`docker compose up -d db`).
3. Aplica apenas as migrations **ainda não registradas** (`docker compose --profile tools run --rm migrate`).
4. Instala as dependências do backend, caso `node_modules` não exista.
5. Inicia a API em **outra janela do PowerShell**, ou reutiliza a API já ativa.
6. Valida `GET /health` e `GET /ready`.
7. Cria `frontend/.env` com `VITE_API_URL=http://localhost:3000`, **somente se ainda não existir**.

Quando o terminal informar **`CampCalm BACKEND PRONTO!`**, abra outro PowerShell:

```powershell
cd frontend
npm install
npm run dev
```

Acesse **<http://localhost:5173>**. Mantenha o Docker Desktop e a janela da API abertos.

`npm install` é necessário na primeira execução e quando as dependências forem alteradas.

## 5. Inicialização manual (Windows, Linux ou macOS)

Use esta alternativa caso não queira executar o script `.ps1` ou esteja fora do Windows.

**Terminal 1 — Banco de dados (a partir da raiz):**

```bash
docker compose up -d db
docker compose --profile tools run --rm migrate
```

O comando de migrations é **idempotente**: ele mantém o histórico em `schema_migrations` e pula versões já aplicadas.

**Terminal 2 — API (na pasta `backend`):**

```bash
cd backend
npm install
npm run dev
```

No **Linux/macOS**, para garantir que o processo Node receba as variáveis da raiz antes do `npm run dev`, você pode usar:

```bash
cd backend
set -a
. ../.env
set +a
npm run dev
```

No Windows, o caminho mais confiável continua sendo `iniciar-dev.ps1`, que importa o `.env` automaticamente.

**Terminal 3 — Frontend (na pasta `frontend`):**

Crie o arquivo `frontend/.env` com:

```dotenv
VITE_API_URL=http://localhost:3000
```

Depois execute:

```bash
cd frontend
npm install
npm run dev
```

Se a API não carregar as variáveis do `.env` da raiz no seu ambiente, execute o backend pelo script Windows ou confirme o carregamento de variáveis no ponto de entrada `src/server.ts` da versão do projeto. A API precisa de `DATABASE_*`, `JWT_SECRET`, `CORS_ORIGINS` e `GEOAPIFY_API_KEY` no processo Node.js.

## 6. Verificar se está funcionando

Com os três serviços ativos:

| Serviço | Endereço | Resultado esperado |
| --- | --- | --- |
| Frontend | <http://localhost:5173> | Tela inicial CampCalm |
| API | <http://localhost:3000/health> | JSON com `status: "ok"` |
| API + PostgreSQL | <http://localhost:3000/ready> | JSON com `status: "ready"` |
| Geocodificação | `GET /geocoding/search?q=Indaial` | Lista de sugestões, se a chave Geoapify estiver configurada |

Confira as migrations aplicadas, na raiz do projeto:

```powershell
docker compose exec db psql -U campcalm -d campcalm -c "SELECT version, applied_at FROM schema_migrations ORDER BY version;"
```

Na versão atual, deverão constar **`001_initial_schema`**, **`002_auth_and_publication`** e **`003_camping_address`**. Se você personalizou usuário/banco no `.env`, atualize `-U` e `-d` nos exemplos.

## 7. Roteiro rápido para a demonstração

1. **Conta de responsável:** cadastre-se em **Entrar/Cadastrar**.
2. Abra **Meu camping**, cadastre um camping escolhendo o endereço sugerido e cadastre um espaço (nome, acomodação e valor).
3. **Publicação:** um camping novo começa como `PENDING_REVIEW`; ele **não aparece** publicamente até aprovação. O MVP não possui painel de moderação. Para testes locais, siga o procedimento controlado em [database/README.md](database/README.md#publicar-um-camping-de-demonstração-ambiente-local).
4. **Conta de campista:** crie outra conta ou use outra sessão do navegador. Pesquise a cidade/endereço, informe check-in/check-out e consulte as vagas.
5. Solicite uma reserva. Ela será criada como **`PENDING`** e bloqueará a vaga para o período.
6. Volte à conta do responsável em **Meu camping** e **aprove (`CONFIRMED`)** ou **recuse (`REFUSED`)** a reserva. A recusa libera novamente a disponibilidade.

Os campings exibem imagens **ilustrativas** no MVP; o upload de fotos reais não foi implementado. O projeto também ainda não dispõe de recuperação de senha, painel completo de moderação ou empacotamento mobile Capacitor.

## 8. Testes do projeto

**Backend — tipo e testes unitários/HTTP:**

```powershell
cd backend
npm run typecheck
npm test
```

**Frontend — tipo e build:**

```powershell
cd frontend
npm run typecheck
npm run build
```

**Testes de integração PostgreSQL (opcionais):** exigem um banco separado `campcalm_test` e as mesmas migrations; veja [database/README.md](database/README.md#banco-de-testes-e-smoke-tests).

## 9. Encerrar e reiniciar

- **Frontend ou backend:** pressione `Ctrl+C` no respectivo terminal (ou feche a janela de execução da API).
- **Parar somente o banco:** na raiz, `docker compose stop db`.
- **Reiniciar:** abra o Docker Desktop, execute novamente `backend/scripts/iniciar-dev.ps1` e `npm run dev` no frontend.
- **Preservar dados:** `docker compose down` preserva os volumes persistentes.
- **ATENÇÃO:** `docker compose down -v` **remove o volume e apaga os dados locais**. Não use esse comando para iniciar ou parar normalmente.

## 10. Antes de entregar o repositório ao professor

O professor só terá acesso aos arquivos que forem efetivamente enviados ou publicados no GitHub. Confira:

```powershell
git status
git ls-files -- .env backend/.env frontend/.env
```

O segundo comando deve **não retornar arquivos**: os `.env` reais contêm segredos e devem ficar fora do versionamento. Já os arquivos **`.env.example`** devem estar no repositório. Verifique também se a pasta `database/migrations/` contém as três migrations, `backend/scripts/` contém os dois scripts PowerShell e `frontend/public/` contém as imagens e o favicon usados pela interface.

Se a documentação e o código estiverem apenas na sua máquina, faça commit/push **depois de revisar que não há segredos**; caso contrário, o professor clonará uma versão antiga.

## 11. Solução de problemas

| Sintoma | Verificação recomendada |
| --- | --- |
| Docker não inicia | Abra o Docker Desktop e execute `docker info` / `docker compose ps` |
| Porta 5432 ocupada | Verifique outro PostgreSQL local; ajuste `DATABASE_PORT` no `.env` se necessário |
| `/health` responde, mas `/ready` não | Verifique `DATABASE_PASSWORD`, porta e logs: `docker compose logs db` |
| `JWT_SECRET` ausente | Gere um segredo e configure o `.env` da raiz; reinicie a API |
| Busca por endereço não funciona | Configure `GEOAPIFY_API_KEY`; reinicie a API; verifique internet e cotas do serviço |
| Erro de CORS | Garanta `CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173`; reinicie a API |
| Campings não aparecem | Confira raio/localização e `publication_status = 'APPROVED'` + `active = TRUE` |
| `401 Unauthorized` | Faça novo login; tokens expiram, e atualizar a página pode exigir login novamente |
| Dependências ausentes | Execute `npm install` na pasta `backend` ou `frontend` correspondente |

**Documentação detalhada:** [Backend](backend/README.md) · [Frontend](frontend/README.md) · [Banco e migrations](database/README.md).

---

**Autor:** Gabriel Morez dos Santos · Engenharia de Software — UNIASSELVI.

> O projeto é um **MVP acadêmico**. Para colocá-lo em produção pública, faltam reforços operacionais e de segurança, como limitação de tentativas, confirmação de e-mail e transporte seguro de refresh tokens via cookie no navegador.
