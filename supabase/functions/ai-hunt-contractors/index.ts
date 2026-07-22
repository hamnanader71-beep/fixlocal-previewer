// AI Contractor Hunter — finds independent contractors, crews, and service companies
// so admins can build the contractor network.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const {
      keyword = "", category = "", city = "", state = "", country = "USA",
      contractor_type = "any", size = "any", limit = 8,
    } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const sys = `You are an AI scout for GetFixLocal, sourcing real-world contractors, crews and service companies to join our contractor network.
Generate ${limit} realistic contractor prospects. Focus on: independent handymen, plumbing/electrical/HVAC/roofing/cleaning/landscaping crews,
general contractors, moving companies, junk-removal crews, painters, flooring installers, appliance installers, pest control, property preservation crews, commercial janitorial.
For each contractor return: name (company or crew name), category (trade), website, email, phone, city, state, country,
size (solo/small/mid/enterprise), fit_score (0-100 — how well they fit our marketplace),
ai_reasoning (why they'd be a strong contractor partner), suggested_pitch (2-3 sentence outreach to invite them to join the network).
Return JSON: { "contractors": [ ... ] } — no prose, no code fences.`;

    const user = `Filters:
- trade/keyword: ${keyword || "any"}
- category focus: ${category || "any"}
- location: ${[city, state, country].filter(Boolean).join(", ")}
- contractor_type: ${contractor_type}
- size: ${size}
Return ${limit} high-quality contractor prospects.`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
        response_format: { type: "json_object" },
      }),
    });
    if (!r.ok) throw new Error(`AI gateway ${r.status}: ${await r.text()}`);
    const data = await r.json();
    let parsed: any = {};
    try { parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}"); } catch { parsed = { contractors: [] }; }
    return new Response(JSON.stringify({ contractors: parsed.contractors ?? [] }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
