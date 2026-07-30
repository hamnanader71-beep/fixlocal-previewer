// Universal Lead Hunter — finds public, crawlable service-request pages.
// Source URLs and contact details must come from scraped source evidence only.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  action?: "hunt" | "credit_status";
  keyword: string;
  category?: string;
  city?: string;
  state?: string;
  country?: string;
  radius_km?: number;
  platform?: string;
  budget_min?: number;
  budget_max?: number;
  posted_within_days?: number;
  segment?: "residential" | "commercial" | "any";
  priority?: "urgent" | "normal" | "any";
  limit?: number;
}

interface FirecrawlCredits {
  remainingCredits: number | null;
  planCredits: number | null;
  billingPeriodStart: string | null;
  billingPeriodEnd: string | null;
  exhausted: boolean;
}

interface SourceDocument {
  url: string;
  title: string;
  description: string;
  markdown: string;
  source: string;
  contacts: {
    emails: string[];
    phones: string[];
  };
}

interface FirecrawlAuth {
  mode: "direct" | "gateway";
  firecrawlKey: string;
  lovableKey?: string;
  baseUrl: string;
}

const blockedEmailDomains = new Set([
  "example.com",
  "example.org",
  "example.net",
  "email.com",
  "test.com",
  "mailinator.com",
  "invalid.com",
  "domain.com",
]);

const blockedSourceHosts = [
  "google.",
  "g.page",
  "maps.google",
];

const buyerIntentPatterns = [
  /\b(i|we|my|our)\s+(need|needs|needed|want|wanted|looking for|look for|seeking|hiring|hire)\b/i,
  /\b(need|needed|looking for|seeking|iso|in search of|recommendations? for|anyone know|can anyone recommend|can someone|who can|help needed|quote needed|estimate needed|repair needed|urgent help)\b/i,
  /\b(need someone|looking to hire|trying to find|does anyone have|does anyone know|please recommend|need a quote|need an estimate)\b/i,
];

const providerOfferPatterns = [
  /\b(we|we're|we are|i|i'm|i am|our team|our company)\s+(offer|provide|specialize|serve|install|repair|handle|do|can help|are available)\b/i,
  /\b(licensed and insured|licensed & insured|free estimates?|call us|call now|book now|schedule service|schedule today|contact us|visit our website|get a quote|request a quote)\b/i,
  /\b(proudly serving|serving the|service area|years of experience|family owned|locally owned|professional services?|quality service|affordable rates?)\b/i,
  /\b(services include|our services|residential and commercial|commercial and residential|available 24\/?7|emergency services?)\b/i,
  /\b(for sale|selling|promotion|discount|deal|limited time offer)\b/i,
];

const directoryOrProviderTitlePatterns = [
  /\b(best|top|near me|services?|company|companies|contractors?|pros?|professionals?)\b/i,
];

const providerContactContextPatterns = [
  /\b(call us|contact us|book now|schedule|free estimates?|licensed|insured|our team|our company|we offer|we provide|services include)\b/i,
];

const unavailablePagePatterns = [
  /\b(this content isn't available|content is not available|page not found|404|not found|login to continue|log in to continue)\b/i,
];

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function readNestedString(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const nested = (value as Record<string, unknown>)[key];
  return typeof nested === "string" ? nested : undefined;
}

function isExactPublicPostUrl(rawUrl: string): boolean {
  const normalized = normalizeUrl(rawUrl);
  if (!normalized) return false;
  const url = new URL(normalized);
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const path = url.pathname.toLowerCase();

  if (blockedSourceHosts.some((blocked) => host.includes(blocked))) return false;
  if (["/", "", "/feed", "/home", "/search", "/maps", "/local"].includes(path)) return false;
  if (path.includes("/search") || path.includes("/feed") || path.includes("/category/")) return false;
  if (host.includes("facebook.com") || host.includes("fb.com")) {
    return path.includes("/posts/") || path.includes("/permalink/") || path.includes("/groups/") && /\/posts\/\d+/.test(path);
  }
  if (host.includes("nextdoor.com") || host.includes("nextdoor.co.uk")) {
    return path.includes("/p/") || path.includes("/news_feed/") || path.includes("/for_sale_and_free/") || path.includes("/post/");
  }
  if (host.includes("craigslist.org")) return /\/d\/.+\/\d+\.html$/.test(path) || /\/\d+\.html$/.test(path);
  if (host.includes("reddit.com")) return path.includes("/comments/");
  return path.split("/").filter(Boolean).length >= 2;
}

function isSocialPostUrl(rawUrl: string): boolean {
  const normalized = normalizeUrl(rawUrl);
  if (!normalized) return false;
  const host = new URL(normalized).hostname.toLowerCase();
  return host.includes("facebook.com") || host.includes("fb.com") || host.includes("nextdoor") || host.includes("reddit.com");
}

function sourceName(rawUrl: string): string {
  const host = new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, "");
  if (host.includes("craigslist")) return "Craigslist";
  if (host.includes("reddit")) return "Reddit";
  if (host.includes("facebook")) return "Facebook";
  if (host.includes("nextdoor")) return "Nextdoor";
  return host.split(".").slice(-2, -1)[0]?.replace(/\b\w/g, (c) => c.toUpperCase()) || host;
}

