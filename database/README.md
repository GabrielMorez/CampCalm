# CampCalm — PostgreSQL / PostGIS / Migrations

O banco de dados do CampCalm utiliza **PostgreSQL 17**, extensão **PostGIS** e **btree_gist**. O Docker Compose inicia o banco e oferece um executor de migrations sem exigir uma instalação local do PostgreSQL.

Para a instalação completa, consulte também o [README principal](../README.md).

## 1. Configuração inicial

Pré-requisitos: Docker Desktop (ou Docker Engine + Compose v2) e o arquivo `/.env` configurado a partir de `/.env.example`.

Na **raiz** do projeto:

```powershell
Copy-Item .env.example .env  # Apenas se o .env ainda não existir
# Edite DATABASE_PASSWORD, JWT_SECRET e GEOAPIFY_API_KEY

docker compose up -d db
```

O Compose usa a imagem `postgis/postgis:17-3.5`, expõe a porta local padrão `5432` e preserva os dados no volume `campcalm_postgres_data`.

Aguarde o healthcheck:

```powershell
docker compose ps
docker compose logs db
```

**Não precisa criar o banco `campcalm` manualmente**: ele é inicializado pelo contêiner a partir das variáveis `POSTGRES_DB`, `POSTGRES_USER` e `POSTGRES_PASSWORD` do Compose.

## 2. Aplicar migrations

Na **raiz** do projeto:

```powershell
docker compose --profile tools run --rm migrate
```

O serviço `migrate` espera o PostgreSQL ficar saudável e executa `database/scripts/migrate.sh`. Esse script:

- Percorre `database/migrations/*.sql` em ordem alfabética;
- Usa uma transação e um lock consultivo para serializar a execução;
- Registra cada nome de arquivo, sem a extensão `.sql`, em `schema_migrations`;
- **Ignora migrations já aplicadas**; não apaga dados nem recria o esquema a cada inicialização.

### Migrations do MVP

| Versão | Conteúdo |
| --- | --- |
| `001_initial_schema.sql` | Campistas, campings, espaços, acomodações, reservas, localização PostGIS e prevenção de sobreposição |
| `002_auth_and_publication.sql` | Usuários, sessões, vínculo `camping_users`, moderadores e aprovação de publicação |
| `003_camping_address.sql` | `campings.address_text`, preservando latitude e longitude |

Verifique quais foram aplicadas:

```powershell
docker compose exec db psql -U campcalm -d campcalm -c "SELECT version, applied_at FROM schema_migrations ORDER BY version;"
```

Inspecione as extensões e tabelas:

```powershell
docker compose exec db psql -U campcalm -d campcalm -c "SELECT extname FROM pg_extension WHERE extname IN ('postgis','btree_gist');"
docker compose exec db psql -U campcalm -d campcalm -c "\dt"
```

Se `DATABASE_NAME`/`DATABASE_USER` forem personalizados no `.env`, ajuste `-d campcalm` e `-U campcalm` nos comandos de exemplo.

> **Atenção:** não altere o conteúdo de uma migration que já foi aplicada em um banco com dados. Para mudanças posteriores, crie uma nova versão numerada e um rollback correspondente.

## 3. Banco de testes e smoke tests

Os testes de integração automatizados usam **`campcalm_test`**, separado do banco de desenvolvimento. Ele **não é necessário para abrir o frontend**, mas é recomendado para verificar o projeto na máquina do professor.

### Criar uma vez

Na raiz do projeto, após iniciar o PostgreSQL:

```powershell
docker compose exec db psql -U campcalm -d postgres -c "CREATE DATABASE campcalm_test OWNER campcalm;"
```

Se `campcalm_test` já existir, não execute o `CREATE DATABASE` novamente. Mantenha o mesmo proprietário configurado para o banco principal.

Aplique as mesmas migrations ao banco de testes:

```powershell
docker compose --profile tools run --rm -e PGDATABASE=campcalm_test migrate
```

### Smoke tests SQL

Os arquivos de smoke test usados nesta etapa executam `ROLLBACK`, evitando deixar dados fictícios após as verificações.

```powershell
Get-Content -Raw database/tests/001_smoke.sql |
  docker compose exec -T db psql -U campcalm -d campcalm_test -v ON_ERROR_STOP=1

Get-Content -Raw database/tests/002_publication_smoke.sql |
  docker compose exec -T db psql -U campcalm -d campcalm_test -v ON_ERROR_STOP=1

Get-Content -Raw database/tests/003_camping_address_smoke.sql |
  docker compose exec -T db psql -U campcalm -d campcalm_test -v ON_ERROR_STOP=1
```

**Testes de integração em TypeScript** (na pasta `backend`):

```powershell
npm run test:integration:account
npm run test:integration:auth-session
npm run test:integration:authorization
npm run test:integration:camping-space
```

Não execute testes em bancos com dados que devam ser preservados. As suites de integração inserem, modificam e excluem dados de teste.

## 4. Publicar um camping de demonstração (ambiente local)

