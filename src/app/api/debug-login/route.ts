import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    // Server-side runtime evidence retrievable via Vercel logs.
    console.log('DEBUG_LOGIN_EVENT', JSON.stringify(body))
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DEBUG_LOGIN_EVENT_ERROR', error)
    return NextResponse.json({ ok: false }, { status: 400 })
  }
}