function validEmail(value: string): boolean {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  const domain = email.split("@")[1];
  if (!domain || blockedEmailDomains.has(domain)) return false;
  if (/^(test|fake|sample|demo|no-reply|noreply|admin)@/.test(email)) return false;
  return true;
}

function extractEmails(text: string): string[] {
  const matches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  return [...new Set(matches.map((e) => e.toLowerCase()).filter(validEmail))].slice(0, 2);
}

function validPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return false;
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (/(\d)\1{6,}/.test(local)) return false;
  if (/555\d{4}$/.test(local) || /555/.test(local.slice(3, 6))) return false;
  if (["1234567890", "0123456789", "0000000000"].includes(local)) return false;
  return true;
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (local.length === 10) return `+1${local}`;
  return `+${digits}`;
}

function extractPhones(text: string): string[] {
  const matches = text.match(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/g) ?? [];
  return [...new Set(matches.filter(validPhone).map(formatPhone))].slice(0, 2);
}

function countMatches(text: string, patterns: RegExp[]) {
  return patterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
}

function serviceKeywords(body: Body): string[] {
  const ignored = new Set(["need", "needed", "service", "services", "help", "someone", "looking", "hire", "for", "the", "and", "want", "wanted", "recommend", "recommendation", "recommendations"]);
  return [body.keyword, body.category]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 1)
    .flatMap((value) => value.toLowerCase().match(/[a-z0-9]+/g) ?? [])
    .map((token) => token.replace(/ing$|ers$|er$|s$/i, ""))
    .filter((token) => token.length > 2 && !ignored.has(token));
}

function leadServicePhrase(body: Body): string {
  const raw = [body.category, body.keyword]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .toLowerCase()
    .replace(/\b(i|we|my|our|a|an|the|need|needed|want|wanted|looking|look|for|seeking|hiring|hire|iso|in search of|recommendations?|can anyone recommend|does anyone know|someone|to|who can)\b/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!raw) return body.keyword.trim();
  const aliases: Record<string, string> = {
    plumbing: "plumber",
    electrical: "electrician",
    roofing: "roofer",
    cleaning: "cleaner",
    landscaping: "landscaper",
    painting: "painter",
    hvac: "hvac technician",
  };
  return aliases[raw] ?? raw;
}

function serviceMatches(text: string, body: Body): boolean {
  const terms = [body.keyword, body.category]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 1)
    .map((value) => value.trim().toLowerCase());
  const tokens = serviceKeywords(body);
  if (terms.length === 0 && tokens.length === 0) return true;
  return terms.some((term) => text.includes(term)) || tokens.some((token) => text.includes(token));
}

function hasBuyerRequestEvidence(text: string, body: Body): boolean {
  const normalized = text.toLowerCase();
  if (countMatches(normalized, unavailablePagePatterns) > 0) return false;
  if (!serviceMatches(normalized, body)) return false;

  const primaryContent = normalized.slice(0, 2500);
  const buyerScore = countMatches(primaryContent, buyerIntentPatterns);
  const providerScore = countMatches(primaryContent, providerOfferPatterns);
  const title = normalized.split("\n")[0] ?? "";
  const titleLooksLikeProvider = directoryOrProviderTitlePatterns.some((pattern) => pattern.test(title));

  if (buyerScore < 1) return false;
  if (providerScore > buyerScore + 1) return false;
  if (titleLooksLikeProvider && providerScore > 0) return false;
  return true;
}

