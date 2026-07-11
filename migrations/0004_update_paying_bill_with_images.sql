-- Update "Paying the Bill" article to include embedded images
UPDATE articles
SET body = body || '

---

![DEA Special Agent badge and business card - Kevin W. Kenney](/images/articles/dea-badge.jpg)

![Family legacy photograph](/images/articles/family-legacy.jpg)',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'paying-the-bill';
