import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.25.76";

// Universal Lead Hunter — finds public, crawlable service-request pages.
// Source URLs and contact details must come from scraped source evidence only.

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

const BodySchema = z.object({
  action: z.enum(["hunt", "credit_status"]).optional(),
  keyword: z.string().trim().min(2).max(160),
  category: z.string().trim().max(120).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(120).optional(),
  country: z.string().trim().max(120).optional(),
  radius_km: z.number().min(0).max(1000).optional(),
  platform: z.string().trim().max(80).optional(),
  budget_min: z.number().min(0).optional(),
  budget_max: z.number().min(0).optional(),
  posted_within_days: z.number().int().min(1).max(365).optional(),
  segment: z.enum(["residential", "commercial", "any"]).optional(),
  priority: z.enum(["urgent", "normal", "any"]).optional(),
  limit: z.number().int().min(3).max(15).optional(),
});

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
  "tiktok.com",
  "instagram.com",
  "youtube.com",
  "youtu.be",
  "pinterest.",
  "medium.com",
  "substack.com",
  "wikipedia.org",
];

const platformEmailDomains = new Set([
  "facebook.com", "meta.com", "reddit.com", "nextdoor.com", "craigslist.org",
  "upwork.com", "fiverr.com", "linkedin.com", "thumbtack.com", "angi.com",
  "homeadvisor.com", "support.com",
]);

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

const editorialPatterns = [
  /\b(blog|article|guide|how to|tips? for|ideas? for|everything you need to know|what to know|ultimate guide|complete guide)\b/i,
  /\b(read more|related posts?|recent posts?|categories|author|published by|table of contents|subscribe to our newsletter)\b/i,
  /\b(top \d+|best \d+|\d+ ways? to|step-by-step)\b/i,
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
  if (path.includes("/search") || path.includes("/feed") || path.includes("/category/") || path.includes("/blog/") || path.includes("/blogs/") || path.includes("/article/") || path.includes("/articles/") || path.includes("/news/")) return false;
  if (host.includes("facebook.com") || host.includes("fb.com")) {
    return path.includes("/posts/") || path.includes("/permalink/") || path.includes("/groups/") && /\/posts\/\d+/.test(path);
  }
  if (host.includes("nextdoor.com") || host.includes("nextdoor.co.uk")) {
    return path.includes("/p/") || path.includes("/news_feed/") || path.includes("/for_sale_and_free/") || path.includes("/post/");
  }
  if (host.includes("craigslist.org")) return /\/d\/.+\/\d+\.html$/.test(path) || /\/\d+\.html$/.test(path);
  if (host.includes("reddit.com")) return path.includes("/comments/");
  if (host.includes("upwork.com")) return path.includes("/jobs/") || path.includes("/freelance-jobs/apply/");
  if (host.includes("freelancer.com")) return path.includes("/projects/");
  if (host.includes("fiverr.com")) return false;
  return path.split("/").filter(Boolean).length >= 2;
}

function isSocialPostUrl(rawUrl: string): boolean {
  const normalized = normalizeUrl(rawUrl);
  if (!normalized) return false;
  const host = new URL(normalized).hostname.toLowerCase();
  return host.includes("facebook.com") || host.includes("fb.com") || host.includes("nextdoor") || host.includes("reddit.com");
}

function isOftenLockedSource(rawUrl: string): boolean {
  const normalized = normalizeUrl(rawUrl);
  if (!normalized) return true;
  const host = new URL(normalized).hostname.toLowerCase();
  return host.includes("facebook.com") || host.includes("fb.com") || host.includes("nextdoor.com") || host.includes("nextdoor.co.uk");
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
  if (!domain || blockedEmailDomains.has(domain) || platformEmailDomains.has(domain)) return false;
  if (/^(test|fake|sample|demo|no-reply|noreply|admin|support|info|hello|sales|contact|privacy|legal|press|media|careers?|jobs?)@/.test(email)) return false;
  return true;
}

function contactEvidence(text: string): string {
  const windows: string[] = [];
  for (const pattern of buyerIntentPatterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (!match || match.index == null) continue;
    windows.push(text.slice(Math.max(0, match.index - 500), match.index + 1800));
  }
  return windows.join("\n");
}

