export type LeadRow = {
  id: string;
  lead_code: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  service: string;
  category: string | null;
  description: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  source: string | null;
  status: "new" | "qualified" | "review" | "rejected" | "sold" | "assigned";
  priority: "hot" | "good" | "medium" | "low" | null;
  routing: "unassigned" | "internal_crew" | "subcontractor" | "exclusive_sale" | "shared_sale" | "marketplace" | "archived";
  ai_score: number | null;
  ai_confidence: number | null;
  ai_reasoning: string | null;
  urgency: string | null;
  estimated_value_low: number | null;
  estimated_value_high: number | null;
  recommended_sale_price: number | null;
  suggested_reply: string | null;
  is_duplicate: boolean;
  is_spam: boolean;
  created_at: string;
  updated_at: string;
};

export function relativeTime(iso: string) {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}
