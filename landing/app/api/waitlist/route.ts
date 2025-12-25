import { NextResponse } from 'next/server';

interface WaitlistPayload {
  email: string;
  source?: 'landing' | 'judge' | 'other' | string;
}

const EMAIL_MAX_LENGTH = 254;

function isValidEmail(email: string): boolean {
  const trimmed = email.trim();
  if (!trimmed) return false;
  if (trimmed.length > EMAIL_MAX_LENGTH) return false;

  // Simple format check is enough here; external system can enforce stricter rules.
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(trimmed);
}

export async function POST(request: Request) {
  let payload: WaitlistPayload | null = null;

  try {
    payload = (await request.json()) as WaitlistPayload;
  } catch (error) {
    console.warn('waitlist: failed to parse request body', error);
  }

  const email = typeof payload?.email === 'string' ? payload.email.trim() : '';
  const source =
    typeof payload?.source === 'string' && payload.source
      ? payload.source
      : 'landing';

  if (!isValidEmail(email)) {
    return NextResponse.json(
      { ok: false, error: 'invalid_email' },
      { status: 400 }
    );
  }

  const webhookUrl = process.env.WAITLIST_WEBHOOK_URL;

  if (webhookUrl) {
    const body = {
      email,
      source,
      ts: new Date().toISOString()
    };

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        console.warn(
          'waitlist: webhook responded with non-2xx status',
          response.status
        );
      }
    } catch (error) {
      console.error('waitlist: webhook call failed', error);
    }
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

