import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#FFF8EE',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
        }}
      >
        {/* Decorative gold circles */}
        <div style={{
          position: 'absolute', top: -90, left: -90,
          width: 320, height: 320, borderRadius: '50%',
          background: 'rgba(245,200,66,0.14)', display: 'flex',
        }} />
        <div style={{
          position: 'absolute', bottom: -70, right: -70,
          width: 280, height: 280, borderRadius: '50%',
          background: 'rgba(245,200,66,0.10)', display: 'flex',
        }} />
        <div style={{
          position: 'absolute', top: 30, right: 60,
          width: 80, height: 80, borderRadius: '50%',
          background: 'rgba(245,200,66,0.18)', display: 'flex',
        }} />

        {/* Main card */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          background: 'rgba(255,255,255,0.72)',
          border: '2px solid rgba(245,200,66,0.45)',
          borderRadius: 40,
          padding: '60px 90px',
          boxShadow: '0 12px 60px rgba(245,200,66,0.18)',
        }}>
          <div style={{ fontSize: 96, marginBottom: 24, display: 'flex' }}>
            🌻
          </div>
          <div style={{
            fontSize: 76,
            fontWeight: 800,
            color: '#3B1A08',
            letterSpacing: '-2px',
            marginBottom: 14,
            display: 'flex',
          }}>
            una proposta
          </div>
          <div style={{
            fontSize: 38,
            fontWeight: 700,
            color: '#F5C842',
            letterSpacing: '2px',
            display: 'flex',
          }}>
            señorita
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      emoji: 'twemoji',
    }
  )
}
