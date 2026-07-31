-- ============================================================================
-- Shop: a real products catalog + commerce flow (Odosa).
--
-- Distinct from `resources` (services/places): purchasable goods — clothes,
-- books, toys, self-care, etc. — with images, variations, sensory details,
-- and an in-app cart → Stripe checkout → orders → returns → reviews flow.
-- No hardcoded/seeded products: the catalog is populated only by real
-- submissions. Stripe is wired later and gated on STRIPE_SECRET_KEY.
--
-- Idempotent. Run once against the shared Supabase project.
-- ============================================================================

-- ---- Catalog -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,                    -- food, toys, clothing, self-care, crafts, supplies, books, …
  price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  compare_at_price DECIMAL(10, 2) CHECK (compare_at_price IS NULL OR compare_at_price >= 0),
  currency TEXT NOT NULL DEFAULT 'CAD',
  image_urls TEXT[] NOT NULL DEFAULT '{}',
  -- [{ "name": "Size", "options": ["S","M","L"] }, { "name": "Color", "options": ["Black"] }]
  variations JSONB NOT NULL DEFAULT '[]',
  -- { "texture": "Soft", "sound": "None", "visual": "Dark Colored", "material": "Rubber" }
  sensory_details JSONB NOT NULL DEFAULT '{}',
  stock INTEGER CHECK (stock IS NULL OR stock >= 0),   -- NULL = not tracked / unlimited
  seller TEXT,
  status TEXT NOT NULL DEFAULT 'active',      -- 'draft' | 'active' | 'archived'
  submitted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS products_category_idx ON public.products(category);
CREATE INDEX IF NOT EXISTS products_status_idx ON public.products(status);

-- ---- Cart --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  -- selected variation, e.g. { "Size": "M", "Color": "Black" }
  variation JSONB NOT NULL DEFAULT '{}',
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- one row per (user, product, exact variation) so quantities merge cleanly
  UNIQUE (user_id, product_id, variation)
);
CREATE INDEX IF NOT EXISTS cart_items_user_idx ON public.cart_items(user_id);

-- ---- Orders ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'processing',  -- processing | shipped | delivered | cancelled | returned
  subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0,
  taxes DECIMAL(10, 2) NOT NULL DEFAULT 0,
  delivery DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'CAD',
  shipping_address JSONB,
  payment_method TEXT,
  stripe_payment_intent_id TEXT,
  stripe_checkout_session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS orders_user_idx ON public.orders(user_id);

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  -- snapshot of the product at purchase time (name/price/image can change later)
  name TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  image_url TEXT,
  variation JSONB NOT NULL DEFAULT '{}',
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1)
);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON public.order_items(order_id);

-- ---- Returns -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'return_started', -- return_started | dropped_off | received | refunded
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS order_returns_user_idx ON public.order_returns(user_id);

-- ---- Product reviews ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, user_id)
);
CREATE INDEX IF NOT EXISTS product_reviews_product_idx ON public.product_reviews(product_id);

-- ---- RLS ---------------------------------------------------------------------
ALTER TABLE public.products         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_returns    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_reviews  ENABLE ROW LEVEL SECURITY;

-- Products: anyone can read active products; authenticated users can submit;
-- authors can edit their own.
DROP POLICY IF EXISTS products_read ON public.products;
CREATE POLICY products_read ON public.products
  FOR SELECT USING (status = 'active' OR submitted_by = auth.uid());
DROP POLICY IF EXISTS products_insert ON public.products;
CREATE POLICY products_insert ON public.products
  FOR INSERT WITH CHECK (submitted_by = auth.uid());
DROP POLICY IF EXISTS products_update ON public.products;
CREATE POLICY products_update ON public.products
  FOR UPDATE USING (submitted_by = auth.uid());

-- Cart / orders / returns / reviews: owner-scoped.
DROP POLICY IF EXISTS cart_owner ON public.cart_items;
CREATE POLICY cart_owner ON public.cart_items
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS orders_owner ON public.orders;
CREATE POLICY orders_owner ON public.orders
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS order_items_owner ON public.order_items;
CREATE POLICY order_items_owner ON public.order_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid())
  );

DROP POLICY IF EXISTS returns_owner ON public.order_returns;
CREATE POLICY returns_owner ON public.order_returns
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Product reviews: world-readable, owner-writable.
DROP POLICY IF EXISTS product_reviews_read ON public.product_reviews;
CREATE POLICY product_reviews_read ON public.product_reviews
  FOR SELECT USING (true);
DROP POLICY IF EXISTS product_reviews_write ON public.product_reviews;
CREATE POLICY product_reviews_write ON public.product_reviews
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
