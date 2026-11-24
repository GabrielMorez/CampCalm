-- Adiciona endereço legível sem alterar ou apagar coordenadas históricas.
-- Campings existentes ficam com address_text NULL até atualização do proprietário.
ALTER TABLE campings
  ADD COLUMN address_text TEXT;

ALTER TABLE campings
  ADD CONSTRAINT campings_address_text_nonempty
  CHECK (
    address_text IS NULL OR
    (length(btrim(address_text)) BETWEEN 5 AND 350)
  );
