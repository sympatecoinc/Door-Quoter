import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    console.log('Test package API called')
    
    // Return a simple test response
    return NextResponse.json({
      success: true,
      message: 'Test endpoint working'
    })
    
  } catch (error) {
    console.error('Test error:', error)
    return NextResponse.json(
      { error: 'Test failed' },
      { status: 500 }
    )
  }
}