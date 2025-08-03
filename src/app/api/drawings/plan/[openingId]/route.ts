import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { spawn } from 'child_process'
import path from 'path'

export async function GET(request: NextRequest, { params }: { params: Promise<{ openingId: string }> }) {
  try {
    const { openingId } = await params
    const id = parseInt(openingId)
    
    // Fetch opening data with all related panels and components
    const opening = await prisma.opening.findUnique({
      where: { id },
      include: {
        panels: {
          include: {
            componentInstance: {
              include: {
                product: {
                  include: {
                    productSubOptions: {
                      include: {
                        category: {
                          include: {
                            individualOptions: true
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!opening) {
      return NextResponse.json(
        { error: 'Opening not found' },
        { status: 404 }
      )
    }

    // Call Python drawing service
    const drawingResult = await generateDrawing('plan', opening)
    
    if (!drawingResult.success) {
      return NextResponse.json(
        { error: drawingResult.error },
        { status: 500 }
      )
    }

    return NextResponse.json(drawingResult)
    
  } catch (error) {
    console.error('Error generating plan drawing:', error)
    return NextResponse.json(
      { error: 'Failed to generate plan drawing' },
      { status: 500 }
    )
  }
}

async function generateDrawing(type: string, openingData: any): Promise<any> {
  try {
    // Use Vercel Python function for drawing generation
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3000' 
        : 'https://door-quoter-h3bnquaob-kylegoevert-sympatecoincs-projects.vercel.app'
    
    const response = await fetch(`${baseUrl}/api/drawings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: type,
        data: openingData
      })
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
    
  } catch (error) {
    console.error('Drawing generation error:', error)
    return {
      success: false,
      error: `Failed to generate drawing: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}