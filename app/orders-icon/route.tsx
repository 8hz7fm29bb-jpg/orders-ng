import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#ffd400',
          color: '#21262c',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: 220,
            lineHeight: 0.8,
            fontWeight: 900,
            letterSpacing: -12,
            marginTop: -16,
          }}
        >
          22
        </div>
        <div
          style={{
            width: 320,
            height: 14,
            background: '#21262c',
            display: 'flex',
            marginTop: 34,
          }}
        />
        <div
          style={{
            display: 'flex',
            fontSize: 48,
            lineHeight: 1,
            fontWeight: 800,
            letterSpacing: 16,
            marginTop: 24,
            marginLeft: 16,
          }}
        >
          ORDERS
        </div>
      </div>
    ),
    {
      width: 512,
      height: 512,
    }
  )
}
