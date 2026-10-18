import { NextRequest, NextResponse } from 'next/server'

// LiveKit token generation endpoint
// Since we have a pre-generated JWT token, we'll use it directly
// In production, you'd use the LiveKit server SDK to generate tokens
export async function POST(request: NextRequest) {
  try {
    const { roomName, identity } = await request.json()

    if (!roomName || !identity) {
      return NextResponse.json(
        { error: 'roomName and identity are required' },
        { status: 400 }
      )
    }

    // For the free tier / demo, we use the pre-generated token
    // The token was generated with the LiveKit API key: APIudkZHvzrLPak
    const token = process.env.LIVEKIT_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJBUEl1ZGtaSHZ6ckxQYWsiLCJzdWIiOiJBbnRpZ3Jhdml0eSIsImV4cCI6MTgwMjM0Mjg1OCwibmJmIjoxNzkyMzQyODU4LCJpYXQiOjE3OTIzNDI4NTgsImlkZW50aXR5IjoiQW50aWdyYXZpdHkiLCJ2aWRlbyI6eyJyb29tSm9pbiI6dHJ1ZSwicm9vbSI6IkdlbmVyYWwiLCJjYW5QdWJsaXNoIjp0cnVlLCJjYW5TdWJzY3JpYmUiOnRydWUsImNhblB1Ymxpc2hEYXRhIjp0cnVlfX0.sA8eEMkWUKGghK5XLkOQniYeWF1hjUQSQRp8c1qlMFg'

    return NextResponse.json({ token })
  } catch (error) {
    console.error('LiveKit token error:', error)
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    )
  }
}
