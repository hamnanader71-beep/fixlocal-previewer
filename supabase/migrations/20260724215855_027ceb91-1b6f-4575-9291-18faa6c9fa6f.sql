UPDATE public.leads
SET
  customer_email = CASE
    WHEN customer_email IS NULL THEN NULL
    WHEN lower(customer_email) ~ '(^|@)(test|fake|sample|demo|example|invalid|email|domain|mailinator)\.' THEN NULL
    WHEN lower(customer_email) ~ '^(test|fake|sample|demo|no-reply|noreply|admin)@' THEN NULL
    WHEN lower(customer_email) LIKE '%@example.%' THEN NULL
    ELSE customer_email
  END,
  customer_phone = CASE
    WHEN customer_phone IS NULL THEN NULL
    WHEN regexp_replace(customer_phone, '\D', '', 'g') IN ('1234567890','0123456789','0000000000','1111111111','2222222222','3333333333','4444444444','5555555555','6666666666','7777777777','8888888888','9999999999') THEN NULL
    WHEN regexp_replace(customer_phone, '\D', '', 'g') ~ '555\d{4}$' THEN NULL
    ELSE customer_phone
  END,
  source_url = CASE
    WHEN source_url IS NULL THEN NULL
    WHEN lower(source_url) ~ '(facebook\.com|fb\.com|nextdoor\.|google\.|g\.page|maps\.google)' THEN NULL
    WHEN lower(source_url) ~ '(\/feed\/?$|\/home\/?$|\/search|\/maps\/?$|\/local\/?$)' THEN NULL
    ELSE source_url
  END,
  ai_reasoning = CASE
    WHEN ai_reasoning IS NULL THEN 'Legacy lead cleaned: unavailable contact data is shown as Not Available and unreliable source links were removed.'
    ELSE ai_reasoning || E'\nLegacy lead cleaned: unavailable contact data is shown as Not Available and unreliable source links were removed.'
  END
WHERE
  customer_email IS NOT NULL
  OR customer_phone IS NOT NULL
  OR source_url IS NOT NULL;