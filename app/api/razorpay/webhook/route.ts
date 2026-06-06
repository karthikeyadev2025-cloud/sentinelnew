import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabase } from "../../../lib/supabase";

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature") || "";
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "mockWebhookSecret12345";

    // Validate signature via crypto HMAC hex digest
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    const isVerified = expectedSignature === signature;

    if (!isVerified) {
      console.warn("Razorpay Webhook signature verification failed.");
      // If a secret key is explicitly set, enforce verification
      if (process.env.RAZORPAY_WEBHOOK_SECRET) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
      }
    }

    const payload = JSON.parse(rawBody);
    const event = payload.event;

    if (event === "payment.captured") {
      const payment = payload.payload.payment.entity;
      const orderId = payment.order_id;
      const ledgerId = payment.notes?.ledgerId;

      if (ledgerId) {
        console.log(`Razorpay payment captured for ledger: ${ledgerId}, Order: ${orderId}`);
        
        // Update database table entry
        const { error } = await supabase
          .from("billing_ledgers")
          .update({ payment_status: "Paid_Razorpay" })
          .eq("id", ledgerId);

        if (error) {
          console.error("Failed to update ledger status in Supabase:", error);
          return NextResponse.json({ error: "Database update failed" }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ status: "success" });
  } catch (error) {
    console.error("Razorpay webhook verification error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
