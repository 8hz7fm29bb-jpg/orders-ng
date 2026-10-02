import { NextResponse } from 'next/server'

export function GET(request: Request) {
  return NextResponse.redirect(new URL('/icons/orders-20261002b-512.png', request.url), 307)
}
