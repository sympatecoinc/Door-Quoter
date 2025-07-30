import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  console.log('Complete package API called')
  try {
    const { id } = await params
    const projectId = parseInt(id)
    console.log('Processing project ID:', projectId)
    
    // Fetch project data with all related data
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        openings: {
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
                        },
                        productBOMs: true
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

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    console.log('Generating package for project:', project.name)
    console.log('Project has openings:', project.openings.length)
    
    // Generate complete package with Python script
    const packageResult = await generateCompletePackage(project)
    
    console.log('Package generation result:', packageResult)
    
    if (!packageResult.success) {
      console.error('Package generation failed:', packageResult.error)
      return NextResponse.json(
        { error: packageResult.error || 'Failed to generate project package' },
        { status: 500 }
      )
    }

    // Return the PDF as a blob
    const pdfBuffer = Buffer.from(packageResult.pdf_data, 'base64')
    
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${project.name}_Complete_Package.pdf"`,
      },
    })
    
  } catch (error) {
    console.error('Error generating complete project package:', error)
    return NextResponse.json(
      { error: 'Failed to generate project package' },
      { status: 500 }
    )
  }
}

async function generateCompletePackage(projectData: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(process.cwd(), 'shop-drawings', 'package_generator.py')
    console.log('Python script path:', pythonScript)
    
    // Check if Python script exists
    if (!fs.existsSync(pythonScript)) {
      resolve({
        success: false,
        error: `Python script not found at: ${pythonScript}`
      })
      return
    }
    
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
      console.log('Python script closed with code:', code)
      console.log('Python stdout:', stdout)
      console.log('Python stderr:', stderr)
      
      if (code !== 0) {
        console.error('Python script error:', stderr)
        resolve({
          success: false,
          error: `Python script failed with code ${code}: ${stderr}`
        })
        return
      }
      
      if (!stdout.trim()) {
        resolve({
          success: false,
          error: 'No output from Python script'
        })
        return
      }
      
      try {
        const result = JSON.parse(stdout)
        resolve(result)
      } catch (parseError) {
        console.error('Failed to parse Python output:', parseError)
        console.error('Raw output:', stdout)
        resolve({
          success: false,
          error: `Failed to parse package generation response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
        })
      }
    })
    
    // Send input data to Python script
    const inputData = {
      type: 'complete_package',
      project: projectData
    }
    
    python.stdin.write(JSON.stringify(inputData))
    python.stdin.end()
    
    // Set timeout
    setTimeout(() => {
      python.kill()
      resolve({
        success: false,
        error: 'Package generation timed out'
      })
    }, 60000) // 60 second timeout for complete package
  })
}