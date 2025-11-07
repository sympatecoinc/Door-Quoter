# Installation Phase 2: Automated Calculation
Date: 2025-11-06
ClickUp Task: 86b70wv6f

## Overview
Add automated installation cost calculation based on product-level installation prices with complexity multipliers. Moves installation controls from Project Edit Modal to Quote View.

## Scope

### Database Schema Changes
- `prisma/schema.prisma`:
  - Add `installationPrice Float @default(0)` to Product model
  - Add `installationMethod String @default("MANUAL")` to Project model (MANUAL | PER_PRODUCT_TOTAL)
  - Add `installationComplexity String @default("STANDARD")` to Project model (SIMPLE | STANDARD | COMPLEX | VERY_COMPLEX)
  - Add `manualInstallationCost Float @default(0)` to Project model (preserves manual entry when switching modes)

### Backend API Changes
- `src/app/api/products/[id]/route.ts`:
  - Add installationPrice to GET response
  - Handle installationPrice in PUT request
- `src/app/api/projects/[id]/route.ts`:
  - Add installationMethod, installationComplexity, manualInstallationCost to GET/PUT handlers
  - Remove installationCost from PUT handler (replaced by manualInstallationCost)
- `src/app/api/projects/[id]/quote/route.ts`:
  - Calculate installation based on method:
    - MANUAL: Use manualInstallationCost
    - PER_PRODUCT_TOTAL: Sum product installation prices × complexity multiplier

### Frontend UI Changes
- `src/components/views/ProductsView.tsx`:
  - Add "Installation Price" field to product edit form
  - Display as currency input with $ prefix
- `src/components/views/QuoteView.tsx`:
  - Add installation controls (always visible):
    - Method dropdown: Manual | Per Product Total
    - If Manual: Number input for dollar amount
    - If Per Product Total: Complexity dropdown (Simple 0.9x, Standard 1.0x, Complex 1.2x, Very Complex 1.5x)
  - Remove edit mode - controls always visible
  - Show calculated installation with breakdown on hover (future enhancement)
- `src/components/views/ProjectDetailView.tsx`:
  - REMOVE installation cost field from project edit modal

## Tasks

- [ ] **Database Migration**: Add 4 new fields to schema and migrate
- [ ] **Product Model Updates**: Add installationPrice to Product API routes
- [ ] **Project Model Updates**: Add 3 new fields to Project API routes, deprecate installationCost
- [ ] **Quote Calculation Logic**: Implement per-product-total calculation with complexity multipliers
- [ ] **Products View UI**: Add installation price field to product edit form
- [ ] **Quote View UI**: Add installation method controls (method dropdown + complexity/amount fields)
- [ ] **Project Edit Modal UI**: Remove installation cost field
- [ ] **Data Migration**: Convert existing project.installationCost to project.manualInstallationCost
- [ ] **Testing**: Verify all calculation scenarios work correctly
- [ ] **PDF Export**: Ensure installation displays correctly in PDFs (should already work)

## Success Criteria

1. Products have optional installation price field (defaults to $0)
2. Projects can switch between Manual and Per Product Total methods
3. Manual values are preserved when switching modes
4. Per Product Total correctly sums all opening products × complexity multiplier
5. Installation controls are in Quote View (not Project Edit Modal)
6. Existing projects maintain their installation costs (migrated to manualInstallationCost)
7. UI is intuitive - method and complexity/amount always visible

## Detailed Implementation

### 1. Database Schema Changes

**File**: `prisma/schema.prisma`

**Product Model** (around line 84):
```prisma
model Product {
  id                   Int                    @id @default(autoincrement())
  name                 String
  description          String?
  type                 String                 @default("Product")
  productType          ProductType            @default(SWING_DOOR)
  archived             Boolean                @default(false)
  withTrim             String                 @default("Without Trim")
  glassWidthFormula    String?
  glassHeightFormula   String?
  glassQuantityFormula String?
  elevationImageData   String?
  elevationFileName    String?
  installationPrice    Float                  @default(0) // ADD THIS
  createdAt            DateTime               @default(now())
  updatedAt            DateTime               @updatedAt
  componentInstances   ComponentInstance[]
  productBOMs          ProductBOM[]
  productSubOptions    ProductSubOption[]
  planViews            ProductPlanView[]
  productDocuments     ProductQuoteDocument[]

  @@map("Products")
}
```

