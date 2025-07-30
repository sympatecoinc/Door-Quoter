const sqlite3 = require('sqlite3').verbose();

// Database connection
const db = new sqlite3.Database('./prisma/dev.db');

// Function to find the best stock length rule for extrusions
function findBestStockLengthRule(rules, componentWidth, componentHeight) {
  console.log(`\nTesting stock length rule selection for ${componentWidth}"W × ${componentHeight}"H`);
  console.log(`Available rules:`);
  rules.forEach(r => {
    console.log(`  Rule ${r.id}: "${r.name}"`);
    console.log(`    Height range: ${r.minHeight || 'no min'} - ${r.maxHeight || 'no max'}`);
    console.log(`    Width range: ${r.minWidth || 'no min'} - ${r.maxWidth || 'no max'}`);
    console.log(`    Base price: $${r.basePrice}`);
    console.log(`    Stock length: ${r.stockLength}"`);
    console.log(`    Active: ${r.isActive}`);
  });

  const applicableRules = rules.filter(rule => {
    const matchesWidth = (rule.minWidth === null || componentWidth >= rule.minWidth) && 
                        (rule.maxWidth === null || componentWidth <= rule.maxWidth);
    const matchesHeight = (rule.minHeight === null || componentHeight >= rule.minHeight) && 
                         (rule.maxHeight === null || componentHeight <= rule.maxHeight);
    
    const applicable = rule.isActive && matchesWidth && matchesHeight;
    
    console.log(`\n  Testing Rule ${rule.id} "${rule.name}":`);
    console.log(`    Width ${componentWidth} matches range ${rule.minWidth || 'no min'}-${rule.maxWidth || 'no max'}: ${matchesWidth}`);
    console.log(`    Height ${componentHeight} matches range ${rule.minHeight || 'no min'}-${rule.maxHeight || 'no max'}: ${matchesHeight}`);
    console.log(`    Active: ${rule.isActive}`);
    console.log(`    → Applicable: ${applicable}`);
    
    return applicable;
  });
  
  console.log(`\nApplicable rules: ${applicableRules.length}`);
  applicableRules.forEach(r => {
    console.log(`  - Rule ${r.id}: "${r.name}" ($${r.basePrice})`);
  });
  
  // Return the rule with the most restrictive constraints (most specific)
  const bestRule = applicableRules.sort((a, b) => {
    const aSpecificity = (a.minWidth !== null ? 1 : 0) + (a.maxWidth !== null ? 1 : 0) +
                        (a.minHeight !== null ? 1 : 0) + (a.maxHeight !== null ? 1 : 0);
    const bSpecificity = (b.minWidth !== null ? 1 : 0) + (b.maxWidth !== null ? 1 : 0) +
                        (b.minHeight !== null ? 1 : 0) + (b.maxHeight !== null ? 1 : 0);
    
    console.log(`  Rule ${a.id} specificity: ${aSpecificity}, Rule ${b.id} specificity: ${bSpecificity}`);
    return bSpecificity - aSpecificity;
  })[0] || null;

  if (bestRule) {
    console.log(`\n✓ Selected rule: "${bestRule.name}" with base price $${bestRule.basePrice}`);
  } else {
    console.log(`\n✗ No applicable rule found`);
  }
  
  return bestRule;
}

// Test the stock length rule selection
function testStockRules() {
  console.log('=== TESTING STOCK LENGTH RULE SELECTION ===\n');

  db.all(`
    SELECT * FROM StockLengthRules WHERE masterPartId = 17 AND isActive = 1
    ORDER BY id
  `, [], (err, rules) => {
    if (err) {
      console.error('Error getting rules:', err);
      db.close();
      return;
    }

    console.log(`Found ${rules.length} active stock length rules for master part 17 (AD-48347-MF):`);

    // Test with our panel dimensions: 36"W × 96"H
    const bestRule = findBestStockLengthRule(rules, 36, 96);
    
    if (bestRule) {
      console.log(`\n=== EXPECTED RESULT ===`);
      console.log(`Rule: ${bestRule.name}`);
      console.log(`Base Price: $${bestRule.basePrice}`);
      console.log(`Expected cost: $${bestRule.basePrice} (base price × quantity 1)`);
    }

    console.log(`\n=== COMPARISON ===`);
    console.log(`Current calculation: height-2 = 96-2 = $94`);
    console.log(`Expected calculation: Stock rule base price = $${bestRule?.basePrice || 'N/A'}`);
    console.log(`Discrepancy: $${94 - (bestRule?.basePrice || 0)}`);

    db.close();
  });
}

testStockRules();