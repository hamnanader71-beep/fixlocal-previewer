UPDATE public.leads
SET status = 'review',
    is_spam = true,
    ai_reasoning = 'Quarantined: no verified public requester contact was captured from the exact source post.'
WHERE source_url IS NOT NULL
  AND customer_email IS NULL
  AND customer_phone IS NULL
  AND status NOT IN ('rejected', 'sold');

UPDATE public.leads
SET status = 'review',
    is_spam = true,
    ai_reasoning = 'Quarantined: directory/provider page is not an authentic buyer request.'
WHERE lower(coalesce(source, '')) IN ('yelp', 'google', 'tiktok', 'instagram');