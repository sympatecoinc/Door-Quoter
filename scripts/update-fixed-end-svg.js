const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

async function main() {
  const prisma = new PrismaClient();

  try {
    // Read the updated SVG file
    const svgPath = path.join(__dirname, '..', 'slider-plan-view.svg');
    const svgContent = fs.readFileSync(svgPath, 'utf-8');

    console.log('Read SVG file, length:', svgContent.length);
    console.log('SVG preview:', svgContent.substring(0, 200));

    // Encode as base64 data URI
    const base64 = Buffer.from(svgContent).toString('base64');
    const dataUri = 'data:image/svg+xml;base64,' + base64;

    console.log('Encoded as data URI, length:', dataUri.length);

    // Find the Fixed End Panel product
    const product = await prisma.product.findFirst({
      where: {
        name: { contains: 'Fixed End Panel' }
      },
      include: {
        planViews: true
      }
    });

    if (!product) {
      console.log('Fixed End Panel product not found!');
      return;
    }

    console.log('Found product:', product.name, '(ID:', product.id, ')');
    console.log('Plan views:', product.planViews.length);

    // Update the plan view with new SVG
    if (product.planViews.length > 0) {
      const planView = product.planViews[0];
      console.log('Updating plan view:', planView.name, '(ID:', planView.id, ')');

      await prisma.productPlanView.update({
        where: { id: planView.id },
        data: {
          imageData: dataUri,
          fileName: 'slider-plan-view.svg'
        }
      });

      console.log('Plan view updated successfully!');
    } else {
      console.log('No plan views found for this product');
    }

  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
