import { NextResponse } from 'next/server'

export async function GET() {
  const downloadUrl = 'https://github.com/jawadshamsy4-rgb/SquadLink/releases/download/v1.0.0/SquadLink.apk'
  return NextResponse.redirect(downloadUrl, {
    status: 302,
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}
