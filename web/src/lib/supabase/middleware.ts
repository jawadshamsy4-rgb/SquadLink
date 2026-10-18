import { NextResponse, type NextRequest } from 'next/server'

// Temporarily bypassed auth protection for preview mode
export async function updateSession(request: NextRequest) {
  return NextResponse.next({ request })
}
