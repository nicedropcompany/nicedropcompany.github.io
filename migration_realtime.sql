-- ============================================================
-- NiceDrop — Ativar Realtime + leitura anon para o ESP32
-- Executa no Supabase SQL Editor (uma única vez).
-- ============================================================
--
-- O ESP32 liga-se ao Supabase Realtime com a ANON key. Para receber
-- as mudanças de servo_state / status, faltavam 2 coisas:
--   1) as tabelas têm de estar na publicação de Realtime;
--   2) o role 'anon' tem de poder LER as linhas (a RLS aplica-se ao Realtime).
--
-- ------------------------------------------------------------
-- 1) Ativar Realtime nas tabelas (ignora se já estiverem)
-- ------------------------------------------------------------
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE drones;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE orders;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ------------------------------------------------------------
-- 2) Deixar o ESP32 (anon) LER drones e orders via RLS
--    Sem isto, o Realtime não entrega as mudanças ao ESP32.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "drones_select_anon" ON drones;
CREATE POLICY "drones_select_anon" ON drones
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "orders_select_anon" ON orders;
CREATE POLICY "orders_select_anon" ON orders
  FOR SELECT TO anon USING (true);

-- ⚠️ NOTA DE SEGURANÇA (aceitável para PAP):
--    Isto torna drones/orders legíveis por QUALQUER pessoa com a anon key
--    (que está no JS público), sem login — inclui a wifi_password.
--    É o preço de o ESP32 usar a anon key no Realtime. Para produção real
--    usar-se-ia um utilizador dedicado/token para o ESP32 em vez da anon.
