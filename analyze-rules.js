const sqlite3 = require('sqlite3').verbose();

// Database connection
const db = new sqlite3.Database('./prisma/dev.db');

function analyzeRuleLogic() {
  console.log('=== ANALYZING STOCK LENGTH RULE LOGIC ===\n');

  db.all(`
    SELECT * FROM StockLengthRules WHERE masterPartId = 17 AND isActive = 1
    ORDER BY id
  `, [], (err, rules) => {
    if (err) {
      console.error('Error getting rules:', err);
      db.close();
      return;
    }

    console.log('Rule Analysis for height = 96":\n');

    rules.forEach(rule => {
      console.log(`Rule ${rule.id}: "${rule.name}"`);
      console.log(`  Height range: ${rule.minHeight} - ${rule.maxHeight}`);
      console.log(`  Base price: $${rule.basePrice}`);
      
      // Check if 96 falls within the range
      const matchesHeight = (rule.minHeight === null || 96 >= rule.minHeight) && 
                           (rule.maxHeight === null || 96 <= rule.maxHeight);
      
      console.log(`  Does 96 match? ${matchesHeight}`);
      console.log(`    96 >= ${rule.minHeight}: ${rule.minHeight === null || 96 >= rule.minHeight}`);
      console.log(`    96 <= ${rule.maxHeight}: ${rule.maxHeight === null || 96 <= rule.maxHeight}`);
      
      // Calculate specificity
      const specificity = (rule.minWidth !== null ? 1 : 0) + (rule.maxWidth !== null ? 1 : 0) +
                         (rule.minHeight !== null ? 1 : 0) + (rule.maxHeight !== null ? 1 : 0);
      console.log(`  Specificity: ${specificity}`);
      console.log('');
    });

    console.log('=== PROBLEM IDENTIFICATION ===');
    console.log('The issue is that height 96 matches BOTH rules:');
    console.log('- Rule 13 (Larger): 96-120 range → $50');
    console.log('- Rule 14 (Smaller): 84-96 range → $15');
    console.log('');
    console.log('Since both have the same specificity (2), the sort returns the first one after sorting.');
    console.log('This creates ambiguity at the boundary value of 96.');
    console.log('');
    console.log('=== SUGGESTED SOLUTIONS ===');
    console.log('1. Make ranges exclusive at boundaries (e.g., 84-95.99 and 96-120)');
    console.log('2. Add priority field to rules');
    console.log('3. Use more specific logic for boundary cases');
    console.log('4. Change the BOM formula to not use "height-2" but let stock rules handle it');

    console.log('\n=== TESTING BOUNDARY BEHAVIOR ===');
    
    // Test edge cases
    const testHeights = [84, 95, 95.99, 96, 96.01, 120];
    
    testHeights.forEach(height => {
      console.log(`\nTesting height ${height}":`);
      
      const applicableRules = rules.filter(rule => {
        const matchesHeight = (rule.minHeight === null || height >= rule.minHeight) && 
                             (rule.maxHeight === null || height <= rule.maxHeight);
        return rule.isActive && matchesHeight;
      });
      
      if (applicableRules.length === 0) {
        console.log(`  No matching rules`);
      } else if (applicableRules.length === 1) {
        console.log(`  Matches: Rule ${applicableRules[0].id} "${applicableRules[0].name}" ($${applicableRules[0].basePrice})`);
      } else {
        console.log(`  Matches ${applicableRules.length} rules (AMBIGUOUS):`);
        applicableRules.forEach(rule => {
          console.log(`    Rule ${rule.id} "${rule.name}" ($${rule.basePrice})`);
        });
      }
    });

    db.close();
  });
}

analyzeRuleLogic();