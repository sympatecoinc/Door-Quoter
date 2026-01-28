import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createPackingListPDF, PackingListData, PackingListLineItem, JambKitEntry } from '@/lib/packing-list-pdf-generator'

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

// Helper function to get company logo from branding settings
async function getCompanyLogo(): Promise<string | null> {
  try {
    const logoSetting = await prisma.globalSetting.findUnique({
      where: { key: 'company_logo' }
    })
    return logoSetting?.value || null
  } catch (error) {
    console.error('Error fetching company logo:', error)
    return null
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
    let project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        name: true,
        packingAccessToken: true,
        customer: {
          select: { companyName: true }
        }
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Generate packing access token if not exists
    let packingAccessToken = project.packingAccessToken
    if (!packingAccessToken) {
      packingAccessToken = crypto.randomUUID()
      await prisma.project.update({
        where: { id: projectId },
        data: { packingAccessToken }
      })
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

    // Build packing list items in STICKER ORDER
    // Order: For each opening -> components -> hardware -> jamb kit
    // This matches the exact order stickers are generated
    const lineItems: Omit<PackingListLineItem, 'stickerNumber' | 'totalStickers'>[] = []
    const jambKitsList: JambKitEntry[] = []

    for (const opening of openings) {
      // Get the finish code for this opening if it has a finish color
      const finishCode = opening.finishColor ? await getFinishCode(opening.finishColor) : ''

      // Track jamb kit item count for this opening
      let jambKitItemCount = 0

      // 1. Add component items (one per panel) - matches sticker order
      for (const panel of opening.panels) {
        const productName = panel.componentInstance?.product?.name || panel.type || 'Unknown'

        lineItems.push({
          openingName: opening.name,
          itemType: 'component',
          itemName: productName,
          dimensions: `${panel.width}" x ${panel.height}"`,
          partNumber: null,
          quantity: 1,
          unit: null
        })

        // Check ALL BOM items for jamb kit inclusion
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

        // 2. Process hardware from productBOMs for this panel
        if (panel.componentInstance?.product?.productBOMs) {
          for (const bom of panel.componentInstance.product.productBOMs) {
            if (!bom.addToPackingList) continue

            // Apply finish code if addFinishToPartNumber is set
            let partNumber = bom.partNumber
            if (bom.addFinishToPartNumber && finishCode && partNumber) {
              partNumber = `${partNumber}${finishCode}`
            }

            // Create individual line items for each piece (matches sticker generation)
            const quantity = bom.quantity || 1
            for (let i = 0; i < quantity; i++) {
              lineItems.push({
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

        // 3. Process hardware from IndividualOptions
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

                lineItems.push({
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

      // 4. Add jamb kit for this opening (at end of opening's items)
      if (jambKitItemCount > 0) {
        lineItems.push({
          openingName: opening.name,
          itemType: 'jambkit',
          itemName: 'Jamb Kit',
          itemCount: jambKitItemCount,
          partNumber: null,
          quantity: 1,
          unit: null
        })

        jambKitsList.push({
          openingName: opening.name,
          itemCount: jambKitItemCount
        })
      }
    }

    // Add sticker numbers (1-based index matching sticker generation)
    const totalStickers = lineItems.length
    const numberedItems: PackingListLineItem[] = lineItems.map((item, index) => ({
      ...item,
      stickerNumber: index + 1,
      totalStickers
    }))

    // Get company logo for branding
    const companyLogo = await getCompanyLogo()

    // Build packing URL for QR code using request headers
    const headers = request.headers
    const host = headers.get('host') || 'localhost:3000'
    const protocol = headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https')
    const baseUrl = `${protocol}://${host}`
    const packingUrl = `${baseUrl}/packing/${packingAccessToken}`

    // Build the data structure for the PDF
    const pdfData: PackingListData = {
      projectName: project.name,
      customerName: project.customer?.companyName,
      companyLogo,
      lineItems: numberedItems,
      jambKits: jambKitsList,
      generatedDate: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      packingUrl
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