function looksLikeProviderResult(text: string): boolean {
  const normalized = text.toLowerCase();
  const providerScore = countMatches(normalized.slice(0, 1800), providerOfferPatterns);
  const buyerScore = countMatches(normalized.slice(0, 1800), buyerIntentPatterns);
  return providerScore > buyerScore + 1;
}

function getFirecrawlAuth(): FirecrawlAuth {
  const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY")?.trim();
  if (!firecrawlKey) throw new Error("FIRECRAWL_API_KEY not configured");

  if (firecrawlKey.startsWith("lovc_")) {
    const lovableKey = Deno.env.get("LOVABLE_API_KEY")?.trim();
    if (!lovableKey) throw new Error("LOVABLE_API_KEY not configured for Firecrawl connector gateway");
    return {
      mode: "gateway",
      firecrawlKey,
      lovableKey,
      baseUrl: "https://connector-gateway.lovable.dev/firecrawl/v2",
    };
  }

  return {
    mode: "direct",
    firecrawlKey,
    baseUrl: "https://api.firecrawl.dev/v2",
  };
}

function firecrawlHeaders(auth: FirecrawlAuth, includeContentType = false): HeadersInit {
  const headers: Record<string, string> = {};
  if (includeContentType) headers["Content-Type"] = "application/json";

  if (auth.mode === "gateway") {
    headers.Authorization = `Bearer ${auth.lovableKey}`;
    headers["X-Connection-Api-Key"] = auth.firecrawlKey;
  } else {
    headers.Authorization = `Bearer ${auth.firecrawlKey}`;
  }

  return headers;
}

function firecrawlErrorMessage(status: number, details: string, context: "credit check" | "search") {
  if (status === 401) {
    return `Firecrawl ${context} failed [401]: the saved FIRECRAWL_API_KEY is not authorized. Please update the Firecrawl secret with the current API key from your Firecrawl account.`;
  }
  if (status === 402) {
    return `Firecrawl ${context} failed [402]: credits are exhausted. Please top up or upgrade the connected Firecrawl account.`;
  }
  return `Firecrawl ${context} failed [${status}]: ${details}`;
}

