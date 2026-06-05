import { NextResponse } from 'next/server'

// Server-side only — the bot token never reaches the browser.
// Configure TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env.local (local)
// and in the Vercel project env vars (production).

interface NotifyBody {
  type?: 'confirm' | 'reached_confirm'
  dates?: string[]
  vibes?: string[]
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function POST(req: Request) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!token || !chatId) {
    console.error('[notify] missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID')
    return NextResponse.json({ ok: false, error: 'not_configured' }, { status: 500 })
  }

  let body: NotifyBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 })
  }

  const dates = (Array.isArray(body.dates) ? body.dates : []).map(escapeHtml)
  const vibes = (Array.isArray(body.vibes) ? body.vibes : []).map(escapeHtml)

  let text: string
  if (body.type === 'reached_confirm') {
    const vibesLine = vibes.length ? vibes.join(', ') : '—'
    text =
      `👀 <b>Ana sta per confermare!</b>\n\n` +
      `Ha scelto le vibes e sta guardando il riepilogo.\n\n` +
      `<b>Le vibes scelte:</b>\n🍽️ ${vibesLine}`
  } else {
    const datesLine = dates.length ? dates.map(d => `📅 ${d}`).join('\n') : '📅 —'
    const vibesLine = vibes.length ? vibes.join(', ') : '—'
    text =
      `🌻 <b>Ana ha risposto!</b>\n\n` +
      `<b>Quando:</b>\n${datesLine}\n\n` +
      `<b>Le vibes:</b>\n🍽️ ${vibesLine}`
  }

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    })

    if (!tgRes.ok) {
      const detail = await tgRes.text()
      console.error('[notify] telegram error', tgRes.status, detail)
      return NextResponse.json({ ok: false, error: 'telegram_failed' }, { status: 502 })
    }
  } catch (err) {
    console.error('[notify] fetch failed', err)
    return NextResponse.json({ ok: false, error: 'network' }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
