-- ============================================================
-- NiceDrop — Row Level Security Policies
-- Executa este script no Supabase SQL Editor
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- HELPER: função para obter o role do utilizador autenticado
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

-- ────────────────────────────────────────────────────────────
-- PROFILES
-- ────────────────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Qualquer utilizador autenticado pode ver todos os perfis (necessário para listar equipa)
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT TO authenticated
  USING (true);

-- Utilizador só pode atualizar o próprio perfil (exceto developers)
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR get_my_role() = 'developer')
  WITH CHECK (id = auth.uid() OR get_my_role() = 'developer');

-- Apenas o próprio utilizador pode inserir o seu perfil
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- ────────────────────────────────────────────────────────────
-- STORES
-- ────────────────────────────────────────────────────────────
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

-- Leitura pública (necessário para marketplace)
CREATE POLICY "stores_select" ON stores
  FOR SELECT TO authenticated
  USING (true);

-- Apenas developers podem criar lojas
CREATE POLICY "stores_insert" ON stores
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'developer');

-- Apenas developers podem apagar lojas
CREATE POLICY "stores_delete" ON stores
  FOR DELETE TO authenticated
  USING (get_my_role() = 'developer');

-- Developers e owners da loja podem atualizar
CREATE POLICY "stores_update" ON stores
  FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'developer'
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND store_id::jsonb @> to_jsonb(stores.id)
        AND role IN ('owner')
    )
  );

-- ────────────────────────────────────────────────────────────
-- DRONES
-- ────────────────────────────────────────────────────────────
ALTER TABLE drones ENABLE ROW LEVEL SECURITY;

-- Utilizadores autenticados podem ver drones (para app móvel)
CREATE POLICY "drones_select" ON drones
  FOR SELECT TO authenticated
  USING (true);

-- Apenas developers podem criar/apagar drones
CREATE POLICY "drones_insert" ON drones
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'developer');

CREATE POLICY "drones_delete" ON drones
  FOR DELETE TO authenticated
  USING (get_my_role() = 'developer');

-- Developers e operators/owners da loja podem atualizar drones
CREATE POLICY "drones_update" ON drones
  FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'developer'
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND store_id::jsonb @> to_jsonb(drones.store_id)
        AND role IN ('owner', 'operator')
    )
  );

-- ────────────────────────────────────────────────────────────
-- ORDERS
-- ────────────────────────────────────────────────────────────
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Clientes veem as suas próprias encomendas
-- Operators/owners veem as encomendas da sua loja
-- Developers veem tudo
CREATE POLICY "orders_select" ON orders
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'developer'
    OR client_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND store_id::jsonb @> to_jsonb(orders.store_id)
        AND role IN ('owner', 'operator')
    )
  );

-- Clientes autenticados podem criar encomendas
CREATE POLICY "orders_insert" ON orders
  FOR INSERT TO authenticated
  WITH CHECK (client_id = auth.uid());

-- Apenas operators/owners da loja ou developers podem atualizar estado
CREATE POLICY "orders_update" ON orders
  FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'developer'
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND store_id::jsonb @> to_jsonb(orders.store_id)
        AND role IN ('owner', 'operator')
    )
  );

-- ────────────────────────────────────────────────────────────
-- PRODUCTS
-- ────────────────────────────────────────────────────────────
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Leitura pública para o marketplace
CREATE POLICY "products_select" ON products
  FOR SELECT TO authenticated
  USING (true);

-- Operators/owners da loja e developers podem gerir produtos
CREATE POLICY "products_insert" ON products
  FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() = 'developer'
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND store_id::jsonb @> to_jsonb(products.store_id)
        AND role IN ('owner', 'operator')
    )
  );

CREATE POLICY "products_update" ON products
  FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'developer'
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND store_id::jsonb @> to_jsonb(products.store_id)
        AND role IN ('owner', 'operator')
    )
  );

CREATE POLICY "products_delete" ON products
  FOR DELETE TO authenticated
  USING (
    get_my_role() = 'developer'
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND store_id::jsonb @> to_jsonb(products.store_id)
        AND role IN ('owner', 'operator')
    )
  );

-- ────────────────────────────────────────────────────────────
-- POSTS
-- ────────────────────────────────────────────────────────────
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Leitura pública (página inicial)
CREATE POLICY "posts_select" ON posts
  FOR SELECT TO authenticated
  USING (true);

-- Operators/owners da loja e developers podem criar/editar/apagar
CREATE POLICY "posts_insert" ON posts
  FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() = 'developer'
    OR (
      posts.store_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
          AND store_id::jsonb @> to_jsonb(posts.store_id)
          AND role IN ('owner', 'operator')
      )
    )
    OR (posts.store_id IS NULL AND get_my_role() = 'developer')
  );

CREATE POLICY "posts_update" ON posts
  FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'developer'
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND store_id::jsonb @> to_jsonb(posts.store_id)
        AND role IN ('owner', 'operator')
    )
  );

CREATE POLICY "posts_delete" ON posts
  FOR DELETE TO authenticated
  USING (
    get_my_role() = 'developer'
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND store_id::jsonb @> to_jsonb(posts.store_id)
        AND role IN ('owner', 'operator')
    )
  );

-- ────────────────────────────────────────────────────────────
-- CATEGORIES
-- ────────────────────────────────────────────────────────────
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Leitura pública
CREATE POLICY "categories_select" ON categories
  FOR SELECT TO authenticated
  USING (true);

-- Apenas developers gerem categorias
CREATE POLICY "categories_insert" ON categories
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'developer');

CREATE POLICY "categories_delete" ON categories
  FOR DELETE TO authenticated
  USING (get_my_role() = 'developer');

-- ────────────────────────────────────────────────────────────
-- ADDRESSES
-- ────────────────────────────────────────────────────────────
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "addresses_all" ON addresses
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ────────────────────────────────────────────────────────────
-- CART
-- ────────────────────────────────────────────────────────────
ALTER TABLE cart ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cart_all" ON cart
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ────────────────────────────────────────────────────────────
-- PARENT_ORDERS (Stripe)
-- ────────────────────────────────────────────────────────────
ALTER TABLE parent_orders ENABLE ROW LEVEL SECURITY;

-- Apenas developers veem todos os pagamentos
CREATE POLICY "parent_orders_select_developer" ON parent_orders
  FOR SELECT TO authenticated
  USING (get_my_role() = 'developer');

-- ────────────────────────────────────────────────────────────
-- WAITLIST (nova tabela para a página de download)
-- Cria esta tabela antes de ativar a policy
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS waitlist (
  id         bigserial PRIMARY KEY,
  email      text NOT NULL,
  platform   text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (email, platform)
);

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Qualquer pessoa pode inserir o seu email (sem autenticação necessária)
CREATE POLICY "waitlist_insert" ON waitlist
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Apenas developers podem ver a lista
CREATE POLICY "waitlist_select" ON waitlist
  FOR SELECT TO authenticated
  USING (get_my_role() = 'developer');
