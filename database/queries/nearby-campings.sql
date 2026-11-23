-- Exemplo parametrizado para o futuro CampingRepository.findNearby.
-- $1: latitude, $2: longitude, $3: raio em km (100 km = 100000 m).
-- Nenhuma interpolação manual de strings do usuário.
WITH origin AS (
  SELECT ST_SetSRID(ST_MakePoint($2::double precision, $1::double precision), 4326)::geography AS point
)
SELECT c.id, c.name, c.latitude, c.longitude, c.active,
       ST_Distance(c.location, origin.point) AS distance_meters
FROM campings c
CROSS JOIN origin
WHERE c.active = true
  AND ST_DWithin(c.location, origin.point, $3::double precision * 1000)
ORDER BY distance_meters, c.id;
