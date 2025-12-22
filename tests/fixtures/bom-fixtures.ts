import type { BomItem } from '@/lib/bom-utils'

export interface MockBomItemOverrides {
  partNumber?: string
  partName?: string
  partType?: string
  quantity?: number
  unit?: string
  stockLength?: number | null
  cutLength?: number | null
  calculatedLength?: number | null
  glassWidth?: number | null
  glassHeight?: number | null
  glassArea?: number | null
}

export function createMockBomItem(overrides: MockBomItemOverrides = {}): BomItem {
  return {
    partNumber: 'HW-001',
    partName: 'Test Hardware',
    partType: 'Hardware',
    quantity: 1,
    unit: 'EA',
    stockLength: null,
    cutLength: null,
    calculatedLength: null,
    glassWidth: null,
    glassHeight: null,
    glassArea: null,
    ...overrides,
  }
}

export function createMockExtrusionItem(overrides: MockBomItemOverrides = {}): BomItem {
  return createMockBomItem({
    partNumber: 'EXT-001',
    partName: 'Frame Vertical',
    partType: 'Extrusion',
    cutLength: 108,
    stockLength: 288,
    unit: 'IN',
    ...overrides,
  })
}

export function createMockGlassItem(overrides: MockBomItemOverrides = {}): BomItem {
  const width = overrides.glassWidth ?? 40
  const height = overrides.glassHeight ?? 106
  const area = (width * height) / 144 // Square feet

  return createMockBomItem({
    partNumber: 'GLASS-CLEAR',
    partName: 'Clear Glass',
    partType: 'Glass',
    unit: 'SQ FT',
    glassWidth: width,
    glassHeight: height,
    glassArea: Math.round(area * 100) / 100,
    ...overrides,
  })
}

export function createMockHardwareWithLength(overrides: MockBomItemOverrides = {}): BomItem {
  return createMockBomItem({
    partNumber: 'HW-GASKET',
    partName: 'Door Gasket',
    partType: 'Hardware',
    unit: 'LF',
    calculatedLength: 10.5,
    ...overrides,
  })
}

export function createMockOptionItem(overrides: MockBomItemOverrides = {}): BomItem {
  return createMockBomItem({
    partNumber: 'OPT-001',
    partName: 'Optional Component',
    partType: 'Option',
    unit: 'EA',
    ...overrides,
  })
}
