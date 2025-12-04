const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();

  try {
    // Find products with "fixed" in name (case insensitive)
    const products = await prisma.product.findMany({
      where: {
        productType: 'FIXED_PANEL'
      },
      include: {
        planViews: true
      }
    });

    console.log('Found ' + products.length + ' fixed panel products:\n');

    for (const product of products) {
      console.log('\n=== ' + product.name + ' (ID: ' + product.id + ') ===');
      console.log('Plan views: ' + product.planViews.length);

      for (const pv of product.planViews) {
        console.log('\n  Plan View: "' + pv.name + '" (fileName: ' + pv.fileName + ')');

        if (pv.imageData) {
          // Decode if base64 SVG
          let svgContent = pv.imageData;

          // Handle data URI format
          if (svgContent.startsWith('data:image/svg+xml;base64,')) {
            const base64Part = svgContent.replace('data:image/svg+xml;base64,', '');
            svgContent = Buffer.from(base64Part, 'base64').toString('utf-8');
          } else {
            // Try to decode plain base64
            try {
              const decoded = Buffer.from(svgContent, 'base64').toString('utf-8');
              if (decoded.includes('<svg')) {
                svgContent = decoded;
              }
            } catch (e) {}
          }

          if (svgContent.includes('<svg')) {
            // Extract just the group structure
            console.log('\n  SVG Structure (groups with IDs):');

            // Find all g elements with ids
            const groupMatches = svgContent.match(/<g[^>]*id="[^"]*"[^>]*>/g);
            if (groupMatches) {
              groupMatches.forEach(function(g) {
                const idMatch = g.match(/id="([^"]*)"/);
                console.log('    - ' + (idMatch ? idMatch[1] : 'unknown'));
              });
            } else {
              console.log('    No groups with IDs found');
            }

            // Show the raw first 3000 chars of SVG
            console.log('\n  Raw SVG (first 3000 chars):');
            console.log(svgContent.substring(0, 3000));
            console.log('\n  ...[truncated]...');
          } else {
            console.log('  Not an SVG (first 50 chars): ' + svgContent.substring(0, 50) + '...');
          }
        }
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