function extractEmails(text: string): string[] {
  const matches = contactEvidence(text).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
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
  const matches = contactEvidence(text).match(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/g) ?? [];
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
  const editorialScore = countMatches(primaryContent, editorialPatterns);

  if (buyerScore < 1) return false;
  if (editorialScore > 0) return false;
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

function buildSearchQueries(body: Body) {
  const location = [body.city, body.state, body.country].filter(Boolean).join(" ");
  const service = leadServicePhrase(body);
  const intent = `${service} (need OR needed OR looking OR recommend OR hire OR help OR quote OR estimate OR repair)`;
  const exclusions = `-blog -article -guide -tips -career -careers -salary -"free estimate" -"licensed and insured" -"call us" -"our services" -"we offer" -"serving the"`;
  const platformSites: Record<string, string> = {
    Reddit: "site:reddit.com/comments",
    Craigslist: "site:craigslist.org",
    Facebook: "site:facebook.com/groups",
    Nextdoor: "site:nextdoor.com",
    Upwork: "site:upwork.com/jobs",
    Freelancer: "site:freelancer.com/projects",
    LinkedIn: "site:linkedin.com/posts",
  };
  const selectedSite = body.platform && body.platform !== "Any" ? platformSites[body.platform] : undefined;
  const sites = selectedSite
    ? [selectedSite]
    : ["site:reddit.com/comments", "site:craigslist.org", "site:upwork.com/jobs", "site:freelancer.com/projects", "site:facebook.com/groups", "site:nextdoor.com"];

  return sites.map((site, index) => {
    const searchLocation = index < 4 ? location : [body.state, body.country].filter(Boolean).join(" ");
    return `${site} ${intent} ${searchLocation} ${exclusions}`.trim();
  });
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
    if (isOftenLockedSource(rawUrl) && markdown.length < 300) continue;
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

function leadFromDocument(doc: SourceDocument, body: Body) {
  const email = doc.contacts.emails[0] ?? null;
  const phone = doc.contacts.phones[0] ?? null;
  return {
    customer_name: "Source contact",
    service: doc.title || body.keyword,
    description: doc.description || doc.title,
    category: body.category ?? body.keyword,
    city: body.city,
    state: body.state,
    country: body.country,
    source: doc.source,
    source_url: doc.url,
    source_verified: true,
    contact_verified: Boolean(email || phone),
    customer_email: email,
    customer_phone: phone,
    posted_ago_hours: null,
    segment: body.segment === "commercial" ? "commercial" : "residential",
    priority: "medium",
    urgency: "medium",
    estimated_value_low: null,
    estimated_value_high: null,
    recommended_sale_price: null,
    ai_score: 65,
    ai_confidence: 70,
    suggested_reply: null,
    reasoning: "Buyer intent and the exact source URL were verified from the crawlable public request page.",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const parsedBody = BodySchema.safeParse(await req.json());
    if (!parsedBody.success) {
      return jsonResponse({ error: parsedBody.error.flatten().fieldErrors }, 400);
    }
    const body: Body = parsedBody.data;
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

    const limit = Math.min(Math.max(body.limit ?? 8, 3), 15);
    const searchBatches = await Promise.all(
      buildSearchQueries(body).map((query) => firecrawlSearch(query, Math.max(limit * 2, 10), firecrawlAuth)),
    );
    const searchRows = searchBatches.flat();
    const documents = collectDocuments(searchRows, body).slice(0, limit);
    console.log("lead hunt discovery", {
      keyword: body.keyword,
      searchRows: searchRows.length,
      verifiedBuyerDocuments: documents.length,
    });

    if (documents.length === 0) {
      return jsonResponse({
        leads: [],
        filters: body,
        message: "No matching public buyer requests were found for these filters. Try a broader location or a service name such as plumber, roofing, cleaning, or HVAC.",
      });
    }

    const leads = documents.map((doc) => leadFromDocument(doc, body)).slice(0, limit);

    return jsonResponse({
      leads,
      filters: body,
      message: leads.length === 0
        ? "No matching public buyer requests were found. Try a specific service and a broader location."
        : undefined,
    });
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
