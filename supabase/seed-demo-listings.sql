-- =============================================================================
-- Demo listings for BuySellEric (safe to delete later)
-- =============================================================================
-- Run once in Supabase → SQL → New query.
-- Slugs start with "demo-" — remove them anytime with:
--
--   DELETE FROM public.listings WHERE slug LIKE 'demo-%';
--
-- Re-running this INSERT after a delete is fine. If you run it twice without
-- deleting first, you will get a unique constraint error on slug.
-- =============================================================================

INSERT INTO public.listings (
  slug,
  title,
  description,
  price_cents,
  bedrooms,
  bathrooms,
  square_feet,
  address_line,
  city,
  state,
  postal_code,
  status,
  is_published,
  image_urls
) VALUES
(
  'demo-oakridge-colonial',
  'Oakridge Colonial',
  $$Set back from the street on a quiet oak-lined block, this four-bedroom colonial delivers formal living and dining, a sun-filled family room, and a kitchen that opens to a deck made for grilling. Hardwood runs through the main level; the primary suite includes a walk-in closet and renovated bath. Finished basement ideal for media or gym. Walkable to parks and weekly farmers market.$$
    ,
  87500000,
  4,
  3.5,
  2850,
  '1420 Oakridge Drive',
  'Decatur',
  'GA',
  '30033',
  'available',
  true,
  ARRAY[
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=2000&q=85',
    'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=2000&q=85',
    'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=2000&q=85'
  ]::text[]
),
(
  'demo-midtown-loft',
  'Midtown Loft with Skyline Views',
  $$Corner unit on a high floor with floor-to-ceiling glass, concrete floors, and a true chef’s kitchen. Two bedrooms plus a flex space perfect for office or guest. Building offers concierge, gym, and rooftop lounge. Two parking spaces and storage included. Steps to transit, dining, and the arts district.$$
    ,
  64900000,
  2,
  2.0,
  1480,
  '880 Peachtree Street NE, Unit 2401',
  'Atlanta',
  'GA',
  '30308',
  'available',
  true,
  ARRAY[
    'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=2000&q=85',
    'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=2000&q=85',
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=2000&q=85'
  ]::text[]
),
(
  'demo-sunset-terrace-ranch',
  'Sunset Terrace Ranch',
  $$Single-level living on a wide lot with mature landscaping and a covered patio wired for TV and sound. Open kitchen with island seating, quartz counters, and walk-in pantry. Primary suite at the rear for privacy; two additional bedrooms share a hall bath. New roof (2023), tankless water heater, and EV-ready garage.$$
    ,
  48900000,
  3,
  2.0,
  1920,
  '55 Sunset Terrace',
  'Marietta',
  'GA',
  '30067',
  'available',
  true,
  ARRAY[
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=2000&q=85',
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=2000&q=85',
    'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=2000&q=85'
  ]::text[]
),
(
  'demo-lakeview-estate',
  'Lakeview Estate',
  $$Exceptional custom build with main-level guest suite, dedicated office, and great room anchored by a stone fireplace. Kitchen features double islands and butler’s pantry. Upper level: four bedrooms including primary with spa bath and private balcony. Terrace level with bar, theater, and walkout to pool-ready yard. No detail overlooked.$$
    ,
  125000000,
  5,
  4.5,
  5200,
  '1800 Lakeview Court',
  'Alpharetta',
  'GA',
  '30005',
  'available',
  true,
  ARRAY[
    'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=2000&q=85',
    'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=2000&q=85',
    'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=2000&q=85',
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=2000&q=85'
  ]::text[]
),
(
  'demo-riverside-townhome',
  'Riverside Townhome',
  $$End unit with extra windows and a two-car garage. Main level: powder room, living, dining, and kitchen with breakfast bar. Upper level: three bedrooms, laundry, and primary bath with dual vanities. Low HOA covers exterior and greenspace. Quick access to river trails and commuter routes.$$
    ,
  42500000,
  3,
  2.5,
  1850,
  '330 Riverside Parkway, Unit 12',
  'Roswell',
  'GA',
  '30075',
  'pending',
  true,
  ARRAY[
    'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=2000&q=85',
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=2000&q=85'
  ]::text[]
);

-- -----------------------------------------------------------------------------
-- Remove every demo listing (uncomment and run when you are done previewing)
-- -----------------------------------------------------------------------------
-- DELETE FROM public.listings WHERE slug LIKE 'demo-%';
