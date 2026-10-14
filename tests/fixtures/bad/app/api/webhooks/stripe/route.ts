import Stripe from "stripe";
export const runtime = "edge";
const secret = "whsec_abcdefghijklmnop1234";
export async function POST(request: Request) {
  const event = await request.json();
  if (event.type === "checkout.session.completed") { /* grant access */ }
  return new Response("ok");
}
