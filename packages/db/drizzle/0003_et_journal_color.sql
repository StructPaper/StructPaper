-- The ET sample PDF has no brand colour (it prints in plain black). 0F4761 was only Word's default heading colour.
UPDATE "journals" SET "settings" = jsonb_set("settings", '{color}', '"#000000"') WHERE "slug" = 'vnuhcm-et' AND "settings"->>'color' = '#0F4761';