async function firecrawlSearch(query: string, limit: number, auth: FirecrawlAuth) {
  const response = await fetch(`${auth.baseUrl}/search`, {
    method: "POST",
    headers: firecrawlHeaders(auth, true),
    body: JSON.stringify({
      query,
      limit,
      scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(firecrawlErrorMessage(response.status, details, "search"));
  }

  const result = await response.json();
  if (Array.isArray(result.data)) return result.data;
  if (Array.isArray(result.data?.web)) return result.data.web;
  return [];
}

async function firecrawlCreditStatus(auth: FirecrawlAuth): Promise<FirecrawlCredits> {
  const response = await fetch(`${auth.baseUrl}/team/credit-usage`, {
    method: "GET",
    headers: firecrawlHeaders(auth),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(firecrawlErrorMessage(response.status, details, "credit check"));
  }

  const result = await response.json();
  const data = result?.data && typeof result.data === "object" ? result.data as Record<string, unknown> : {};
  const remainingCredits = typeof data.remainingCredits === "number" ? data.remainingCredits : null;
  const planCredits = typeof data.planCredits === "number" ? data.planCredits : null;
  const billingPeriodStart = typeof data.billingPeriodStart === "string" ? data.billingPeriodStart : null;
  const billingPeriodEnd = typeof data.billingPeriodEnd === "string" ? data.billingPeriodEnd : null;

  return {
    remainingCredits,
    planCredits,
    billingPeriodStart,
    billingPeriodEnd,
    exhausted: remainingCredits != null && remainingCredits <= 0,
  };
}

function buildSearchQuery(body: Body) {
  const location = [body.city, body.state, body.country].filter(Boolean).join(" ");
  const platform = body.platform ? `${body.platform} ` : "";
  const service = leadServicePhrase(body);
  return `${platform}("need a ${service}" OR "need ${service}" OR "looking for a ${service}" OR "looking for ${service}" OR "ISO ${service}" OR "${service} needed" OR "can anyone recommend ${service}" OR "does anyone know a ${service}") ${location} -jobs -career -careers -salary -hiring -"free estimate" -"licensed and insured" -"call us" -"our services" -"we offer" -"serving the"`.trim();
}

function collectDocuments(results: unknown[], body: Body): SourceDocument[] {
  const docs: SourceDocument[] = [];
  const seen = new Set<string>();

  for (const item of results) {
    const row = item as Record<string, unknown>;
    const rawUrl = normalizeUrl(row.url ?? row.sourceURL ?? readNestedString(row.metadata, "sourceURL"));
    if (!rawUrl || seen.has(rawUrl) || !isExactPublicPostUrl(rawUrl)) continue;
    const markdown = typeof row.markdown === "string" ? row.markdown : "";
    const title = typeof row.title === "string" ? row.title : readNestedString(row.metadata, "title") ?? "";
    const description = typeof row.description === "string" ? row.description : "";
    const evidence = `${title}\n${description}\n${markdown}`.trim();
    if (evidence.length < (isSocialPostUrl(rawUrl) ? 45 : 120)) continue;
    if (looksLikeProviderResult(evidence)) continue;
    if (!hasBuyerRequestEvidence(evidence, body)) continue;

    const contacts = {
      emails: extractEmails(evidence),
      phones: extractPhones(evidence),
    };

    seen.add(rawUrl);
    docs.push({
      url: rawUrl,
      title,
      description,
      markdown: evidence.slice(0, 6000),
      source: sourceName(rawUrl),
      contacts,
    });
  }

  return docs;
}

function fallbackLeadFromDocument(doc: SourceDocument, body: Body) {
  const service = doc.title || `${leadServicePhrase(body)} request`;
  const description = doc.description || doc.markdown.split("\n").find((line) => line.trim().length > 30)?.trim() || service;
  return sanitizeLead({
    customer_name: "Source contact",
    service,
    description,
    category: body.category ?? leadServicePhrase(body),
    city: body.city,
    state: body.state,
    country: body.country,
    source: doc.source,
    source_url: doc.url,
    doc_url: doc.url,
    posted_ago_hours: null,
    segment: body.segment === "commercial" ? "commercial" : "residential",
    priority: doc.contacts.emails.length || doc.contacts.phones.length ? "good" : "medium",
    urgency: countMatches(`${doc.title}\n${doc.description}`.toLowerCase(), [/\burgent\b/i, /\bemergency\b/i, /\basap\b/i]) ? "high" : "medium",
    estimated_value_low: null,
    estimated_value_high: null,
    recommended_sale_price: doc.contacts.emails.length || doc.contacts.phones.length ? 25 : 10,
    ai_score: doc.contacts.emails.length || doc.contacts.phones.length ? 78 : 68,
    ai_confidence: doc.markdown.length > 0 ? 76 : 62,
    suggested_reply: "Hi, I saw your service request and can connect you with a vetted local pro. What time works best to discuss the job details?",
    reasoning: "Buyer intent was visible in the public source title or description.",
    customer_email: doc.contacts.emails[0] ?? null,
    customer_phone: doc.contacts.phones[0] ?? null,
  }, doc, body);
}

function sanitizeLead(lead: Record<string, unknown>, doc: SourceDocument, body: Body) {
  const sourceUrl = normalizeUrl(doc.url);
  if (!sourceUrl || !isExactPublicPostUrl(sourceUrl)) return null;
  const evidence = `${doc.title}\n${doc.description}\n${doc.markdown}`;
  if (!hasBuyerRequestEvidence(evidence, body)) return null;
  const email = typeof lead.customer_email === "string" && doc.contacts.emails.includes(lead.customer_email.toLowerCase())
    ? lead.customer_email.toLowerCase()
    : doc.contacts.emails[0] ?? null;
  const phone = typeof lead.customer_phone === "string" && doc.contacts.phones.includes(formatPhone(lead.customer_phone))
    ? formatPhone(lead.customer_phone)
    : doc.contacts.phones[0] ?? null;

  return {
    customer_name: typeof lead.customer_name === "string" && lead.customer_name.trim() ? lead.customer_name.trim() : "Source contact",
    service: typeof lead.service === "string" && lead.service.trim() ? lead.service.trim() : doc.title || body.keyword,
    description: typeof lead.description === "string" && lead.description.trim() ? lead.description.trim() : doc.description || doc.title,
    category: typeof lead.category === "string" ? lead.category : body.category ?? body.keyword,
    city: typeof lead.city === "string" ? lead.city : body.city,
    state: typeof lead.state === "string" ? lead.state : body.state,
    country: typeof lead.country === "string" ? lead.country : body.country,
    source: doc.source,
    source_url: sourceUrl,
    source_verified: true,
    contact_verified: Boolean(email || phone),
    customer_email: email,
    customer_phone: phone,
    posted_ago_hours: typeof lead.posted_ago_hours === "number" ? lead.posted_ago_hours : null,
    segment: lead.segment === "commercial" ? "commercial" : "residential",
    priority: ["hot", "good", "medium", "low"].includes(String(lead.priority)) ? lead.priority : "medium",
    urgency: ["high", "medium", "low"].includes(String(lead.urgency)) ? lead.urgency : "medium",
    estimated_value_low: typeof lead.estimated_value_low === "number" ? lead.estimated_value_low : null,
    estimated_value_high: typeof lead.estimated_value_high === "number" ? lead.estimated_value_high : null,
    recommended_sale_price: typeof lead.recommended_sale_price === "number" ? lead.recommended_sale_price : null,
    ai_score: typeof lead.ai_score === "number" ? lead.ai_score : 60,
    ai_confidence: typeof lead.ai_confidence === "number" ? Math.min(lead.ai_confidence, 85) : 70,
    suggested_reply: typeof lead.suggested_reply === "string" ? lead.suggested_reply : null,
    reasoning: typeof lead.reasoning === "string" ? lead.reasoning : "Verified from a crawlable public source page.",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body: Body = await req.json();
    const firecrawlAuth = getFirecrawlAuth();
    const apiKey = Deno.env.get("LOVABLE_API_KEY")?.trim();
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const credits = await firecrawlCreditStatus(firecrawlAuth);
    if (body.action === "credit_status") {
      return jsonResponse({
        credits,
        message: credits.exhausted
          ? "Lead source credits are exhausted. Hunting is paused until the connected Firecrawl account is topped up or upgraded."
          : "Lead source credits are available.",
      });
    }

    if (credits.exhausted) {
      return jsonResponse({
        error: "Lead source credits are exhausted. Hunting is paused until the connected Firecrawl account is topped up or upgraded.",
        credits,
      }, 402);
    }

    if (!body.keyword || body.keyword.trim().length < 2) {
      return jsonResponse({ error: "keyword is required" }, 400);
    }

    const limit = Math.min(Math.max(body.limit ?? 8, 3), 15);
    const searchRows = await firecrawlSearch(buildSearchQuery(body), Math.max(limit * 5, 15), firecrawlAuth);
    const documents = collectDocuments(searchRows, body).slice(0, limit);

    if (documents.length === 0) {
      return jsonResponse({
        leads: [],
        filters: body,
        message: "No buyer-request source posts were found. Provider ads and seller posts were filtered out.",
      });
    }

    const system = `You are the Lead Hunter for GetFixLocal, a home & commercial services lead marketplace.
You will receive scraped public source pages. Create one lead per source page using ONLY facts visible in that page.
Only include posts from people who need, request, or want to hire a service provider.
Reject posts from service providers, crews, companies, contractors, directories, ads, promotions, or anyone selling their services.
Do not invent source URLs, names, emails, phone numbers, dates, budgets, or platform details.
The source_url must exactly match the provided document URL.
customer_email and customer_phone must be copied only from the provided verified_contacts arrays. If unavailable, return null.
If the page does not clearly show buyer intent, return no lead for that page.
Return STRICT JSON: { "leads": [ ... ] } with each lead having:
- doc_url: exact source URL from the input document
- customer_name: visible requester/company name if present, otherwise "Source contact"
- service: concrete 1-line request tied to the keyword
- description: 1-2 sentence excerpt/summary from the source page
- category: short service category
- city, state, country
- source: platform/domain name from the input document
- source_url: exact input document URL
- posted_ago_hours: integer
- segment: "residential" | "commercial"
- priority: "hot" | "good" | "medium" | "low"
- urgency: "high" | "medium" | "low"
- estimated_value_low: USD number
- estimated_value_high: USD number
- recommended_sale_price: USD number (what a contractor should pay for this lead)
- ai_score: 0-100
- ai_confidence: 0-100
- suggested_reply: 2-3 sentence outreach message
- reasoning: 1 sentence citing what was visible in the source page
- customer_email: verified email from verified_contacts.emails, or null
- customer_phone: verified phone from verified_contacts.phones, or null
Return ONLY JSON.`;

    const filters = [
      `Keyword: ${body.keyword}`,
      body.category ? `Category: ${body.category}` : "",
      body.city ? `City: ${body.city}` : "",
      body.state ? `State: ${body.state}` : "",
      body.country ? `Country: ${body.country}` : "",
      body.radius_km ? `Radius: ${body.radius_km} km` : "",
      body.platform ? `Platform: ${body.platform}` : "",
      body.budget_min != null ? `Budget min: $${body.budget_min}` : "",
      body.budget_max != null ? `Budget max: $${body.budget_max}` : "",
      body.posted_within_days ? `Posted within: last ${body.posted_within_days} days if visible in the source` : "",
      body.segment && body.segment !== "any" ? `Segment: ${body.segment}` : "",
      body.priority && body.priority !== "any" ? `Priority: ${body.priority}` : "",
      `Verified source documents: ${JSON.stringify(documents.map((doc) => ({
        url: doc.url,
        title: doc.title,
        source: doc.source,
        verified_contacts: doc.contacts,
        content: doc.markdown,
      })))}`,
    ].filter(Boolean).join("\n");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: filters },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (resp.status === 429) {
      return jsonResponse({ error: "Rate limit exceeded. Try again shortly." }, 429);
    }
    if (resp.status === 402) {
      return jsonResponse({ error: "AI credits exhausted. Add credits in Cloud settings." }, 402);
    }
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`AI gateway error ${resp.status}: ${t}`);
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(content); } catch { parsed = {}; }
    const rawLeads = Array.isArray((parsed as { leads?: unknown[] }).leads) ? (parsed as { leads: unknown[] }).leads : [];
    const docByUrl = new Map(documents.map((doc) => [doc.url, doc]));
    const leads = rawLeads
      .map((lead) => {
        const row = lead as Record<string, unknown>;
        const sourceUrl = normalizeUrl(row.source_url ?? row.doc_url);
        const doc = sourceUrl ? docByUrl.get(sourceUrl) : null;
        return doc ? sanitizeLead(row, doc, body) : null;
      })
      .filter(Boolean)
      .slice(0, limit);

    const finalLeads = leads.length > 0
      ? leads
      : documents.map((doc) => fallbackLeadFromDocument(doc, body)).filter(Boolean).slice(0, limit);

    return jsonResponse({ leads: finalLeads, filters: body });
  } catch (err) {
    console.error("ai-hunt-leads error", err);
    const message = (err as Error).message;
    if (message.includes("[402]") || message.toLowerCase().includes("insufficient credits") || message.toLowerCase().includes("credits are exhausted")) {
      return jsonResponse({
        error: "Lead search credits are exhausted. Please top up or upgrade the connected Firecrawl account, then try again.",
      }, 402);
    }
    if (message.includes("[401]") || message.toLowerCase().includes("not authorized") || message.toLowerCase().includes("unauthorized")) {
      return jsonResponse({
        error: "Firecrawl API key is not authorized. Please update the saved FIRECRAWL_API_KEY with the current key from your Firecrawl account, then recheck.",
      }, 401);
    }
    return jsonResponse({ error: message }, 500);
  }
});
