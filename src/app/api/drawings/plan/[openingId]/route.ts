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
    // In development, try Python function first, fallback to original Python script
    if (process.env.NODE_ENV === 'development') {
      try {
        const currentPort = process.env.PORT || '3000'
        const response = await fetch(`http://localhost:${currentPort}/api/drawings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: type,
            data: openingData
          })
        })
        
        if (response.ok) {
          return await response.json()
        }
      } catch (fetchError) {
        console.log('Python function not available, using fallback script')
      }
      
      // Fallback to original Python script for development
      return new Promise((resolve, reject) => {
        const pythonScript = path.join(process.cwd(), 'shop-drawings', 'drawing_generator.py')
        const python = spawn('python3', [pythonScript])
        
        let stdout = ''
        let stderr = ''
        
        python.stdout.on('data', (data) => {
          stdout += data.toString()
        })
        
        python.stderr.on('data', (data) => {
          stderr += data.toString()
        })
        
        python.on('close', (code) => {
          if (code !== 0) {
            console.error('Python script error:', stderr)
            resolve({
              success: false,
              error: `Python script failed with code ${code}: ${stderr}`
            })
            return
          }
          
          try {
            const result = JSON.parse(stdout)
            resolve(result)
          } catch (parseError) {
            console.error('Failed to parse Python output:', parseError)
            resolve({
              success: false,
              error: 'Failed to parse drawing service response'
            })
          }
        })
        
        // Send input data to Python script
        const inputData = {
          type: type,
          data: openingData
        }
        
        python.stdin.write(JSON.stringify(inputData))
        python.stdin.end()
        
        // Set timeout
        setTimeout(() => {
          python.kill()
          resolve({
            success: false,
            error: 'Drawing generation timed out'
          })
        }, 30000) // 30 second timeout
      })
    }
    
    // For production, use Vercel Python function
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'https://door-quoter-5n2fhwwd1-kylegoevert-sympatecoincs-projects.vercel.app'
    
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