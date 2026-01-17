import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createPackingListPDF, PackingListItem, ProductInstance, PackingListData } from '@/lib/packing-list-pdf-generator'

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

    // Get project info with customer
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        name: true,
        customer: {
          select: { companyName: true }
        }
      }
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

    // Build packing list items and product instances
    const itemsMap = new Map<string, PackingListItem>()
    const productInstances: ProductInstance[] = []

    for (const opening of openings) {
      // Get the finish code for this opening if it has a finish color
      const finishCode = opening.finishColor ? await getFinishCode(opening.finishColor) : ''

      for (const panel of opening.panels) {
        const productName = panel.componentInstance?.product?.name || 'Unknown Product'

        // Add product instance (for the checklist section - matches stickers)
        productInstances.push({
          openingName: opening.name,
          productName: productName,
          panelType: panel.type || undefined,
          width: panel.width || undefined,
          height: panel.height || undefined
        })

        // Process hardware from productBOMs for this panel
        if (panel.componentInstance?.product?.productBOMs) {
          for (const bom of panel.componentInstance.product.productBOMs) {
            if (!bom.addToPackingList) continue

            // Apply finish code if addFinishToPartNumber is set
            let partNumber = bom.partNumber
            if (bom.addFinishToPartNumber && finishCode && partNumber) {
              partNumber = `${partNumber}${finishCode}`
            }

            const quantity = bom.quantity || 1

            // Create a unique key for aggregation by product type + part
            const key = `${productName}|${partNumber || ''}|${bom.partName}`

            const existing = itemsMap.get(key)
            if (existing) {
              existing.quantity += quantity
            } else {
              itemsMap.set(key, {
                openingName: opening.name,
                productName: productName,
                partNumber: partNumber || null,
                partName: bom.partName,
                quantity: quantity,
                unit: bom.unit || 'EA'
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

                // Create a unique key for aggregation by product type + part
                const key = `${productName}|${partNumber}|${selectedOption.name}`

                const existing = itemsMap.get(key)
                if (existing) {
                  existing.quantity += 1
                } else {
                  itemsMap.set(key, {
                    openingName: opening.name,
                    productName: productName,
                    partNumber: partNumber,
                    partName: selectedOption.name,
                    quantity: 1,
                    unit: 'EA'
                  })
                }
              }
            }
          } catch (error) {
            console.error('Error parsing sub-option selections:', error)
          }
        }
      }
    }

    // Convert map to array
    const items = Array.from(itemsMap.values())

    // Build the data structure for the PDF
    const pdfData: PackingListData = {
      projectName: project.name,
      customerName: project.customer?.companyName,
      items: items,
      productInstances: productInstances,
      generatedDate: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    // Generate the PDF
    const pdfBuffer = await createPackingListPDF(pdfData)

    // Return PDF response
    const filename = `${project.name.replace(/[^a-zA-Z0-9]/g, '-')}-packing-list.pdf`

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString()
      }
    })
  } catch (error) {
    console.error('Error generating packing list PDF:', error)
    return NextResponse.json(
      { error: 'Failed to generate packing list PDF' },
      { status: 500 }
    )
  }
}
