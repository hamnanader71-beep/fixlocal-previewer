// Universal Lead Hunter — finds public, crawlable service-request pages.
// Source URLs and contact details must come from scraped source evidence only.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
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

const unreliableSourceHosts = [
  "google.",
  "g.page",
  "maps.google",
  "facebook.com",
  "fb.com",
  "nextdoor.com",
  "nextdoor.co.uk",
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

  if (unreliableSourceHosts.some((blocked) => host.includes(blocked))) return false;
  if (["/", "", "/feed", "/home", "/search", "/maps", "/local"].includes(path)) return false;
  if (path.includes("/search") || path.includes("/feed") || path.includes("/category/")) return false;
  if (host.includes("craigslist.org")) return /\/d\/.+\/\d+\.html$/.test(path) || /\/\d+\.html$/.test(path);
  if (host.includes("reddit.com")) return path.includes("/comments/");
  return path.split("/").filter(Boolean).length >= 2;
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

async function firecrawlSearch(query: string, limit: number, lovableKey: string, firecrawlKey: string) {
  const response = await fetch("https://connector-gateway.lovable.dev/firecrawl/v2/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": firecrawlKey,
    },
    body: JSON.stringify({
      query,
      limit,
      scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Lead source search failed [${response.status}]: ${details}`);
  }

  const result = await response.json();
  if (Array.isArray(result.data)) return result.data;
  if (Array.isArray(result.data?.web)) return result.data.web;
  return [];
}

function buildSearchQuery(body: Body) {
  const location = [body.city, body.state, body.country].filter(Boolean).join(" ");
  const platform = body.platform ? `${body.platform} ` : "";
  const category = body.category ? `${body.category} ` : "";
  return `${platform}${category}${body.keyword} service request customer needs help ${location} phone OR email`.trim();
}

function collectDocuments(results: unknown[]): SourceDocument[] {
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
    if (evidence.length < 120) continue;

    seen.add(rawUrl);
    docs.push({
      url: rawUrl,
      title,
      description,
      markdown: evidence.slice(0, 6000),
      source: sourceName(rawUrl),
      contacts: {
        emails: extractEmails(evidence),
        phones: extractPhones(evidence),
      },
    });
  }

  return docs;
}

function sanitizeLead(lead: Record<string, unknown>, doc: SourceDocument, body: Body) {
  const sourceUrl = normalizeUrl(doc.url);
  if (!sourceUrl || !isExactPublicPostUrl(sourceUrl)) return null;
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
    if (!body.keyword || body.keyword.trim().length < 2) {
      return jsonResponse({ error: "keyword is required" }, 400);
    }
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!firecrawlKey) throw new Error("FIRECRAWL_API_KEY not configured");

    const limit = Math.min(Math.max(body.limit ?? 8, 3), 15);
    const searchRows = await firecrawlSearch(buildSearchQuery(body), Math.max(limit * 4, 12), apiKey, firecrawlKey);
    const documents = collectDocuments(searchRows).slice(0, limit);

    if (documents.length === 0) {
      return jsonResponse({
        leads: [],
        filters: body,
        message: "No verified public source posts were found. Try a broader keyword, city, or platform.",
      });
    }

    const system = `You are the Lead Hunter for GetFixLocal, a home & commercial services lead marketplace.
You will receive scraped public source pages. Create one lead per source page using ONLY facts visible in that page.
Do not invent source URLs, names, emails, phone numbers, dates, budgets, or platform details.
The source_url must exactly match the provided document URL.
customer_email and customer_phone must be copied only from the provided verified_contacts arrays. If unavailable, return null.
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

    return jsonResponse({ leads, filters: body });
  } catch (err) {
    console.error("ai-hunt-leads error", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
