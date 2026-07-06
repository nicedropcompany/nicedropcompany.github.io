-- ============================================================
-- NiceDrop — Migração: estado online/offline do ESP32 por drone
-- Executa no Supabase SQL Editor (uma única vez).
-- ============================================================
--
-- O ESP32 tira energia do drone. Se o drone desliga, o ESP32 desliga
-- e deixa de dar sinal. Aqui guardamos a última vez que cada ESP32
-- "deu sinal de vida" (heartbeat) para o site mostrar ONLINE/OFFLINE.
--
-- ------------------------------------------------------------
-- 1) Coluna com a última vez que o ESP32 deu sinal
-- ------------------------------------------------------------
ALTER TABLE drones ADD COLUMN IF NOT EXISTS last_seen timestamptz;

-- ------------------------------------------------------------
-- 2) Função chamada pelo ESP32 a cada ~30s (heartbeat)
--    Usa now() do servidor, por isso o ESP32 não precisa de relógio.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION drone_heartbeat(p_id bigint)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE drones SET last_seen = now() WHERE id = p_id;
$$;

-- O ESP32 liga-se com a anon key, por isso precisa de poder executar
GRANT EXECUTE ON FUNCTION drone_heartbeat(bigint) TO anon, authenticated;

-- ⚠️ Nota (aceitável para PAP): qualquer pessoa com a anon key pode
-- chamar esta função com qualquer id (fazer um drone parecer online).
-- É só um indicador de estado, não é crítico para segurança.
