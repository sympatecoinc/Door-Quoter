/**
 * Generates a pricing debug CSV from pricing debug API data.
 * Shared utility used by QuoteView and QuoteVersionModal.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function generatePricingDebugCSV(data: any): string {
  let csv = ''

  // Header section
  csv += '=== PROJECT PRICING DEBUG ===\n'
  csv += `Project,"${data.project.name}"\n`
  csv += `Status,"${data.project.status}"\n`
  csv += '\n'

  if (data.pricingMode) {
    csv += '=== PRICING MODE ===\n'
    csv += `Name,"${data.pricingMode.name}"\n`
    csv += `Extrusion Markup,${data.pricingMode.extrusionMarkup}%\n`
    csv += `Hardware Markup,${data.pricingMode.hardwareMarkup}%\n`
    csv += `Glass Markup,${data.pricingMode.glassMarkup}%\n`
    csv += `Packaging Markup,${data.pricingMode.packagingMarkup}%\n`
    csv += `Global Markup,${data.pricingMode.globalMarkup}%\n`
    csv += `Discount,${data.pricingMode.discount}%\n`
    csv += `Extrusion Costing,"${data.pricingMode.extrusionCostingMethod}"\n`
    csv += '\n'
  }

  // Process each opening
  for (const opening of data.openings) {
    csv += `=== OPENING: ${opening.name} ===\n`
    csv += `Finish Color,"${opening.finishColor}"\n`
    csv += '\n'

    // Process each component
    for (const component of opening.components) {
      csv += `--- Component: ${component.productName} (Panel ${component.panelId}) ---\n`
      csv += `Dimensions,"${component.dimensions.width}" W x ${component.dimensions.height}" H"\n`
      csv += '\n'

      // BOM Items
      if (component.bomItems.length > 0) {
        csv += 'BOM ITEMS\n'
        csv += 'Part Number,Part Name,Part Type,Stock Length,Cut Length,Quantity,Unit Cost,Finish Cost,Total Cost,Method,Details,Finish Details\n'
        for (const bom of component.bomItems) {
          const partNumber = bom.partNumber || ''
          const partName = (bom.partName || '').replace(/"/g, '""')
          const partType = bom.partType || ''
          const stockLength = bom.stockLength ? `${bom.stockLength}in` : ''
          const cutLength = bom.cutLength ? `${bom.cutLength.toFixed(2)}in` : ''
          const quantity = bom.quantity || 1
          const unitCost = bom.unitCost?.toFixed(2) || '0.00'
          const finishCost = bom.finishCost?.toFixed(2) || '0.00'
          const totalCost = bom.totalCost?.toFixed(2) || '0.00'
          const method = bom.method || ''
          const details = (bom.details || '').replace(/"/g, '""')
          const finishDetails = (bom.finishDetails || '').replace(/"/g, '""')
          csv += `"${partNumber}","${partName}","${partType}","${stockLength}","${cutLength}",${quantity},$${unitCost},$${finishCost},$${totalCost},"${method}","${details}","${finishDetails}"\n`
        }
        csv += '\n'
      }

      // Option Items
      if (component.optionItems.length > 0) {
        csv += 'OPTION ITEMS\n'
        csv += 'Category,Option Name,Part Number,Quantity,Unit Price,Total Price,Method,Details,Is Standard,Is Included\n'
        for (const opt of component.optionItems) {
          const category = (opt.category || '').replace(/"/g, '""')
          const optName = (opt.optionName || '').replace(/"/g, '""')
          const partNumber = opt.partNumber || ''
          const quantity = opt.quantity || 1
          const unitPrice = opt.unitPrice?.toFixed(2) || '0.00'
          const price = opt.price?.toFixed(2) || '0.00'
          const method = opt.method || ''
          const details = (opt.details || '').replace(/"/g, '""')
          const isStandard = opt.isStandard ? 'Yes' : 'No'
          const isIncluded = opt.isIncluded ? 'Yes' : 'No'
          csv += `"${category}","${optName}","${partNumber}",${quantity},$${unitPrice},$${price},"${method}","${details}",${isStandard},${isIncluded}\n`
        }
        csv += '\n'
      }

      // Glass Item
      if (component.glassItem) {
        const g = component.glassItem
        csv += 'GLASS\n'
        csv += 'Glass Type,Width Formula,Height Formula,Calc Width,Calc Height,Qty,Sqft,Price/Sqft,Total Cost\n'
        csv += `"${g.glassType}","${g.widthFormula}","${g.heightFormula}",${g.calculatedWidth?.toFixed(3)},${g.calculatedHeight?.toFixed(3)},${g.quantity},${g.sqft},$${g.pricePerSqFt?.toFixed(2)},$${g.totalCost?.toFixed(2)}\n`
        csv += '\n'
      }

      csv += `Component BOM Total,$${component.totalBOMCost?.toFixed(2)}\n`
      csv += `Component Options Total,$${component.totalOptionCost?.toFixed(2)}\n`
      csv += `Component Glass Total,$${component.totalGlassCost?.toFixed(2)}\n`
      csv += '\n'
    }

    // Cost Summary
    csv += '--- OPENING COST SUMMARY ---\n'
    csv += 'Category,Base Cost,Markup %,Marked Up Cost\n'
    csv += `Extrusion,$${opening.costSummary.extrusion.base?.toFixed(2)},${opening.costSummary.extrusion.markup}%,$${opening.costSummary.extrusion.markedUp?.toFixed(2)}\n`
    csv += `Hardware,$${opening.costSummary.hardware.base?.toFixed(2)},${opening.costSummary.hardware.markup}%,$${opening.costSummary.hardware.markedUp?.toFixed(2)}\n`
    csv += `Glass,$${opening.costSummary.glass.base?.toFixed(2)},${opening.costSummary.glass.markup}%,$${opening.costSummary.glass.markedUp?.toFixed(2)}\n`
    csv += `Packaging,$${opening.costSummary.packaging.base?.toFixed(2)},${opening.costSummary.packaging.markup}%,$${opening.costSummary.packaging.markedUp?.toFixed(2)}\n`
    csv += `Other,$${opening.costSummary.other.base?.toFixed(2)},${opening.costSummary.other.markup}%,$${opening.costSummary.other.markedUp?.toFixed(2)}\n`
    csv += `Standard Options (no markup),$${opening.costSummary.standardOptions.base?.toFixed(2)},0%,$${opening.costSummary.standardOptions.markedUp?.toFixed(2)}\n`
    csv += `Hybrid Remaining (no markup),$${opening.costSummary.hybridRemaining.base?.toFixed(2)},0%,$${opening.costSummary.hybridRemaining.markedUp?.toFixed(2)}\n`
    csv += '\n'
    csv += `Opening Total (Base),$${opening.totalBaseCost?.toFixed(2)}\n`
    csv += `Opening Total (Marked Up),$${opening.totalMarkedUpCost?.toFixed(2)}\n`
    csv += '\n\n'
  }

  // Project totals
  csv += '=== PROJECT TOTALS ===\n'
  csv += `Subtotal (Base),$${data.totals.subtotalBase?.toFixed(2)}\n`
  csv += `Subtotal (Marked Up),$${data.totals.subtotalMarkedUp?.toFixed(2)}\n`
  csv += `Installation,$${data.totals.installation?.toFixed(2)}\n`
  csv += `Tax Rate,${(data.totals.taxRate * 100).toFixed(1)}%\n`
  csv += `Tax Amount,$${data.totals.taxAmount?.toFixed(2)}\n`
  csv += `Grand Total,$${data.totals.grandTotal?.toFixed(2)}\n`

  return csv
}
