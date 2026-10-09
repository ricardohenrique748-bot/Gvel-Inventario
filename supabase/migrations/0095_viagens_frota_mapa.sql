-- Viagens no mapa (aba Consumo → Viagens): coordenadas de origem/destino e o
-- traçado da rota calculada (OpenStreetMap/OSRM), para desenhar as viagens no
-- mapa. A distância e o tempo continuam em distancia_estimada_km e
-- tempo_estimado_horas (0063).

alter table viagens_frota
  add column if not exists origem_lat numeric(9, 6),
  add column if not exists origem_lng numeric(9, 6),
  add column if not exists destino_lat numeric(9, 6),
  add column if not exists destino_lng numeric(9, 6),
  -- [[lat, lng], ...] simplificado (algumas centenas de pontos no máximo).
  add column if not exists rota_coordenadas jsonb;
