# Banco de dados CampCalm — primeira etapa

Pré-requisitos: Docker Desktop (Docker Compose v2). Não é preciso instalar PostgreSQL nem Node.js para criar o banco e aplicar a primeira migração.

```bash
# A partir da raiz do repositório CampCalm
cp .env.example .env
# Edite DATABASE_PASSWORD no arquivo .env antes de subir o banco.
docker compose up -d db
# Aguarde o healthcheck do serviço e execute as migrações:
docker compose --profile tools run --rm migrate
```

Inspecione o banco:

```bash
docker compose exec db psql -U campcalm -d campcalm -c "SELECT extname FROM pg_extension WHERE extname IN ('postgis','btree_gist');"
docker compose exec db psql -U campcalm -d campcalm -c "SELECT version, applied_at FROM schema_migrations ORDER BY version;"
docker compose exec db psql -U campcalm -d campcalm -c "\dt"
```

Teste SQL de integridade **sem gravar dados permanentes** (o script executa ROLLBACK):

```bash
docker compose exec -T db psql -U campcalm -d campcalm -v ON_ERROR_STOP=1 < database/tests/001_smoke.sql
```

Se você personalizar `DATABASE_USER` ou `DATABASE_NAME` em `.env`, substitua os valores `-U campcalm -d campcalm` nos comandos por eles.

**Atenção:** o banco usa volume Docker persistente. `docker compose down` não exclui os dados; **`docker compose down -v` exclui**. Alterar senha/usuário em `.env` depois da primeira inicialização não atualiza automaticamente o usuário existente no volume.

### Como evoluir o banco

Crie outro arquivo numerado em `database/migrations/` (exemplo: `002_add_accounts.sql`) e execute novamente:

```bash
docker compose --profile tools run --rm migrate
```

`schema_migrations` controla quais scripts já foram aplicados. **Não altere uma migration depois que ela tiver sido aplicada em um ambiente compartilhado**; crie uma nova.

### Como conectar a aplicação futuramente

No desenvolvimento local, o backend usa `DATABASE_HOST=localhost` e a porta exposta definida em `.env`. Entre serviços dentro da rede do Compose, use `db` como host. O deploy da API e o gerenciamento de acesso serão configurados na próxima etapa; ainda não existe um servidor HTTP.

### Próximas decisões

- Login e vínculo de responsáveis com campings
- Tratamento de prazo de reservas pendentes
- Repositórios PostgreSQL e transações de gravação
- FIFO rigoroso para a última vaga, conforme CA-05
- Execução dos benchmarks de proximidade com registros sintéticos
