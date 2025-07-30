import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST() {
  try {
    return NextResponse.json({ 
      message: 'Stock length rules seeding is disabled - requires master parts to be created first',
      error: 'This endpoint has been temporarily disabled due to schema requirements'
    }, { status: 501 })
  } catch (error) {
    console.error('Error seeding stock length rules:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}