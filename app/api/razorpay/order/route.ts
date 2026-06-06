import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { amount, ledgerId } = body;

    const keyId = process.env.RAZORPAY_KEY_ID || "rzp_test_mockKeyId12345";
    const keySecret = process.env.RAZORPAY_KEY_SECRET || "mockKeySecret67890";

    // Request Razorpay Order Creation API
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Basic " + btoa(keyId + ":" + keySecret),
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100), // Razorpay expects amount in paise/cents
        currency: "INR",
        receipt: `receipt_${ledgerId}`,
        notes: {
          ledgerId: ledgerId,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.warn("Razorpay API returned error, creating mock checkout order ID:", data);
      return NextResponse.json({
        id: `order_mock_${Math.random().toString(36).substring(2, 9)}`,
        amount: amount * 100,
        currency: "INR",
        receipt: `receipt_${ledgerId}`,
        isMock: true
      });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Razorpay order creation failed:", error);
    return NextResponse.json({ error: "Order creation failed" }, { status: 500 });
  }
}
