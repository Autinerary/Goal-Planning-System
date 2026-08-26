-- ============================================================================
-- DEMO PRODUCTS — sample catalog so the Shop and search results can be seen
-- with real-looking content (Odosa: "generate some false products, similar to
-- the false services").
--
-- These are DEMO rows, exactly like the seeded demo services. They are marked
-- with seller = 'Demo Seller' so you can remove them all in one line:
--
--     DELETE FROM public.products WHERE seller = 'Demo Seller';
--
-- No images are set on purpose — the app generates a deterministic placeholder
-- from the product name, so these render properly without hosting any files.
--
-- Idempotent: re-running does not duplicate (guarded on name).
-- Requires 2026_shop_products.sql.
-- ============================================================================

INSERT INTO public.products
  (name, description, category, price, compare_at_price, currency, variations, sensory_details, stock, seller, status)
SELECT v.name, v.description, v.category, v.price, v.compare_at_price, 'CAD',
       v.variations::jsonb, v.sensory_details::jsonb, v.stock, 'Demo Seller', 'active'
FROM (VALUES
  ('Loop Experience Earplugs',
   'Reusable earplugs that lower overwhelming volume without muffling speech. Popular for commutes, classrooms, and busy shops.',
   'self-care', 34.00, 45.00,
   '[{"name":"Color","options":["Black","Silver","Rose"]}]',
   '{"texture":"Soft silicone","sound":"Reduces ~18dB","visual":"Low profile","material":"Silicone"}', 40),

  ('Weighted Blanket (7kg)',
   'Evenly weighted blanket for deep-pressure input. Removable, machine-washable cover.',
   'self-care', 89.00, 120.00,
   '[{"name":"Weight","options":["5kg","7kg","9kg"]},{"name":"Color","options":["Grey","Navy"]}]',
   '{"texture":"Soft knit","sound":"Silent","visual":"Matte","material":"Cotton + glass beads"}', 15),

  ('Fidget Cube Set',
   'Six-sided quiet fidget with click, glide, roll and switch surfaces. Pocket-sized for meetings or class.',
   'toys', 18.00, 25.00,
   '[{"name":"Pack","options":["Single","3-pack"]}]',
   '{"texture":"Mixed","sound":"Quiet click","visual":"Solid colour","material":"ABS plastic"}', 60),

  ('Seamless Cotton Tee',
   'Tagless, flat-seam t-shirt designed to avoid common texture triggers.',
   'clothing', 28.00, NULL,
   '[{"name":"Size","options":["XS","S","M","L","XL","2XL"]},{"name":"Color","options":["White","Black","Sage"]}]',
   '{"texture":"Smooth, no tags","sound":"Silent","visual":"Plain","material":"Organic cotton"}', 80),

  ('Unmasking Autism',
   'Devon Price on masking, late diagnosis, and building a life that fits. A frequent community recommendation.',
   'books', 22.00, NULL, '[]',
   '{"texture":"Paperback","visual":"Standard print"}', 25),

  ('Visual Countdown Timer',
   'Shows remaining time as a shrinking coloured disc — no numbers needed. Silent mode included.',
   'supplies', 31.00, 40.00,
   '[{"name":"Size","options":["Small","Large"]}]',
   '{"texture":"Smooth","sound":"Optional silent","visual":"High contrast","material":"Plastic"}', 35),

  ('Chewable Pencil Toppers',
   'Food-grade silicone chew tops for oral sensory seeking. Fits standard pencils. Pack of 4.',
   'supplies', 12.00, NULL,
   '[{"name":"Pack","options":["4-pack","8-pack"]}]',
   '{"texture":"Firm chew","sound":"Silent","visual":"Muted colours","material":"Food-grade silicone"}', 100),

  ('Sensory Art Kit',
   'Tactile art set with kinetic sand, air-dry clay, and textured rollers. Low-mess tray included.',
   'crafts', 45.00, NULL, '[]',
   '{"texture":"Varied","sound":"Quiet","visual":"Bright","material":"Mixed"}', 20),

  ('Noise-Cancelling Headphones (Kids)',
   'Over-ear defenders sized for children, with an adjustable band and folding arms.',
   'self-care', 52.00, 65.00,
   '[{"name":"Color","options":["Teal","Grey"]}]',
   '{"texture":"Padded","sound":"Passive 25dB","visual":"Solid","material":"Foam + ABS"}', 30),

  ('Wobble Cushion',
   'Inflatable seat cushion allowing small movement while seated — helpful for focus during long sitting.',
   'supplies', 27.00, NULL, '[]',
   '{"texture":"Textured top","sound":"Silent","visual":"Single colour","material":"PVC"}', 45),

  ('Compression Vest',
   'Adjustable deep-pressure vest that can be worn under clothing.',
   'clothing', 74.00, 95.00,
   '[{"name":"Size","options":["Youth S","Youth M","Adult S","Adult M","Adult L"]}]',
   '{"texture":"Firm stretch","sound":"Silent","visual":"Plain","material":"Neoprene blend"}', 18),

  ('Liquid Motion Bubbler',
   'Slow-falling liquid timer for calm-down corners and visual regulation.',
   'toys', 14.00, NULL,
   '[{"name":"Color","options":["Blue","Purple","Green"]}]',
   '{"texture":"Smooth","sound":"Silent","visual":"Slow motion","material":"Acrylic"}', 70),

  ('The Autistic Survival Guide to Therapy',
   'Practical guide to finding and shaping therapy that actually fits autistic people.',
   'books', 26.00, NULL, '[]',
   '{"texture":"Paperback","visual":"Standard print"}', 22),

  ('Low-Sensory Snack Sampler',
   'Bland-by-design snack box for restricted diets — consistent texture and no strong smells.',
   'food', 39.00, NULL,
   '[{"name":"Box","options":["Small","Family"]}]',
   '{"texture":"Consistent","sound":"Quiet packaging","visual":"Plain","material":"Assorted"}', 25),

  ('Communication Card Deck',
   'Printed AAC-style cards for needs, feelings, and boundaries. Ring-bound, wipe-clean.',
   'supplies', 33.00, NULL, '[]',
   '{"texture":"Laminated","sound":"Silent","visual":"High contrast","material":"Card stock"}', 40),

  ('Blackout Sleep Mask',
   'Contoured mask with no pressure on the eyes, for light sensitivity and irregular sleep.',
   'self-care', 21.00, 29.00, '[]',
   '{"texture":"Soft","sound":"Silent","visual":"Full blackout","material":"Memory foam"}', 55)
) AS v(name, description, category, price, compare_at_price, variations, sensory_details, stock)
WHERE NOT EXISTS (
  SELECT 1 FROM public.products p WHERE p.name = v.name
);
