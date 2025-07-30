const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database connection
const db = new sqlite3.Database('./prisma/dev.db');

// Function to evaluate simple mathematical formulas
function evaluateFormula(formula, variables) {
  if (!formula || typeof formula !== 'string' || formula.trim() === '') return 0;
  
  try {
    // Replace variables in formula
    let expression = formula.trim();
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\b${key}\\b`, 'g');
      expression = expression.replace(regex, value.toString());
    }
    
    // Check if expression is empty after variable replacement
    if (!expression || expression.trim() === '') {
      return 0;
    }
    
    console.log(`  Formula evaluation: "${formula}" with variables:`, variables);
    console.log(`  Expression after substitution: "${expression}"`);
    
    // Basic math evaluation (be careful with eval - this is simplified)
    const result = eval(expression);
    const finalResult = isNaN(result) ? 0 : Math.max(0, result);
    console.log(`  Result: ${finalResult}`);
    return finalResult;
  } catch (error) {
    console.error('Formula evaluation error for formula:', formula, 'error:', error);
    return 0;
  }
}

// Function to find the best stock length rule for extrusions
function findBestStockLengthRule(rules, componentWidth, componentHeight) {
  console.log(`\n  Finding best stock length rule for ${componentWidth}"W × ${componentHeight}"H`);
  console.log(`  Available rules:`, rules.map(r => ({
    id: r.id,
    name: r.name,
    minHeight: r.minHeight,
    maxHeight: r.maxHeight,
    minWidth: r.minWidth,
    maxWidth: r.maxWidth,
    basePrice: r.basePrice,
    stockLength: r.stockLength,
    isActive: r.isActive
  })));

  const applicableRules = rules.filter(rule => {
    // Check dimension constraints based on component size (panel dimensions)
    const matchesWidth = (rule.minWidth === null || componentWidth >= rule.minWidth) && 
                        (rule.maxWidth === null || componentWidth <= rule.maxWidth);
    const matchesHeight = (rule.minHeight === null || componentHeight >= rule.minHeight) && 
                         (rule.maxHeight === null || componentHeight <= rule.maxHeight);
    
    const applicable = rule.isActive && matchesWidth && matchesHeight;
    console.log(`    Rule "${rule.name}": width match=${matchesWidth}, height match=${matchesHeight}, active=${rule.isActive}, applicable=${applicable}`);
    return applicable;
  });
  
  // Return the rule with the most restrictive constraints (most specific)
  const bestRule = applicableRules.sort((a, b) => {
    const aSpecificity = (a.minWidth !== null ? 1 : 0) + (a.maxWidth !== null ? 1 : 0) +
                        (a.minHeight !== null ? 1 : 0) + (a.maxHeight !== null ? 1 : 0);
    const bSpecificity = (b.minWidth !== null ? 1 : 0) + (b.maxWidth !== null ? 1 : 0) +
                        (b.minHeight !== null ? 1 : 0) + (b.maxHeight !== null ? 1 : 0);
    return bSpecificity - aSpecificity;
  })[0] || null;

  if (bestRule) {
    console.log(`  Selected rule: "${bestRule.name}" (basePrice: ${bestRule.basePrice}, stockLength: ${bestRule.stockLength})`);
  } else {
    console.log(`  No applicable rule found`);
  }
  
  return bestRule;
}

// Function to calculate BOM item price with detailed logging
async function calculateBOMItemPrice(bom, componentWidth, componentHeight) {
  console.log(`\n--- Calculating BOM Item Price ---`);
  console.log(`Part: ${bom.partName} (${bom.partNumber})`);
  console.log(`Type: ${bom.partType}`);
  console.log(`Quantity: ${bom.quantity}`);
  console.log(`Formula: ${bom.formula}`);
  console.log(`Direct Cost: ${bom.cost}`);
  console.log(`Panel dimensions: ${componentWidth}"W × ${componentHeight}"H`);

  const variables = {
    width: componentWidth || 0,
    height: componentHeight || 0,
    quantity: bom.quantity || 1
  };

  let cost = 0;
  let breakdown = {
    partNumber: bom.partNumber,
    partName: bom.partName,
    partType: bom.partType,
    quantity: bom.quantity || 1,
    method: 'unknown',
    details: '',
    unitCost: 0,
    totalCost: 0
  };

  // Method 1: Direct cost from ProductBOM
  if (bom.cost && bom.cost > 0) {
    cost = bom.cost * (bom.quantity || 1);
    breakdown.method = 'direct_bom_cost';
    breakdown.unitCost = bom.cost;
    breakdown.totalCost = cost;
    breakdown.details = `Direct cost from ProductBOM: $${bom.cost} × ${bom.quantity || 1}`;
    console.log(`✓ Using direct BOM cost: $${cost}`);
    return { cost, breakdown };
  }

  // Method 2: Formula from ProductBOM
  if (bom.formula) {
    cost = evaluateFormula(bom.formula, variables);
    breakdown.method = 'bom_formula';
    breakdown.unitCost = cost / (bom.quantity || 1);
    breakdown.totalCost = cost;
    breakdown.details = `Formula: ${bom.formula} = $${cost}`;
    console.log(`✓ Using BOM formula: $${cost}`);
    return { cost, breakdown };
  }

  // Method 3: Find MasterPart by partNumber and apply pricing rules
  if (bom.partNumber) {
    console.log(`\n  Looking up MasterPart for ${bom.partNumber}...`);
    
    return new Promise((resolve) => {
      // Get master part with stock length rules and pricing rules
      db.get(`
        SELECT * FROM MasterParts WHERE partNumber = ?
      `, [bom.partNumber], (err, masterPart) => {
        if (err) {
          console.error(`Error looking up MasterPart:`, err);
          breakdown.method = 'error';
          breakdown.details = `Error looking up master part: ${err.message}`;
          breakdown.totalCost = 0;
          return resolve({ cost: 0, breakdown });
        }

        if (!masterPart) {
          console.log(`  No MasterPart found for ${bom.partNumber}`);
          breakdown.method = 'no_master_part';
          breakdown.details = 'No master part found';
          breakdown.totalCost = 0;
          return resolve({ cost: 0, breakdown });
        }

        console.log(`  Found MasterPart:`, masterPart);

        // For Hardware: Use direct cost from MasterPart
        if (masterPart.partType === 'Hardware' && masterPart.cost && masterPart.cost > 0) {
          cost = masterPart.cost * (bom.quantity || 1);
          breakdown.method = 'master_part_hardware';
          breakdown.unitCost = masterPart.cost;
          breakdown.totalCost = cost;
          breakdown.details = `Hardware cost: $${masterPart.cost} × ${bom.quantity || 1}`;
          console.log(`✓ Using hardware cost: $${cost}`);
          return resolve({ cost, breakdown });
        }

        // For Extrusions: Use StockLengthRules based on component dimensions
        if (masterPart.partType === 'Extrusion') {
          console.log(`\n  Getting stock length rules for extrusion...`);
          
          db.all(`
            SELECT * FROM StockLengthRules WHERE masterPartId = ? AND isActive = 1
          `, [masterPart.id], (err, stockRules) => {
            if (err) {
              console.error(`Error getting stock rules:`, err);
              breakdown.method = 'error';
              breakdown.details = `Error getting stock rules: ${err.message}`;
              breakdown.totalCost = 0;
              return resolve({ cost: 0, breakdown });
            }

            if (stockRules && stockRules.length > 0) {
              const bestRule = findBestStockLengthRule(stockRules, componentWidth, componentHeight);
              if (bestRule) {
                if (bestRule.formula) {
                  const extrusionVariables = {
                    ...variables,
                    basePrice: bestRule.basePrice || 0,
                    stockLength: bestRule.stockLength || 0,
                    piecesPerUnit: bestRule.piecesPerUnit || 1
                  };
                  cost = evaluateFormula(bestRule.formula, extrusionVariables);
                  breakdown.method = 'extrusion_rule_formula';
                  breakdown.details = `Extrusion rule for ${componentWidth}"W × ${componentHeight}"H: ${bestRule.formula} (basePrice: ${bestRule.basePrice}, stockLength: ${bestRule.stockLength}) = $${cost}`;
                } else if (bestRule.basePrice) {
                  cost = bestRule.basePrice * (bom.quantity || 1);
                  breakdown.method = 'extrusion_rule_base';
                  breakdown.details = `Extrusion base price for ${componentWidth}"W × ${componentHeight}"H: $${bestRule.basePrice} × ${bom.quantity || 1}`;
                }
                breakdown.unitCost = cost / (bom.quantity || 1);
                breakdown.totalCost = cost;
                console.log(`✓ Using extrusion rule: $${cost}`);
                return resolve({ cost, breakdown });
              }
            }

            // Get pricing rules as fallback
            console.log(`\n  Getting pricing rules...`);
            db.all(`
              SELECT * FROM PricingRules WHERE masterPartId = ? AND isActive = 1
            `, [masterPart.id], (err, pricingRules) => {
              if (err) {
                console.error(`Error getting pricing rules:`, err);
                breakdown.method = 'error';
                breakdown.details = `Error getting pricing rules: ${err.message}`;
                breakdown.totalCost = 0;
                return resolve({ cost: 0, breakdown });
              }

              // Use pricing rules
              if (pricingRules && pricingRules.length > 0) {
                const rule = pricingRules[0]; // Use first active rule
                if (rule.formula) {
                  const ruleVariables = {
                    ...variables,
                    basePrice: rule.basePrice || 0
                  };
                  cost = evaluateFormula(rule.formula, ruleVariables);
                  breakdown.method = 'pricing_rule_formula';
                  breakdown.details = `Pricing rule: ${rule.formula}`;
                } else if (rule.basePrice) {
                  cost = rule.basePrice * (bom.quantity || 1);
                  breakdown.method = 'pricing_rule_base';
                  breakdown.details = `Pricing rule base: $${rule.basePrice} × ${bom.quantity || 1}`;
                }
                breakdown.unitCost = cost / (bom.quantity || 1);
                breakdown.totalCost = cost;
                console.log(`✓ Using pricing rule: $${cost}`);
                return resolve({ cost, breakdown });
              }

              // Fallback to MasterPart direct cost
              if (masterPart.cost && masterPart.cost > 0) {
                cost = masterPart.cost * (bom.quantity || 1);
                breakdown.method = 'master_part_direct';
                breakdown.unitCost = masterPart.cost;
                breakdown.totalCost = cost;
                breakdown.details = `MasterPart direct cost: $${masterPart.cost} × ${bom.quantity || 1}`;
                console.log(`✓ Using master part direct cost: $${cost}`);
                return resolve({ cost, breakdown });
              }

              // No cost found
              breakdown.method = 'no_cost_found';
              breakdown.details = 'No pricing method found';
              breakdown.totalCost = 0;
              console.log(`✗ No cost found`);
              return resolve({ cost: 0, breakdown });
            });
          });
        } else {
          // Not extrusion, check pricing rules
          console.log(`\n  Getting pricing rules for non-extrusion...`);
          db.all(`
            SELECT * FROM PricingRules WHERE masterPartId = ? AND isActive = 1
          `, [masterPart.id], (err, pricingRules) => {
            if (err) {
              console.error(`Error getting pricing rules:`, err);
              breakdown.method = 'error';
              breakdown.details = `Error getting pricing rules: ${err.message}`;
              breakdown.totalCost = 0;
              return resolve({ cost: 0, breakdown });
            }

            if (pricingRules && pricingRules.length > 0) {
              const rule = pricingRules[0]; // Use first active rule
              if (rule.formula) {
                const ruleVariables = {
                  ...variables,
                  basePrice: rule.basePrice || 0
                };
                cost = evaluateFormula(rule.formula, ruleVariables);
                breakdown.method = 'pricing_rule_formula';
                breakdown.details = `Pricing rule: ${rule.formula}`;
              } else if (rule.basePrice) {
                cost = rule.basePrice * (bom.quantity || 1);
                breakdown.method = 'pricing_rule_base';
                breakdown.details = `Pricing rule base: $${rule.basePrice} × ${bom.quantity || 1}`;
              }
              breakdown.unitCost = cost / (bom.quantity || 1);
              breakdown.totalCost = cost;
              console.log(`✓ Using pricing rule: $${cost}`);
              return resolve({ cost, breakdown });
            }

            // Fallback to MasterPart direct cost
            if (masterPart.cost && masterPart.cost > 0) {
              cost = masterPart.cost * (bom.quantity || 1);
              breakdown.method = 'master_part_direct';
              breakdown.unitCost = masterPart.cost;
              breakdown.totalCost = cost;
              breakdown.details = `MasterPart direct cost: $${masterPart.cost} × ${bom.quantity || 1}`;
              console.log(`✓ Using master part direct cost: $${cost}`);
              return resolve({ cost, breakdown });
            }

            // No cost found
            breakdown.method = 'no_cost_found';
            breakdown.details = 'No pricing method found';
            breakdown.totalCost = 0;
            console.log(`✗ No cost found`);
            return resolve({ cost: 0, breakdown });
          });
        }
      });
    });
  }

  breakdown.method = 'no_part_number';
  breakdown.details = 'No part number provided';
  breakdown.totalCost = 0;
  console.log(`✗ No part number provided`);
  return { cost: 0, breakdown };
}

// Main debug function
async function debugOpeningPrice(openingId) {
  console.log(`\n=== DEBUGGING OPENING PRICE FOR OPENING ID ${openingId} ===\n`);

  return new Promise((resolve) => {
    // Get opening data
    db.get(`
      SELECT * FROM Openings WHERE id = ?
    `, [openingId], (err, opening) => {
      if (err) {
        console.error('Error getting opening:', err);
        return resolve();
      }

      if (!opening) {
        console.error('Opening not found');
        return resolve();
      }

      console.log('Opening data:', opening);

      // Get panels for this opening
      db.all(`
        SELECT * FROM Panels WHERE openingId = ?
      `, [openingId], (err, panels) => {
        if (err) {
          console.error('Error getting panels:', err);
          return resolve();
        }

        console.log(`\nFound ${panels.length} panel(s):`, panels);

        let totalPrice = 0;
        let processedPanels = 0;

        if (panels.length === 0) {
          console.log('\n=== FINAL RESULT ===');
          console.log(`Total calculated price: $${totalPrice}`);
          console.log(`Database stored price: $${opening.price}`);
          return resolve();
        }

        // Process each panel
        panels.forEach((panel, panelIndex) => {
          console.log(`\n--- Processing Panel ${panelIndex + 1} (ID: ${panel.id}) ---`);
          console.log(`Panel dimensions: ${panel.width}"W × ${panel.height}"H`);

          // Get component instance for this panel
          db.get(`
            SELECT * FROM ComponentInstances WHERE panelId = ?
          `, [panel.id], (err, componentInstance) => {
            if (err) {
              console.error(`Error getting component instance for panel ${panel.id}:`, err);
              processedPanels++;
              if (processedPanels === panels.length) {
                console.log('\n=== FINAL RESULT ===');
                console.log(`Total calculated price: $${totalPrice}`);
                console.log(`Database stored price: $${opening.price}`);
                console.log(`Discrepancy: $${Math.abs(totalPrice - opening.price)}`);
                resolve();
              }
              return;
            }

            if (!componentInstance) {
              console.log(`No component instance found for panel ${panel.id}`);
              processedPanels++;
              if (processedPanels === panels.length) {
                console.log('\n=== FINAL RESULT ===');
                console.log(`Total calculated price: $${totalPrice}`);
                console.log(`Database stored price: $${opening.price}`);
                console.log(`Discrepancy: $${Math.abs(totalPrice - opening.price)}`);
                resolve();
              }
              return;
            }

            console.log(`Component instance:`, componentInstance);

            // Get product for this component
            db.get(`
              SELECT * FROM Products WHERE id = ?
            `, [componentInstance.productId], (err, product) => {
              if (err) {
                console.error(`Error getting product:`, err);
                processedPanels++;
                if (processedPanels === panels.length) {
                  console.log('\n=== FINAL RESULT ===');
                  console.log(`Total calculated price: $${totalPrice}`);
                  console.log(`Database stored price: $${opening.price}`);
                  console.log(`Discrepancy: $${Math.abs(totalPrice - opening.price)}`);
                  resolve();
                }
                return;
              }

              if (!product) {
                console.log(`Product not found for component instance`);
                processedPanels++;
                if (processedPanels === panels.length) {
                  console.log('\n=== FINAL RESULT ===');
                  console.log(`Total calculated price: $${totalPrice}`);
                  console.log(`Database stored price: $${opening.price}`);
                  console.log(`Discrepancy: $${Math.abs(totalPrice - opening.price)}`);
                  resolve();
                }
                return;
              }

              console.log(`Product: ${product.name}`);

              // Get BOMs for this product
              db.all(`
                SELECT * FROM ProductBOMs WHERE productId = ?
              `, [product.id], async (err, productBOMs) => {
                if (err) {
                  console.error(`Error getting product BOMs:`, err);
                  processedPanels++;
                  if (processedPanels === panels.length) {
                    console.log('\n=== FINAL RESULT ===');
                    console.log(`Total calculated price: $${totalPrice}`);
                    console.log(`Database stored price: $${opening.price}`);
                    console.log(`Discrepancy: $${Math.abs(totalPrice - opening.price)}`);
                    resolve();
                  }
                  return;
                }

                console.log(`\nFound ${productBOMs.length} BOM item(s) for product:`);
                
                let panelCost = 0;
                
                // Process each BOM item
                for (const bom of productBOMs) {
                  const { cost, breakdown } = await calculateBOMItemPrice(bom, panel.width, panel.height);
                  panelCost += cost;
                  
                  console.log(`\nBOM Item Result:`);
                  console.log(`  Cost: $${cost}`);
                  console.log(`  Method: ${breakdown.method}`);
                  console.log(`  Details: ${breakdown.details}`);
                }

                console.log(`\n--- Panel ${panelIndex + 1} Total Cost: $${panelCost} ---`);
                totalPrice += panelCost;

                processedPanels++;
                if (processedPanels === panels.length) {
                  console.log('\n=== FINAL RESULT ===');
                  console.log(`Total calculated price: $${totalPrice}`);
                  console.log(`Database stored price: $${opening.price}`);
                  console.log(`Discrepancy: $${Math.abs(totalPrice - opening.price)}`);
                  
                  if (totalPrice !== opening.price) {
                    console.log(`\n=== PROBLEM IDENTIFIED ===`);
                    if (totalPrice > opening.price) {
                      console.log(`Calculated price is $${totalPrice - opening.price} HIGHER than stored price`);
                    } else {
                      console.log(`Calculated price is $${opening.price - totalPrice} LOWER than stored price`);
                    }
                  }
                  
                  resolve();
                }
              });
            });
          });
        });
      });
    });
  });
}

// Run the debug
debugOpeningPrice(4).then(() => {
  db.close();
  console.log('\n=== DEBUG COMPLETE ===');
});