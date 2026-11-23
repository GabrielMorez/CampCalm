# Persistência e infraestrutura local — CampCalm

## Estado da implementação

Esta etapa prepara **o banco**, não implementa API HTTP ou repositórios Postgres ainda. As quatro entidades atuais do domínio (`Camper`, `Camping`, `Space` e `Reservation`) são mantidas. O mapeamento das entidades para SQL será implementado na infraestrutura na próxima etapa.

## Decisões documentadas (C6/C7/C13)

| Coleção/tabela | Operação prioritária | Volume de referência | Estrutura / decisão |
|---|---|---|---|
| Campings (`campings`) | Buscar ativos por proximidade | 10 reais na demonstração; testar 10/100/1000 registros sintéticos | `geography(Point,4326)` gerada e índice GiST parcial para campings ativos |
| Espaços (`spaces`, `space_accommodation_types`) | Consultar espaços de um camping e tipos aceitos | Dezenas por camping (hipótese de dimensionamento) | FK + índice `(camping_id, active)` + relação para múltiplos tipos |
| Reservas (`reservations`) | Consultar por data e impedir conflitos | 30 reservas/semana como dado **simulado** do roteiro, ~1560/ano se mantido 52 semanas | Índice `(camping_id,status,start_date,end_date)` e exclusão GiST de sobreposição |
| Solicitações pendentes (`reservations` filtrada por status) | Criar, listar e decidir | Até 60 contatos/dia no roteiro **simulado**, não são 60 reservas confirmadas | Mesma tabela; status `PENDING`, índice para consulta por camping |

**Origem dos volumes:** 10 campings é meta de demonstração do Termo de Referência. Os números sobre operação do camping são derivados de **entrevista simulada**; não são dados empíricos verificados. 100 e 1.000 campings são massas sintéticas de teste, não estimativas de mercado.

## Regras de integridade

- IDs em UUID, compatíveis com propriedades `string` das entidades TS.
- Dinheiro em `INTEGER` (centavos), compatível com `Money.cents`.
- Datas de entrada/saída em `DATE`; check-in incluso e check-out exclusivo: intervalo `[)`. Reservar 10–12 e 12–13 é permitido; 10–12 e 11–13 é conflito.
- `reservations_no_active_overlap`: evita sobreposição na **mesma vaga** quando `status` é `PENDING` ou `CONFIRMED`, mesmo em transações concorrentes. `REFUSED` e `CANCELLED` liberam o espaço.
- `reservations_space_camping_fk`: garante que a vaga reservada pertença ao camping referenciado.
- PostGIS: latitude/longitude persistidas, `location` geográfica gerada e índice GiST; consultas usam `ST_DWithin` e `ST_Distance` em metros.

## Limites / decisões para a próxima etapa

1. A restrição de exclusão garante **ausência de duplicidade**, mas não determina **ordem FIFO estrita** sob concorrência. Para garantir CA-05 literalmente, precisamos definir serialização por espaço e o critério de chegada (recebimento HTTP ou ingresso na fila).
2. **Reservas pendentes bloqueiam vagas** conforme RF-001. Precisamos definir prazo de expiração e política de liberação caso não sejam aceitas ou recusadas. Não foi inventado prazo automático neste esquema.
3. A entidade `Reservation` já permite o estado `CANCELLED`, mas a funcionalidade de cancelamento pelo campista (RF-013) só entra **após o MVP**. O RF-011 (histórico do campista durante o aceite) também será implementado após o MVP.
4. **Autenticação / usuários e responsáveis pelo camping** ainda precisam ser especificados. Não incluí tabelas de login sem decidir perfis e vínculo de acesso; não publicar endpoints de escrita/gestão sem autorização.
5. `Space` requer ao menos um tipo de acomodação; a validação permanece no domínio e a inserção das linhas `space_accommodation_types` deverá ocorrer na mesma transação da vaga.
6. A migração é de estrutura. Medição C8 com valores reais ainda exige executar benchmarks da aplicação e consultas PostGIS; o SQL de exemplo não é uma medição.
7. Antes dos repositórios, alinhar `Period` para dias-calendário em UTC e serializar para `DATE` sem desvio de fuso.

## Migrações e deploy

- `docker-compose.yml`: PostGIS local e serviço opcional de migração.
- `database/migrations/*.sql`: migrações numeradas, aplicadas em ordem, sem reaplicação.
- `database/scripts/migrate.sh`: mantém tabela `schema_migrations`, utiliza uma transação com advisory lock para serializar execução.
- Render: criar PostgreSQL gerenciado com PostGIS e btree_gist disponíveis, aplicar as **mesmas migrações** na fase de deploy. Não é necessário hospedar Postgres dentro de contêiner próprio no Render.
- Nada de credenciais reais no Git. `.env` é privado; configuração apresentada é só de desenvolvimento local.
