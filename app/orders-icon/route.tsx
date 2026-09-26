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
          background: '#171715',
        }}
      >
        <div
          style={{
            width: 318,
            height: 318,
            borderRadius: 68,
            background: '#f8d648',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#21262c',
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: 170,
              lineHeight: 0.82,
              fontWeight: 900,
              letterSpacing: -10,
              marginTop: -2,
            }}
          >
            22
          </div>
          <div
            style={{
              width: 220,
              height: 13,
              background: '#21262c',
              display: 'flex',
              marginTop: 24,
            }}
          />
          <div
            style={{
              display: 'flex',
              fontSize: 39,
              lineHeight: 1,
              fontWeight: 800,
              letterSpacing: 12,
              marginTop: 18,
              marginLeft: 12,
            }}
          >
            ORDERS
          </div>
        </div>
      </div>
    ),
    {
      width: 512,
      height: 512,
    }
  )
}
