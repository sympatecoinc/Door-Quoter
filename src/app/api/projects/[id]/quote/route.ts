import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { spawn } from 'child_process'
import path from 'path'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const projectId = parseInt(id)
    
    // Fetch project data with all related openings and components
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

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // Generate quote data for each opening
    const quoteItems = await Promise.all(
      project.openings.map(async (opening) => {
        // Generate miniature elevation view
        const elevationResult = await generateMiniatureElevation(opening)
        
        // Calculate opening dimensions (sum of panel widths, max height)
        const totalWidth = opening.panels.reduce((sum, panel) => sum + panel.width, 0)
        const maxHeight = Math.max(...opening.panels.map(panel => panel.height), 0)
        
        // Get hardware and glass types
        const hardwareItems: Array<{name: string, price: number}> = []
        const glassTypes = new Set<string>()
        let totalHardwarePrice = 0
        
        opening.panels.forEach(panel => {
          if (panel.glassType && panel.glassType !== 'N/A') {
            glassTypes.add(panel.glassType)
          }
          
          // Extract hardware from component options
          if (panel.componentInstance?.subOptionSelections) {
            try {
              const selections = JSON.parse(panel.componentInstance.subOptionSelections)
              const product = panel.componentInstance.product
              
              // Resolve hardware options
              for (const [categoryId, optionId] of Object.entries(selections)) {
                if (optionId) {
                  for (const pso of product.productSubOptions || []) {
                    if (String(pso.category.id) === String(categoryId)) {
                      const categoryName = pso.category.name.toLowerCase()
                      if (categoryName.includes('hardware') || categoryName.includes('handle') || 
                          categoryName.includes('lock') || categoryName.includes('hinge')) {
                        for (const option of pso.category.individualOptions) {
                          if (option.id === optionId) {
                            hardwareItems.push({
                              name: `${pso.category.name}: ${option.name}`,
                              price: option.price || 0
                            })
                            totalHardwarePrice += option.price || 0
                            break
                          }
                        }
                      }
                      break
                    }
                  }
                }
              }
            } catch (error) {
              console.error('Error parsing hardware options:', error)
            }
          }
        })
        
        // Generate description
        const panelTypes = opening.panels
          .filter(p => p.componentInstance)
          .map(p => p.componentInstance!.product.productType)
        
        const typeCount = panelTypes.reduce((acc, type) => {
          acc[type] = (acc[type] || 0) + 1
          return acc
        }, {} as Record<string, number>)
        
        const description = Object.entries(typeCount)
          .map(([type, count]) => {
            const displayType = type === 'SWING_DOOR' ? 'Swing Door' :
                              type === 'SLIDING_DOOR' ? 'Sliding Door' :
                              type === 'FIXED_PANEL' ? 'Fixed Panel' :
                              type === 'CORNER_90' ? '90° Corner' : type
            return count > 1 ? `${count} ${displayType}s` : `${count} ${displayType}`
          })
          .join(', ')

        return {
          openingId: opening.id,
          name: opening.name,
          description: description || 'Custom Opening',
          dimensions: `${totalWidth}" W × ${maxHeight}" H`,
          color: opening.finishColor || 'Standard',
          hardware: hardwareItems.length > 0 ? hardwareItems.map(item => `${item.name} | +$${item.price.toLocaleString()}`).join(' • ') : 'Standard',
          hardwarePrice: totalHardwarePrice,
          glassType: Array.from(glassTypes).join(', ') || 'Clear',
          price: opening.price,
          elevationImage: elevationResult.success ? elevationResult.elevation_image : null
        }
      })
    )

    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        name: project.name,
        status: project.status,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt
      },
      quoteItems,
      totalPrice: quoteItems.reduce((sum, item) => sum + item.price, 0)
    })
    
  } catch (error) {
    console.error('Error generating quote:', error)
    return NextResponse.json(
      { error: 'Failed to generate quote' },
      { status: 500 }
    )
  }
}

async function generateMiniatureElevation(openingData: any): Promise<any> {
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
    
    // Send input data to Python script for miniature elevation
    const inputData = {
      type: 'elevation',
      data: openingData,
      miniature: true // Flag for smaller dimensions
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
    }, 15000) // 15 second timeout for miniatures
  })
}