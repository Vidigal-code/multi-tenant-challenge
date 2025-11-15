import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    await request.text();
  } catch {}
  return NextResponse.json({ ok: true });
}
