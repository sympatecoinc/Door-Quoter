import { describe, it, expect } from 'vitest'
import { summaryToCSV, AggregatedBomItem } from '@/lib/bom-utils'

// Helper to create mock aggregated items for CSV testing
function createMockAggregatedItem(overrides: Partial<AggregatedBomItem> = {}): AggregatedBomItem {
  return {
    partNumber: 'HW-001',
    partName: 'Test Part',
    partType: 'Hardware',
    totalQuantity: 1,
    unit: 'EA',
    stockLength: null,
    cutLengths: [],
    totalCutLength: 0,
    calculatedLengths: [],
    totalCalculatedLength: 0,
    glassDimensions: [],
    totalArea: 0,
    glassWidth: null,
    glassHeight: null,
    stockPiecesNeeded: null,
    wastePercent: null,
    ...overrides,
  }
}

describe('summaryToCSV', () => {
  describe('Header Row', () => {
    it('should include all expected headers', () => {
      const csv = summaryToCSV('Test Project', [])
      const headers = csv.split('\n')[0]

      expect(headers).toContain('Part Number')
      expect(headers).toContain('Part Name')
      expect(headers).toContain('Type')
      expect(headers).toContain('Size (WxH)')
      expect(headers).toContain('Pieces')
      expect(headers).toContain('Unit')
      expect(headers).toContain('Stock Length')
      expect(headers).toContain('Stock Pieces to Order')
      expect(headers).toContain('Waste %')
      expect(headers).toContain('Area (SQ FT)')
    })

    it('should have exactly 10 columns', () => {
      const csv = summaryToCSV('Test Project', [])
      const headers = csv.split('\n')[0].split(',')

      expect(headers).toHaveLength(10)
    })
  })

  describe('Extrusion Data Formatting', () => {
    it('should format extrusion data correctly', () => {
      const items = [createMockAggregatedItem({
        partNumber: 'EXT-001-BL-288',
        partName: 'Frame Vertical',
        partType: 'Extrusion',
        totalQuantity: 20,
        unit: 'IN',
        stockLength: 288,
        cutLengths: [108, 108, 42, 42],
        stockPiecesNeeded: 3,
        wastePercent: 15.5,
      })]

      const csv = summaryToCSV('Test Project', items)
      const dataRow = csv.split('\n')[1]

      expect(dataRow).toContain('"EXT-001-BL-288"')
      expect(dataRow).toContain('"Frame Vertical"')
      expect(dataRow).toContain('"Extrusion"')
      expect(dataRow).toContain('"15.5%"')
    })

    it('should show unique cut lengths for extrusions', () => {
      const items = [createMockAggregatedItem({
        partNumber: 'EXT-001',
        partType: 'Extrusion',
        cutLengths: [108, 108, 42, 42], // Two unique values
      })]

      const csv = summaryToCSV('Test Project', items)
      const dataRow = csv.split('\n')[1]

      // Should show unique cut lengths separated by semicolon
      expect(dataRow).toContain('108.00')
      expect(dataRow).toContain('42.00')
    })

    it('should show stock pieces to order for extrusions', () => {
      const items = [createMockAggregatedItem({
        partType: 'Extrusion',
        stockPiecesNeeded: 5,
      })]

      const csv = summaryToCSV('Test Project', items)
      const dataRow = csv.split('\n')[1]

      expect(dataRow).toContain('"5"')
    })
  })

  describe('Glass Data Formatting', () => {
    it('should format glass data with dimensions', () => {
      const items = [createMockAggregatedItem({
        partNumber: 'GLASS-CLEAR',
        partName: 'Clear Glass',
        partType: 'Glass',
        totalQuantity: 5,
        unit: 'SQ FT',
        totalArea: 147.22,
        glassWidth: 40.00,
        glassHeight: 106.00,
      })]

      const csv = summaryToCSV('Test Project', items)
      const dataRow = csv.split('\n')[1]

      expect(dataRow).toContain('40.00')
      expect(dataRow).toContain('106.00')
      expect(dataRow).toContain('"147.22"') // Area
    })

    it('should show glass area in correct column', () => {
      const items = [createMockAggregatedItem({
        partType: 'Glass',
        totalArea: 50.25,
        glassWidth: 30,
        glassHeight: 80,
      })]

      const csv = summaryToCSV('Test Project', items)
      const fields = csv.split('\n')[1].split(',')

      // Area should be the last field (10th column)
      expect(fields[9]).toContain('50.25')
    })
  })

  describe('Hardware with LF/IN Units', () => {
    it('should format hardware with LF unit showing calculated length', () => {
      const items = [createMockAggregatedItem({
        partNumber: 'HW-GASKET',
        partName: 'Door Gasket',
        partType: 'Hardware',
        totalQuantity: 10,
        unit: 'LF',
        totalCalculatedLength: 125.5,
      })]

      const csv = summaryToCSV('Test Project', items)
      const dataRow = csv.split('\n')[1]

      expect(dataRow).toContain('125.50 LF')
    })

    it('should format hardware with IN unit showing calculated length', () => {
      const items = [createMockAggregatedItem({
        partNumber: 'HW-TRIM',
        partType: 'Hardware',
        unit: 'IN',
        totalCalculatedLength: 84.00,
      })]

      const csv = summaryToCSV('Test Project', items)
      const dataRow = csv.split('\n')[1]

      expect(dataRow).toContain('84.00 IN')
    })

    it('should handle Fastener type with LF unit', () => {
      const items = [createMockAggregatedItem({
        partNumber: 'FST-001',
        partType: 'Fastener',
        unit: 'LF',
        totalCalculatedLength: 50.00,
      })]

      const csv = summaryToCSV('Test Project', items)
      const dataRow = csv.split('\n')[1]

      expect(dataRow).toContain('50.00 LF')
    })
  })

  describe('CSV Formatting', () => {
    it('should escape double quotes in field values', () => {
      const items = [createMockAggregatedItem({
        partName: 'Part with "quotes"',
      })]

      const csv = summaryToCSV('Test Project', items)

      expect(csv).toContain('""quotes""')
    })

    it('should wrap all fields in double quotes', () => {
      const items = [createMockAggregatedItem({
        partNumber: 'HW-001',
        partName: 'Simple Part',
      })]

      const csv = summaryToCSV('Test Project', items)
      const dataRow = csv.split('\n')[1]
      const fields = dataRow.split(',')

      fields.forEach(field => {
        expect(field).toMatch(/^".*"$/)
      })
    })

    it('should handle commas in field values', () => {
      const items = [createMockAggregatedItem({
        partName: 'Part, with comma',
      })]

      const csv = summaryToCSV('Test Project', items)

      // The comma should be inside quotes
      // Verify the part name is properly quoted
      expect(csv).toContain('"Part, with comma"')

      // Verify we still have proper structure (header + 1 data row)
      const lines = csv.split('\n')
      expect(lines).toHaveLength(2)
    })

    it('should produce valid CSV with newline separators', () => {
      const items = [
        createMockAggregatedItem({ partNumber: 'HW-001' }),
        createMockAggregatedItem({ partNumber: 'HW-002' }),
      ]

      const csv = summaryToCSV('Test Project', items)
      const lines = csv.split('\n')

      expect(lines).toHaveLength(3) // Header + 2 data rows
    })
  })

  describe('Empty/Null Handling', () => {
    it('should handle null values gracefully', () => {
      const items = [createMockAggregatedItem({
        partNumber: 'HW-001',
        stockLength: null,
        stockPiecesNeeded: null,
        wastePercent: null,
        glassWidth: null,
        glassHeight: null,
      })]

      const csv = summaryToCSV('Test Project', items)

      // Should not throw and should produce valid CSV
      expect(() => csv.split('\n')).not.toThrow()
      const lines = csv.split('\n')
      expect(lines).toHaveLength(2) // Header + data row
    })

    it('should show empty string for null stock length', () => {
      const items = [createMockAggregatedItem({
        stockLength: null,
      })]

      const csv = summaryToCSV('Test Project', items)
      const dataRow = csv.split('\n')[1]
      const fields = dataRow.split(',')

      // Stock length is 7th column (index 6)
      expect(fields[6]).toBe('""')
    })

    it('should show empty string for null stock pieces needed', () => {
      const items = [createMockAggregatedItem({
        stockPiecesNeeded: null,
      })]

      const csv = summaryToCSV('Test Project', items)
      const dataRow = csv.split('\n')[1]
      const fields = dataRow.split(',')

      // Stock pieces to order is 8th column (index 7)
      expect(fields[7]).toBe('""')
    })

    it('should show empty string for null waste percent', () => {
      const items = [createMockAggregatedItem({
        wastePercent: null,
      })]

      const csv = summaryToCSV('Test Project', items)
      const dataRow = csv.split('\n')[1]
      const fields = dataRow.split(',')

      // Waste % is 9th column (index 8)
      expect(fields[8]).toBe('""')
    })

    it('should show empty area for non-glass items', () => {
      const items = [createMockAggregatedItem({
        partType: 'Hardware',
        totalArea: 0,
      })]

      const csv = summaryToCSV('Test Project', items)
      const dataRow = csv.split('\n')[1]
      const fields = dataRow.split(',')

      // Area is 10th column (index 9)
      expect(fields[9]).toBe('""')
    })
  })

  describe('Multiple Items', () => {
    it('should handle multiple items of different types', () => {
      const items = [
        createMockAggregatedItem({
          partNumber: 'EXT-001',
          partType: 'Extrusion',
          stockLength: 288,
          cutLengths: [108],
        }),
        createMockAggregatedItem({
          partNumber: 'HW-001',
          partType: 'Hardware',
        }),
        createMockAggregatedItem({
          partNumber: 'GLASS-001',
          partType: 'Glass',
          glassWidth: 40,
          glassHeight: 106,
          totalArea: 29.44,
        }),
      ]

      const csv = summaryToCSV('Test Project', items)
      const lines = csv.split('\n')

      expect(lines).toHaveLength(4) // Header + 3 data rows
    })
  })

  describe('Size Column Content', () => {
    it('should show empty size for hardware without calculated length', () => {
      const items = [createMockAggregatedItem({
        partType: 'Hardware',
        unit: 'EA',
        totalCalculatedLength: 0,
      })]

      const csv = summaryToCSV('Test Project', items)
      const dataRow = csv.split('\n')[1]
      const fields = dataRow.split(',')

      // Size is 4th column (index 3)
      expect(fields[3]).toBe('""')
    })

    it('should show glass dimensions in Size column', () => {
      const items = [createMockAggregatedItem({
        partType: 'Glass',
        glassWidth: 36.50,
        glassHeight: 96.25,
      })]

      const csv = summaryToCSV('Test Project', items)
      const dataRow = csv.split('\n')[1]

      expect(dataRow).toContain('36.50')
      expect(dataRow).toContain('96.25')
    })

    it('should show cut lengths in Size column for extrusions', () => {
      const items = [createMockAggregatedItem({
        partType: 'Extrusion',
        cutLengths: [100, 50, 100], // 100 appears twice
      })]

      const csv = summaryToCSV('Test Project', items)
      const dataRow = csv.split('\n')[1]

      // Should show unique cuts: 100.00 and 50.00
      expect(dataRow).toContain('100.00')
      expect(dataRow).toContain('50.00')
    })
  })
})
