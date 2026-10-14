import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
export const runtime = "nodejs";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature")!;
  let event: Stripe.Event;
  try { event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!); }
  catch { return new Response("bad signature", { status: 400 }); }
  const db = createAdminClient();
  // Pending until processed; skip only completed duplicates; a pending retry is processed again.
  const { error } = await db.from("stripe_events").insert({ id: event.id, status: "pending" });
  if (error?.code === "23505") {
    const { data } = await db.from("stripe_events").select("status").eq("id", event.id).maybeSingle();
    if (data?.status === "completed") return new Response("duplicate", { status: 200 });
  } else if (error) return new Response("db error", { status: 500 });
  try {
    // ...idempotent upserts for the event...
    await db.from("stripe_events").update({ status: "completed" }).eq("id", event.id);
  } catch {
    return new Response("retry", { status: 500 });
  }
  return new Response("ok");
}
