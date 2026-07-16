-- Update "Not a Torque Wrench": subtitle 23g -> 53g, and add closing line
UPDATE articles
SET description = 'On lubrication, karma, and the 53 grams between my face and a sewer grate.',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'not-a-torque-wrench';

UPDATE articles
SET body = REPLACE(body, 'Tighten your bolts. Wear a helmet.', 'These are dark times. Tighten your bolts. Wear a helmet.'),
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'not-a-torque-wrench';
