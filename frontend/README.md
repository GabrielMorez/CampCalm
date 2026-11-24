# CampCalm — Frontend

Aplicação web responsiva em **React + Vite + TypeScript**, com identidade visual **Natureza Premium + Exploração Moderna**.

O frontend se comunica **somente com a API HTTP**; ele não acessa o PostgreSQL diretamente. Para subir o projeto inteiro do zero, leia primeiro o [README principal](../README.md).

## 1. Pré-requisitos

- Node.js **24+** e npm.
- API CampCalm ativa em `http://localhost:3000`.
- Banco PostgreSQL/PostGIS inicializado e migrado via Docker.
- Chave `GEOAPIFY_API_KEY` configurada **no `.env` da raiz**, caso queira pesquisar cidades/endereços.

## 2. Instalação

Em um **segundo terminal**, com o banco e a API em execução:

```powershell
cd frontend
Copy-Item .env.example .env
npm install
npm run dev
```

Se estiver executando Linux/macOS, use `cp .env.example .env` no lugar de `Copy-Item`.

Abra **<http://localhost:5173>**.

O arquivo `frontend/.env` deve conter:

```dotenv
VITE_API_URL=http://localhost:3000
```

Se você usou `backend/scripts/iniciar-dev.ps1`, o `frontend/.env` já pode ter sido criado automaticamente. O script **não sobrescreve** um `.env` existente: confira a URL caso ela aponte para outro ambiente.

**Importante:** variáveis que começam com `VITE_` ficam disponíveis no navegador. **Não coloque `JWT_SECRET`, `DATABASE_PASSWORD` ou `GEOAPIFY_API_KEY` neste arquivo.**

## 3. Funcionalidades do MVP

### Explorar

- Buscar campings por cidade ou endereço, selecionando um resultado de localização.
- Usar a localização atual do navegador (com a permissão do visitante).
- Escolher check-in, check-out e raio de busca.
- Ver campings **aprovados**, endereço e espaços disponíveis.
- Consultar preços e solicitar reservas com status `PENDING` após login.

### Minha conta

- Criar conta, entrar, renovar sessão e sair.
- Receber notificações de sucesso e erro nas principais operações.

### Meu camping

- Criar um camping por **endereço**, com vínculo automático da conta como `OWNER`.
- Informar tipos de acomodação, dimensões e diária de cada espaço.
- Atualizar o endereço de um camping existente.
- Ver solicitações de reserva e aprovar/recusar solicitações pendentes.

**Os campings novos começam em `PENDING_REVIEW` e não aparecem na busca pública até aprovação.** A aprovação de publicação é feita de forma administrativa no ambiente de demonstração (veja [database/README.md](../database/README.md#publicar-um-camping-de-demonstração-ambiente-local)).

## 4. Comandos úteis

Na pasta `frontend`:

```powershell
npm run dev         # Desenvolvimento: http://localhost:5173
npm run typecheck   # Verificação de tipos TypeScript
npm run build       # Compilação para frontend/dist
npm run preview     # Prévia local do build
```

Se `npm run dev` informar que a porta está ocupada, finalize a instância antiga do Vite; a configuração atual utiliza a porta `5173`.

## 5. Teste rápido do fluxo de ponta a ponta

1. Inicie PostgreSQL, API e frontend conforme o [README principal](../README.md).
2. Crie a conta do responsável e, em **Meu camping**, registre o camping escolhendo um endereço das sugestões.
3. Cadastre pelo menos um espaço com valor de diária e acomodação.
4. Faça a aprovação do camping no banco **somente no ambiente de demonstração**, usando uma conta moderadora diferente da proprietária.
5. Crie uma conta de campista. Em **Explorar**, busque a região do camping, selecione datas e consulte as vagas.
6. Solicite uma reserva; confira a notificação e o status `PENDING`.
7. Acesse **Meu camping** com a conta responsável e aprove ou recuse a reserva.
8. Verifique que uma reserva `CONFIRMED` bloqueia o período e uma `REFUSED` o libera.

## 6. Imagens, localização e responsividade

- As imagens dos cards de campings são **ilustrativas**: o MVP ainda não dispõe de upload de fotos reais dos estabelecimentos. Há ilustrações SVG locais de fallback.
- A busca por endereço depende do backend e da Geoapify. É necessário acesso à internet.
- O navegador pode solicitar permissão para acessar a localização do usuário; esse recurso é opcional.
- O layout foi preparado para desktop e celular. O empacotamento nativo com Capacitor **não faz parte desta entrega web**.

## 7. Sessão e segurança

No MVP, os tokens são mantidos **em memória**. Recarregar a página pode exigir um novo login. Os endpoints públicos (`GET /campings`, disponibilidade e geocodificação) não exigem sessão, mas cadastro de camping, reserva e operações de proprietário exigem autenticação.

Não armazene segredos, senhas ou refresh tokens manualmente no frontend. Antes de disponibilizar o produto ao público, o fluxo web de refresh tokens deverá migrar para um transporte seguro (por exemplo, cookie `HttpOnly`, `Secure`, com proteção CSRF), além de outras proteções.

## 8. Problemas comuns

| Problema | Solução |
| --- | --- |
| Tela abre, mas não carrega campings | Confirme `/health`, `/ready`, `VITE_API_URL` e publicação do camping |
| Erro de conexão com API | Inicie `npm run dev` na pasta `backend` ou use o script PowerShell da raiz |
| Erro de CORS | Confira `CORS_ORIGINS` no `.env` da raiz e reinicie o backend |
| Endereço não aparece | Verifique `GEOAPIFY_API_KEY`, internet e selecione um resultado após clicar em **Localizar** |
| Reserva recusada por indisponibilidade | Faça nova busca; outra reserva `PENDING` ou `CONFIRMED` pode bloquear a vaga |
| Token expirado | Entre novamente se necessário; o frontend tenta renovar o token durante a sessão |
| Mudanças de `.env` não refletem | Reinicie `npm run dev` do Vite |
| Favicon antigo | Atualize com `Ctrl + Shift + R` |

A API e as migrations estão documentadas em [backend/README.md](../backend/README.md) e [database/README.md](../database/README.md).
