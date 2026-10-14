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
  const { error } = await db.from("stripe_events").insert({ id: event.id });
  if (error?.code === "23505") return new Response("duplicate", { status: 200 });
  return new Response("ok");
}
