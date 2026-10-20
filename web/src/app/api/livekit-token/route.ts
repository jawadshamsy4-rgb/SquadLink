import { NextResponse } from 'next/server'

// LiveKit endpoint deprecated - SquadLink uses native WebRTC mesh
export async function POST() {
  return NextResponse.json(
    { error: 'LiveKit token endpoint deprecated. SquadLink uses native WebRTC mesh.' },
    { status: 410 }
  )
}
