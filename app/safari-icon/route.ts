import { readFile } from 'node:fs/promises'
import path from 'node:path'

export const runtime = 'nodejs'
export const dynamic = 'force-static'

export async function GET() {
  const logo = await readFile(path.join(process.cwd(), 'public/icons/orders-20261002b-512.png'))
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><defs><clipPath id="rounded"><rect width="512" height="512" rx="100"/></clipPath></defs><image width="512" height="512" clip-path="url(#rounded)" href="data:image/png;base64,${logo.toString('base64')}"/></svg>`
  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=31536000, immutable' } })
}