**Project Model** (around line 10):
```prisma
model Project {
  id                     Int                @id @default(autoincrement())
  name                   String
  status                 String             @default("Draft")
  customerId             Int
  pricingModeId          Int?
  extrusionCostingMethod String             @default("FULL_STOCK")
  excludedPartNumbers    String[]           @default([])
  multiplier             Float              @default(1.0)
  taxRate                Float              @default(0)
  installationCost       Float              @default(0) // DEPRECATED - keep for backward compat
  installationMethod     String             @default("MANUAL") // ADD THIS (MANUAL | PER_PRODUCT_TOTAL)
  installationComplexity String             @default("STANDARD") // ADD THIS (SIMPLE | STANDARD | COMPLEX | VERY_COMPLEX)
  manualInstallationCost Float              @default(0) // ADD THIS
  createdAt              DateTime           @default(now())
  updatedAt              DateTime           @updatedAt
  customer               Customer           @relation(fields: [customerId], references: [id])
  pricingMode            PricingMode?       @relation(fields: [pricingModeId], references: [id])
  openings               Opening[]
  quoteDocuments         ProjectQuoteDocument[]

  @@map("Projects")
}
```

**Migration Commands**:
```bash
npx prisma db push
```

**Data Migration Script** (run after schema push):
```sql
-- Copy existing installationCost to manualInstallationCost
UPDATE "Projects" SET "manualInstallationCost" = "installationCost";
```

### 2. Product API Routes

**File**: `src/app/api/products/[id]/route.ts`

**GET Handler** - Add to response:
```typescript
return NextResponse.json({
  success: true,
  product: {
    ...product,
    installationPrice: product.installationPrice || 0
  }
})
```

**PUT Handler** - Add to update data:
```typescript
const updateData = {
  name: body.name,
  description: body.description,
  productType: body.productType,
  installationPrice: body.installationPrice ?? 0, // ADD THIS
  // ... rest of fields
}
```

### 3. Project API Routes

**File**: `src/app/api/projects/[id]/route.ts`

**GET Handler** - Include new fields in response (should auto-include from Prisma)

**PUT Handler** - Update to handle new fields:
```typescript
const updateData: any = {
  name: body.name,
  status: body.status,
  customerId: body.customerId,
  pricingModeId: body.pricingModeId,
  multiplier: body.multiplier,
  taxRate: body.taxRate,
  installationMethod: body.installationMethod || 'MANUAL', // ADD THIS
  installationComplexity: body.installationComplexity || 'STANDARD', // ADD THIS
  manualInstallationCost: body.manualInstallationCost || 0, // ADD THIS
  // REMOVE: installationCost (deprecated)
}
```

### 4. Quote API Route - Calculation Logic

**File**: `src/app/api/projects/[id]/quote/route.ts`

**Replace installation calculation** (around line 152):

```typescript
// Calculate installation cost based on method
let installationCost = 0;

if (project.installationMethod === 'MANUAL') {
  // Manual mode: use manually entered cost
  installationCost = project.manualInstallationCost || 0;

} else if (project.installationMethod === 'PER_PRODUCT_TOTAL') {
  // Per Product Total: sum all opening product installation prices
  const complexityMultipliers = {
    'SIMPLE': 0.9,
    'STANDARD': 1.0,
    'COMPLEX': 1.2,
    'VERY_COMPLEX': 1.5
  };

  const multiplier = complexityMultipliers[project.installationComplexity] || 1.0;

  // Sum installation prices from all openings' products
  let productInstallationSum = 0;

  for (const opening of project.openings) {
    // Each opening has panels, and each panel references a product via componentLibraryId
    for (const panel of opening.panels) {
      if (panel.componentLibraryId) {
        const product = await prisma.product.findUnique({
          where: { id: panel.componentLibraryId },
          select: { installationPrice: true }
        });

        if (product && product.installationPrice) {
          productInstallationSum += product.installationPrice;
        }
      }
    }
  }

  installationCost = productInstallationSum * multiplier;
}

// Add installation to subtotal before tax
const subtotalWithInstallation = adjustedSubtotal + installationCost;
const taxAmount = subtotalWithInstallation * taxRate;
const totalPrice = subtotalWithInstallation + taxAmount;
```

