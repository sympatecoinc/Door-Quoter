const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();

  try {
    // Find panels with Fixed End Panel product
    const panels = await prisma.panel.findMany({
      where: {
        componentInstance: {
          product: {
            name: { contains: 'Fixed End Panel' }
          }
        }
      },
      include: {
        opening: {
          include: {
            project: true
          }
        },
        componentInstance: {
          include: {
            product: true
          }
        }
      },
      take: 5
    });

    console.log('Found', panels.length, 'panels with Fixed End Panel:');
    for (const panel of panels) {
      console.log('  - Panel ID:', panel.id);
      console.log('    Opening ID:', panel.openingId);
      console.log('    Project:', panel.opening?.project?.name);
      console.log('    Width:', panel.width);
      console.log('');
    }

  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
