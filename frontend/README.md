# CampCalm — Frontend MVP

Frontend web responsivo, construído com React + Vite + TypeScript, integrado aos endpoints HTTP atuais do CampCalm.

## Executar localmente

1. Backend em execução (`http://localhost:3000`) e PostgreSQL ativo.
2. No diretório `frontend`, execute:

   ```powershell
   Copy-Item .env.example .env
   npm install
   npm run typecheck
   npm run dev
   ```

3. Abra `http://localhost:5173`.

O `.env` contém `VITE_API_URL=http://localhost:3000`. O backend Fastify deve permitir `http://localhost:5173` em sua configuração de CORS.

## Funcionalidades incluídas

- Busca pública de campings publicados por coordenadas e raio.
- Geolocalização opcional do navegador.
- Consulta pública de vagas e preços por período.
- Cadastro e login com a conta única existente.
- Solicitação autenticada de reservas (status PENDING).
- Área do proprietário: meus campings, cadastro de camping, espaços, reservas, aprovação e recusa.
- Refresh automático do access token quando uma rota autenticada responde 401.

## Escopo e limitações deliberadas

- Os tokens são mantidos **somente na memória** do navegador, sem `localStorage` ou `sessionStorage`. Atualizar a página exige novo login. Antes de publicar na web, o refresh token deverá ser transportado por cookie `HttpOnly`, `Secure`, com proteção CSRF.
- Campings novos ficam `PENDING_REVIEW`; não aparecem na busca pública até aprovação. Não há painel de moderação neste MVP.
- Não existe endpoint de histórico de reservas do campista; a confirmação é exibida imediatamente após a solicitação.
- Uma mudança de datas deve ser seguida de nova consulta de vagas; a disponibilidade é revalidada no backend ao reservar.
- A interface não implementa mapa visual nem detalhes ricos do camping; apenas os dados presentes na API atual.
- Há apenas localização por coordenadas para a busca; geocodificação de endereço é futura.

## Publicação

```powershell
npm run build
```

Os arquivos estáticos serão gerados em `frontend/dist`.

A interface é web responsiva; o empacotamento com Capacitor permanece para a próxima etapa, sem bloquear a entrega web.