**Update Response** - Add installationMethod and installationComplexity:
```typescript
return NextResponse.json({
  success: true,
  project: {
    id: project.id,
    name: project.name,
    status: project.status,
    installationMethod: project.installationMethod, // ADD THIS
    installationComplexity: project.installationComplexity, // ADD THIS
    // ... rest of fields
  },
  // ... rest of response
})
```

### 5. Products View UI

**File**: `src/components/views/ProductsView.tsx`

**Add to Product Edit Form** (find the form section, around line 200-300):

```typescript
{/* Installation Price */}
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Installation Price
  </label>
  <div className="relative">
    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
    <input
      type="number"
      value={editingProduct.installationPrice || 0}
      onChange={(e) => setEditingProduct({
        ...editingProduct,
        installationPrice: parseFloat(e.target.value) || 0
      })}
      step="0.01"
      min="0"
      className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg"
      placeholder="0.00"
    />
  </div>
  <p className="text-xs text-gray-500 mt-1">
    Base installation cost for this product type (optional)
  </p>
</div>
```

**Update TypeScript Interface**:
```typescript
interface Product {
  id: number;
  name: string;
  // ... other fields
  installationPrice?: number; // ADD THIS
}
```

### 6. Quote View UI - Installation Controls

**File**: `src/components/views/QuoteView.tsx`

**Update TypeScript Interface** (around line 50):
```typescript
interface QuoteData {
  project: {
    id: number;
    name: string;
    status: string;
    installationMethod: string; // ADD THIS
    installationComplexity: string; // ADD THIS
    // ... rest of fields
  };
  // ... rest of interface
}
```

**Add State for Installation** (in component):
```typescript
const [installationMethod, setInstallationMethod] = useState<string>('MANUAL');
const [installationComplexity, setInstallationComplexity] = useState<string>('STANDARD');
const [manualInstallationCost, setManualInstallationCost] = useState<number>(0);
```

**Initialize State from Quote Data** (in useEffect after fetching):
```typescript
setInstallationMethod(data.project.installationMethod || 'MANUAL');
setInstallationComplexity(data.project.installationComplexity || 'STANDARD');
setManualInstallationCost(data.project.manualInstallationCost || 0);
```

**Add Installation Controls Section** (before the pricing breakdown, around line 460):

```typescript
{/* Installation Configuration */}
<div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6">
  <h3 className="text-sm font-semibold text-gray-700 mb-3">Installation</h3>

  <div className="grid grid-cols-2 gap-4">
    {/* Method Selection */}
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        Calculation Method
      </label>
      <select
        value={installationMethod}
        onChange={async (e) => {
          setInstallationMethod(e.target.value);
          await updateProjectInstallation(e.target.value, installationComplexity, manualInstallationCost);
        }}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
      >
        <option value="MANUAL">Manual</option>
        <option value="PER_PRODUCT_TOTAL">Per Product Total</option>
      </select>
    </div>

    {/* Conditional: Manual Amount or Complexity */}
    {installationMethod === 'MANUAL' ? (
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Installation Cost
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
          <input
            type="number"
            value={manualInstallationCost}
            onChange={async (e) => {
              const value = parseFloat(e.target.value) || 0;
              setManualInstallationCost(value);
              await updateProjectInstallation(installationMethod, installationComplexity, value);
            }}
            step="0.01"
            min="0"
            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
            placeholder="0.00"
          />
        </div>
      </div>
    ) : (
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Complexity Level
        </label>
        <select
          value={installationComplexity}
          onChange={async (e) => {
            setInstallationComplexity(e.target.value);
            await updateProjectInstallation(installationMethod, e.target.value, manualInstallationCost);
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="SIMPLE">Simple (0.9×)</option>
          <option value="STANDARD">Standard (1.0×)</option>
          <option value="COMPLEX">Complex (1.2×)</option>
          <option value="VERY_COMPLEX">Very Complex (1.5×)</option>
        </select>
      </div>
    )}
  </div>
</div>
```

