import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Get all openings with panels
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

  console.log('\n=== OPENINGS WITH PANELS ===\n')

  openings.forEach(opening => {
    if (opening.panels.length > 0) {
      console.log(`Opening ${opening.openingNumber}:`)
      opening.panels.forEach((panel, index) => {
        const product = panel.componentInstance?.product
        console.log(`  ${index + 1}. ${product?.name || 'No product'} - Type: ${product?.productType || 'N/A'} - isCorner: ${panel.isCorner}, cornerDirection: ${panel.cornerDirection || 'N/A'}`)
        console.log(`     Has elevation image: ${!!product?.elevationImageData}`)
      })
      console.log('')
    }
  })
}

main()
  .finally(async () => {
    await prisma.$disconnect()
  })
