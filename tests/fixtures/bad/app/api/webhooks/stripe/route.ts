import Stripe from "stripe";
export const runtime = "edge";
const secret = "whsec_FAKE_FOR_TESTS_NOT_A_REAL_SECRET";
export async function POST(request: Request) {
  const event = await request.json();
  if (event.type === "checkout.session.completed") { /* grant access */ }
  return new Response("ok");
}