**Add Update Function**:
```typescript
const updateProjectInstallation = async (
  method: string,
  complexity: string,
  manualCost: number
) => {
  try {
    const response = await fetch(`/api/projects/${projectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        installationMethod: method,
        installationComplexity: complexity,
        manualInstallationCost: manualCost
      })
    });

    if (!response.ok) throw new Error('Failed to update installation');

    // Refresh quote data to show updated installation calculation
    await fetchQuoteData();
  } catch (error) {
    console.error('Error updating installation:', error);
    alert('Failed to update installation settings');
  }
};
```

### 7. Project Edit Modal UI - Remove Installation Field

**File**: `src/components/views/ProjectDetailView.tsx`

**Find and REMOVE** the installation cost input field (added in Phase 1):
- Search for "Installation Cost" label
- Remove the entire div containing the installation cost input
- Remove installationCost from the project interface
- Remove installationCost from save/update handlers

### 8. Data Migration

After deploying schema changes, run this to migrate existing data:

```sql
-- Copy existing installationCost to manualInstallationCost
UPDATE "Projects"
SET "manualInstallationCost" = "installationCost"
WHERE "manualInstallationCost" = 0 AND "installationCost" > 0;

-- Set method to MANUAL for all existing projects
UPDATE "Projects"
SET "installationMethod" = 'MANUAL'
WHERE "installationMethod" IS NULL OR "installationMethod" = '';
```

## Testing Steps

### 1. Database Migration
- [ ] Run `npx prisma db push` successfully
- [ ] Verify 4 new fields exist (installationPrice on Product, 3 fields on Project)
- [ ] Run data migration SQL
- [ ] Verify existing installation costs are preserved in manualInstallationCost

### 2. Product Installation Price
- [ ] Open Products view
- [ ] Edit a product (e.g., Swing Door)
- [ ] Set installation price to $150
- [ ] Save and verify it persists
- [ ] Create new product, verify installationPrice defaults to $0

### 3. Manual Installation (existing behavior)
- [ ] Open a quote
- [ ] Verify installation controls are visible in Quote View
- [ ] Select "Manual" method
- [ ] Enter $1,500
- [ ] Verify quote updates immediately
- [ ] Verify calculation: Subtotal + Installation + Tax = Total

### 4. Per Product Total Calculation
- [ ] Create project with 2 openings
  - Opening 1: Swing Door (installationPrice = $150)
  - Opening 2: Sliding Door (installationPrice = $200)
- [ ] Open quote
- [ ] Select "Per Product Total" method
- [ ] Set complexity to "Standard (1.0×)"
- [ ] Expected: Installation = $350 (150 + 200)
- [ ] Change complexity to "Complex (1.2×)"
- [ ] Expected: Installation = $420 (350 × 1.2)

### 5. Mode Switching & Value Preservation
- [ ] Set method to Manual, enter $1,000
- [ ] Switch to Per Product Total
- [ ] Verify installation recalculates from products
- [ ] Switch back to Manual
- [ ] Verify $1,000 value is restored

### 6. Edge Cases
- [ ] Project with no products: Verify Per Product Total = $0
- [ ] Products with $0 installation: Verify calculation works
- [ ] Complexity changes update quote in real-time
- [ ] Multiple panels per opening count correctly

### 7. PDF Export
- [ ] Generate PDF with Manual installation
- [ ] Generate PDF with Per Product Total installation
- [ ] Verify both display correctly (should just work, no changes needed)

## Rollback Plan

If issues occur:

1. **Database Rollback**:
   - Keep new fields, set all to defaults
   - Restore installationCost usage in quote calculation

2. **Code Rollback**:
   - Revert API routes to use installationCost
   - Revert Quote View to Phase 1 UI
   - Restore installation field in Project Edit Modal

3. **Data Recovery**:
   - installationCost field preserved (not dropped)
   - Can copy back from manualInstallationCost if needed

## Future Enhancements (Not in Phase 2)

- Show installation breakdown tooltip (which products contribute what amount)
- Installation price templates (preset packages)
- Per-customer installation rate overrides
- Installation cost history/audit log
- Bulk update product installation prices

## Notes

- Phase 1 implementation was simple: single field in Project Edit Modal
- Phase 2 moves complexity to Quote View for better visibility
- Product installation prices are optional - won't break existing workflows
- Preserving manual values prevents accidental data loss
- Conservative multiplier range (0.9-1.5×) allows reasonable adjustments

## Changes Made
(Will be updated during implementation)

## Testing Performed
(Will be updated after testing)

## Completion Checklist
- [ ] All database migrations successful
- [ ] All API routes updated and tested
- [ ] UI changes complete and functional
- [ ] Data migration verified
- [ ] All test cases pass
- [ ] PDF export still works correctly
- [ ] No regressions in Phase 1 functionality
