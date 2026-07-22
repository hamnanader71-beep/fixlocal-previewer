// AI lead qualification using Lovable AI Gateway.
// Public function; caller must be signed in from the app but we skip JWT verify
// so the client can call it directly with the anon key.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  service: string;
  description?: string;
  city?: string;
  state?: string;
  country?: string;
  category?: string;
  source?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body: Body = await req.json();
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are an AI lead qualification analyst for GetFixLocal, a home-services lead marketplace.
Given a raw home-service request, output a strict JSON object with keys:
- score: integer 0-100 (buying intent + job value + clarity)
- confidence: integer 0-100 (how confident you are)
- priority: one of "hot" | "good" | "medium" | "low"
- category: short service category (e.g. Plumbing, HVAC, Roofing, Painting, Deck, Fencing, Remodeling, Landscaping, Electrical, Cleaning)
- urgency: "high" | "medium" | "low"
- is_spam: boolean
- estimated_value_low: number in USD
- estimated_value_high: number in USD
- recommended_sale_price: number in USD (what a contractor should pay for this lead)
- suggested_reply: short professional outreach message (2-3 sentences, use customer's context)
- reasoning: 1-2 sentence explanation
Return ONLY JSON, no markdown, no prose.`;

    const userPrompt = `Service requested: ${body.service}
Description: ${body.description ?? "(none)"}
Location: ${[body.city, body.state, body.country].filter(Boolean).join(", ") || "unknown"}
Source: ${body.source ?? "unknown"}
Category hint: ${body.category ?? "auto-detect"}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (resp.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Please retry shortly." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (resp.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in Cloud settings." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`AI gateway error ${resp.status}: ${t}`);
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(content); } catch { parsed = {}; }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("ai-qualify-lead error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
