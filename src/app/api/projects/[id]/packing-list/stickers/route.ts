import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createStickersPDF, StickerData } from '@/lib/sticker-pdf-generator'

// Helper function to get finish code from database
async function getFinishCode(finishType: string): Promise<string> {
  try {
    const finish = await prisma.extrusionFinishPricing.findUnique({
      where: { finishType }
    })
    return finish?.finishCode ? `-${finish.finishCode}` : ''
  } catch (error) {
    console.error('Error fetching finish code:', error)
    return ''
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const projectId = parseInt(id)

    // Get project info for filename
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get all openings for this project with their panels and component instances
    const openings = await prisma.opening.findMany({
      where: { projectId },
      include: {
        panels: {
          include: {
            componentInstance: {
              include: {
                product: {
                  include: {
                    productBOMs: {
                      where: {
                        partType: 'Hardware',
                        addToPackingList: true
                      }
                    },
                    productSubOptions: {
                      include: {
                        category: {
                          include: {
                            individualOptions: {
                              where: {
                                addToPackingList: true
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
          },
          orderBy: { displayOrder: 'asc' }
        }
      },
      orderBy: { name: 'asc' }
    })

    // Build flat sticker array
    const stickers: StickerData[] = []

    for (const opening of openings) {
      // Get the finish code for this opening if it has a finish color
      const finishCode = opening.finishColor ? await getFinishCode(opening.finishColor) : ''

      // Track jamb kit item count for this opening
      let jambKitItemCount = 0

      // Add component stickers (one per panel)
      for (const panel of opening.panels) {
        const productName = panel.componentInstance?.product?.name || panel.type || 'Unknown'

        stickers.push({
          openingName: opening.name,
          itemType: 'component',
          itemName: productName,
          dimensions: `${panel.width}" x ${panel.height}"`,
          partNumber: null
        })

        // Check ALL BOM items (not just hardware) for jamb kit inclusion
        if (panel.componentInstance?.product) {
          const allBoms = await prisma.productBOM.findMany({
            where: { productId: panel.componentInstance.product.id },
            select: { partNumber: true, quantity: true }
          })

          for (const bom of allBoms) {
            if (bom.partNumber) {
              const masterPart = await prisma.masterPart.findUnique({
                where: { partNumber: bom.partNumber },
                select: { includeInJambKit: true }
              })
              if (masterPart?.includeInJambKit) {
                jambKitItemCount += (bom.quantity || 1)
              }
            }
          }
        }

        // Process hardware from productBOMs for this panel (only Hardware type with addToPackingList)
        if (panel.componentInstance?.product?.productBOMs) {
          for (const bom of panel.componentInstance.product.productBOMs) {
            if (!bom.addToPackingList) continue

            // Apply finish code if addFinishToPartNumber is set
            let partNumber = bom.partNumber
            if (bom.addFinishToPartNumber && finishCode && partNumber) {
              partNumber = `${partNumber}${finishCode}`
            }

            // Create individual stickers for each piece of hardware
            const quantity = bom.quantity || 1
            for (let i = 0; i < quantity; i++) {
              stickers.push({
                openingName: opening.name,
                itemType: 'hardware',
                itemName: bom.partName,
                partNumber: partNumber,
                quantity: 1,
                unit: bom.unit
              })
            }
          }
        }

        // Process hardware from IndividualOptions that have addToPackingList
        const componentInstance = panel.componentInstance
        if (componentInstance?.subOptionSelections && componentInstance.product?.productSubOptions) {
          try {
            const selections = JSON.parse(componentInstance.subOptionSelections)

            for (const [categoryIdStr, optionId] of Object.entries(selections)) {
              if (!optionId) continue

              const categoryId = parseInt(categoryIdStr)
              const productSubOption = componentInstance.product.productSubOptions.find(
                (pso: any) => pso.category.id === categoryId
              )

              if (!productSubOption) continue

              // Find the selected option (only if it has addToPackingList)
              const selectedOption = productSubOption.category.individualOptions?.find(
                (opt: any) => opt.id === Number(optionId) && opt.addToPackingList
              )

              if (selectedOption && selectedOption.partNumber) {
                // Apply finish code if addFinishToPartNumber is set
                let partNumber = selectedOption.partNumber
                if (selectedOption.addFinishToPartNumber && finishCode && partNumber) {
                  partNumber = `${partNumber}${finishCode}`
                }

                // Add one sticker for this option
                stickers.push({
                  openingName: opening.name,
                  itemType: 'hardware',
                  itemName: selectedOption.name,
                  partNumber: partNumber,
                  quantity: 1,
                  unit: 'EA'
                })
              }
            }
          } catch (error) {
            console.error('Error parsing sub-option selections:', error)
          }
        }
      }

      // Add jamb kit sticker for this opening if it has any jamb kit items
      if (jambKitItemCount > 0) {
        stickers.push({
          openingName: opening.name,
          itemType: 'jambkit',
          itemName: 'Jamb Kit',
          itemCount: jambKitItemCount,
          partNumber: null
        })
      }
    }

    // Generate the PDF
    const pdfBuffer = await createStickersPDF(project.name, stickers)

    // Return PDF response
    const filename = `${project.name.replace(/[^a-zA-Z0-9]/g, '-')}-packing-stickers.pdf`

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString()
      }
    })
  } catch (error) {
    console.error('Error generating stickers PDF:', error)
    return NextResponse.json(
      { error: 'Failed to generate stickers PDF' },
      { status: 500 }
    )
  }
}
