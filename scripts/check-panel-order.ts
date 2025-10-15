import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Get the opening with 4 panels
  const openings = await prisma.opening.findMany({
    include: {
      panels: {
        orderBy: {
          displayOrder: 'asc'
        },
        include: {
          componentInstance: {
            include: {
              product: true
            }
          }
        }
      }
    }
  })

  openings.forEach(opening => {
    if (opening.panels.length === 4) {
      console.log(`\nOpening ${opening.openingNumber}:`)
      console.log('Panel order:')
      opening.panels.forEach((panel, index) => {
        const product = panel.componentInstance?.product
        console.log(`  ${index + 1}. [displayOrder: ${panel.displayOrder}] ${product?.name || 'No product'} - Type: ${product?.productType || 'N/A'}`)
        if (panel.isCorner) {
          console.log(`     ⟲ CORNER - Direction: ${panel.cornerDirection}`)
        }
      })
    }
  })
}

main()
  .finally(async () => {
    await prisma.$disconnect()
  })
