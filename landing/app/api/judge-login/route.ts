import { NextResponse } from 'next/server';

interface JudgeLoginPayload {
  code?: string;
}

export async function POST(request: Request) {
  let payload: JudgeLoginPayload | null = null;

  try {
    payload = (await request.json()) as JudgeLoginPayload;
  } catch (error) {
    console.warn('judge-login: failed to parse request body', error);
  }

  const submitted = payload?.code?.trim() ?? '';
  const expected = process.env.JUDGE_ACCESS_CODE ?? '';

  if (!submitted || !expected || submitted !== expected) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const downloadUrl = process.env.FORMAL_PACKAGE_URL ?? null;

  return NextResponse.json(
    {
      ok: true,
      downloadUrl
    },
    { status: 200 }
  );
}

