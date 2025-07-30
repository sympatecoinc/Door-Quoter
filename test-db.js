const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function testDatabase() {
  try {
    console.log('Testing database connection...')
    
    // Test basic connection
    await prisma.$connect()
    console.log('✓ Database connected successfully')
    
    // Test fetching products
    const products = await prisma.product.findMany({
      where: { archived: false },
      include: {
        productSubOptions: {
          include: {
            category: true
          }
        },
        productBOMs: true,
        _count: {
          select: {
            productBOMs: true,
            productSubOptions: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
    
    console.log('✓ Products fetched successfully:', products.length)
    products.forEach(product => {
      console.log(`  - ${product.name} (ID: ${product.id}, archived: ${product.archived})`)
    })
    
  } catch (error) {
    console.error('✗ Database error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testDatabase()