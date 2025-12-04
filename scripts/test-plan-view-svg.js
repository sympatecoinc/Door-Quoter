// Direct test of plan view SVG processing
const fs = require('fs');
const path = require('path');

// Import the processing functions - we need to use the compiled JS
const { processParametricSVG } = require('../src/lib/parametric-svg-server');

async function main() {
  // Read the SVG file
  const svgPath = path.join(__dirname, '..', 'slider-plan-view.svg');
  const svgContent = fs.readFileSync(svgPath, 'utf-8');

  console.log('=== Testing Plan View SVG Processing ===\n');
  console.log('Original SVG viewBox:', svgContent.match(/viewBox="([^"]+)"/)?.[1]);
  console.log('Original SVG groups:');
  const groupMatches = svgContent.match(/<g[^>]*id="[^"]*"[^>]*>/g);
  if (groupMatches) {
    groupMatches.forEach(g => {
      const idMatch = g.match(/id="([^"]*)"/);
      console.log('  -', idMatch ? idMatch[1] : 'unknown');
    });
  }

  // Test with different widths
  const testWidths = [24, 36, 48, 60, 72];

  for (const width of testWidths) {
    console.log(`\n--- Testing width: ${width}" ---`);

    try {
      const result = processParametricSVG(svgContent, {
        width: width,
        height: 6 // Constant depth
      }, 'plan');

      console.log('Scale factor (scaleX):', result.scaling.scaleX.toFixed(4));

      // Extract transforms from the processed SVG
      const transformMatches = result.scaledSVG.match(/transform="([^"]+)"/g);
      if (transformMatches) {
        console.log('Applied transforms:');
        transformMatches.forEach(t => console.log('  ', t));
      }

      // Check the new viewBox
      const newViewBox = result.scaledSVG.match(/viewBox="([^"]+)"/)?.[1];
      console.log('New viewBox:', newViewBox);

      // Save the output for the 60" width (our test case)
      if (width === 60) {
        const outputPath = path.join(__dirname, '..', 'test-output-60in.svg');
        fs.writeFileSync(outputPath, result.scaledSVG);
        console.log('\nSaved 60" output to:', outputPath);
      }

    } catch (error) {
      console.error('Error:', error.message);
    }
  }
}

main().catch(console.error);
