// Universal AI Lead Hunter — generates realistic prospective leads
// matching a user's custom keyword + filters. Returns synthesized prospects
// with realistic budgets, urgency, and sources. The operator can then save
// any of them into the real leads table for qualification & routing.

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body: Body = await req.json();
    if (!body.keyword || body.keyword.trim().length < 2) {
      return new Response(JSON.stringify({ error: "keyword is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const limit = Math.min(Math.max(body.limit ?? 8, 3), 15);

    const system = `You are the AI Lead Hunter for GetFixLocal, a universal home & commercial services lead marketplace.
Given a keyword and filters, synthesize ${limit} realistic prospective service-request leads that a hunter agent could plausibly discover across public sources (Craigslist, Facebook groups, Nextdoor, Reddit, Thumbtack, Angi, HomeAdvisor, Yelp, Google Business, subreddits, city forums, property-management sites, etc.).
Every lead MUST match the provided filters (keyword, location, budget, segment, priority, platform if given).
Return STRICT JSON: { "leads": [ ... ] } with each lead having:
- customer_name: realistic first name + last initial (e.g. "Sarah M.")
- service: concrete 1-line request tied to the keyword
- description: 1-2 sentence customer post excerpt (natural language)
- category: short service category
- city, state, country
- source: platform name (Craigslist, Facebook, Nextdoor, Reddit, Thumbtack, Angi, Google, etc.)
- source_url_hint: plausible-looking URL pattern (illustrative only)
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
- reasoning: 1 sentence why it's a fit
Do NOT invent phone/email — leave those out. Return ONLY JSON.`;

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
      body.posted_within_days ? `Posted within: last ${body.posted_within_days} days` : "",
      body.segment && body.segment !== "any" ? `Segment: ${body.segment}` : "",
      body.priority && body.priority !== "any" ? `Priority: ${body.priority}` : "",
    ].filter(Boolean).join("\n");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: filters },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (resp.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (resp.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Cloud settings." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`AI gateway error ${resp.status}: ${t}`);
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(content); } catch { parsed = {}; }
    const leads = Array.isArray((parsed as { leads?: unknown[] }).leads) ? (parsed as { leads: unknown[] }).leads : [];

    return new Response(JSON.stringify({ leads, filters: body }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("ai-hunt-leads error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
