import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { answerCurriculumQuestion } from "@/lib/assistant";

export async function POST(req: NextRequest) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return new NextResponse("Twilio is not configured", { status: 500 });

  const rawBody = await req.text();
  const params = Object.fromEntries(new URLSearchParams(rawBody));

  // Twilio signs the request against the public URL it called (e.g. the ngrok
  // URL) — reconstruct that from forwarded headers rather than req.nextUrl,
  // which reflects the internal localhost address the Node process sees.
  const signature = req.headers.get("x-twilio-signature") ?? "";
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  const url = `${proto}://${host}${req.nextUrl.pathname}`;
  const valid = twilio.validateRequest(authToken, signature, url, params);
  if (!valid) return new NextResponse("Invalid signature", { status: 403 });

  const question = params.Body ?? "";
  const answer = await answerCurriculumQuestion({ question });

  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message(answer);

  return new NextResponse(twiml.toString(), {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