**Regra do projeto:** campings novos ficam em `PENDING_REVIEW`; apenas campings `APPROVED` e `active = TRUE` aparecem na busca. O painel de moderação ainda não existe no MVP, então a aprovação para demonstração deve ser feita **manualmente, com acesso administrativo ao PostgreSQL local**.

1. Pelo frontend, crie a conta de **proprietário** e registre o camping e seu espaço.
2. Crie **outra conta de demonstração** com e-mail `moderador.demo@example.test`. Essa conta não pode ser OWNER/MANAGER do camping que irá aprovar.
3. Na raiz do projeto, abra o cliente SQL do banco **local**:

   ```powershell
   docker compose exec db psql -U campcalm -d campcalm
   ```

4. Liste os campings e copie o UUID do que deseja publicar:

   ```sql
   SELECT id, name, publication_status
   FROM campings
   ORDER BY created_at DESC
   LIMIT 10;
   ```

5. Execute **somente no banco local de demonstração** o SQL abaixo. Substitua `COLE_O_UUID_DO_CAMPING_AQUI` pelo ID real:

   ```sql
   BEGIN;

   -- Concede a permissão de moderação à conta de demonstração.
   INSERT INTO platform_moderators (user_id)
   SELECT id
   FROM users
   WHERE lower(email) = lower('moderador.demo@example.test')
     AND active = TRUE
   ON CONFLICT DO NOTHING;

   -- Publica apenas se a conta moderadora não for responsável pelo camping.
   WITH moderator AS (
     SELECT u.id
     FROM users u
     JOIN platform_moderators pm ON pm.user_id = u.id
     WHERE lower(u.email) = lower('moderador.demo@example.test')
       AND u.active = TRUE
   )
   UPDATE campings c
   SET publication_status = 'APPROVED',
       reviewed_by = moderator.id,
       reviewed_at = NOW(),
       review_note = NULL
   FROM moderator
   WHERE c.id = 'COLE_O_UUID_DO_CAMPING_AQUI'::uuid
     AND c.publication_status = 'PENDING_REVIEW'
     AND NOT EXISTS (
       SELECT 1
       FROM camping_users cu
       WHERE cu.camping_id = c.id
         AND cu.user_id = moderator.id
     )
   RETURNING c.id, c.name, c.publication_status;

   COMMIT;
   ```

6. O `UPDATE` deve retornar **uma linha com `APPROVED`**. Se retornar zero linhas, confira o ID, a existência da conta moderadora e o estado do camping. Digite `\q` para sair do `psql`.
7. Volte ao frontend e pesquise o camping pela região escolhida.

**Esse acesso SQL é uma medida provisória exclusivamente acadêmica/local.** Não disponibilize credenciais de banco para usuários reais nem use essa rotina como fluxo de moderação pública. Uma mudança posterior de endereço faz o camping voltar para `PENDING_REVIEW`, exigindo nova revisão.

## 5. Rollbacks e preservação de dados

Os scripts de reversão ficam em `database/rollbacks/` e **não são executados automaticamente** pelo migrador.

Exemplo de reversão da migration **003** (perde os endereços salvos em `address_text`):

```powershell
Get-Content -Raw database/rollbacks/003_camping_address.down.sql |
  docker compose exec -T db psql -U campcalm -d campcalm_test -v ON_ERROR_STOP=1
```

Para executar no banco de desenvolvimento, substitua `campcalm_test` por `campcalm` **somente após confirmar que os dados podem ser perdidos** e que não existem migrations posteriores dependentes da 003.

O rollback 003 remove a coluna `address_text` e seu registro em `schema_migrations`, mas mantém campings, espaços e reservas. **O código atual do backend exige essa coluna:** não faça rollback e continue executando a API atual sem antes compatibilizar o código.

Para migrations futuras, mantenha o par de arquivos:

```text
database/migrations/004_nova_alteracao.sql
database/rollbacks/004_nova_alteracao.down.sql
```

O rollback deve ser avaliado individualmente: alguns são destrutivos e uma migration corretiva pode ser mais segura.

### Parar os serviços

```powershell
docker compose stop db
```

**Para uma reinstalação completa, SOMENTE se for aceitável perder todos os dados locais:**

```powershell
# PERIGO: apaga permanentemente o volume de banco de dados deste Compose.
docker compose down -v
# Depois, siga novamente as seções 1 e 2.
```

Não use `down -v` para simplesmente reiniciar o CampCalm. O comando normal `docker compose down` preserva os volumes.

## 6. Solução de problemas

- **Docker não sobe:** verifique Docker Desktop, `docker info` e `docker compose logs db`.
- **`password authentication failed`:** confira a senha do `.env` e lembre que o volume mantém a senha inicial; não apague o volume sem necessidade.
- **`database campcalm_test does not exist`:** crie-o pela seção 3 antes dos testes de integração.
- **Migration falha:** confira o erro SQL; não substitua nem renomeie uma migration já aplicada sem entender `schema_migrations`.
- **Porta `5432` ocupada:** ajuste `DATABASE_PORT` no `.env` ou finalize outro PostgreSQL local.
- **Consulta de proximidade não retorna campings:** confirme extensões, coordenadas, raio e `publication_status = 'APPROVED'`.
