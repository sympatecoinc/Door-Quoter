# Hardware Options and Component Instances - Complete System Overview

**Date:** 2025-11-10  
**Current Branch:** dev

## Executive Summary

This document provides a comprehensive analysis of how hardware options and component instances work throughout the Door Quoter application, including database schema, API endpoints, pricing calculations, and UI components.

---

## 1. DATABASE SCHEMA

### ComponentInstance Model
**File:** `/home/kyle/projects/Door-Quoter/prisma/schema.prisma` (lines 184-195)

```prisma
model ComponentInstance {
  id                  Int      @id @default(autoincrement())
  panelId             Int      @unique
  productId           Int
  subOptionSelections String   // JSON string of hardware option selections
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  product             Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  panel               Panel    @relation(fields: [panelId], references: [id], onDelete: Cascade)
  
  @@map("ComponentInstances")
}
```

**Key Points:**
- `subOptionSelections` is stored as a JSON string (e.g., `{"3": 5, "4": 8}`)
  - Key: `SubOptionCategory.id` 
  - Value: `IndividualOption.id`
- One-to-one relationship with `Panel` (unique constraint on `panelId`)
- Relationship to `Product` defines which product is used

### Related Models - SubOption Structure
**File:** `/home/kyle/projects/Door-Quoter/prisma/schema.prisma`

**ProductSubOption** (lines 137-148):
- Links products to available option categories
- Unique constraint: `[productId, categoryId]`
- Defines which categories are available for a specific product

**SubOptionCategory** (lines 112-122):
- Groups hardware options (e.g., "Handle Type", "Lock Type", "Hinge Style")
- Contains `IndividualOption[]` (the actual hardware options)

**IndividualOption** (lines 124-135):
- Individual hardware options (e.g., "Chrome Handle", "Black Handle")
- **Critical:** Has a `price` field (float)
- Each option can have an associated cost

---

## 2. API ENDPOINTS - COMPONENT INSTANCE MANAGEMENT

### Create Component Instance
**File:** `/home/kyle/projects/Door-Quoter/src/app/api/component-instances/route.ts`

**Endpoint:** `POST /api/component-instances`

**Request Body:**
```typescript
{
  panelId: number,
  productId: number,
  subOptionSelections?: {
    [categoryId: number]: optionId | null
  }
}
```

**Key Logic (lines 32-102):**
- Validates panel and product existence
- Prevents duplicate component instances (unique per panel)
- Stores `subOptionSelections` as JSON string via `JSON.stringify()`
- Returns full instance with included product and panel data

### Update Component Instance
**File:** `/home/kyle/projects/Door-Quoter/src/app/api/component-instances/[id]/route.ts`

**Endpoint:** `PUT /api/component-instances/[id]`

**Request Body:**
```typescript
{
  productId?: number,
  subOptionSelections?: {
    [categoryId: number]: optionId | null
  }
}
```

**Key Logic (lines 34-67):**
- Allows updating product, options, or both
- Converts `subOptionSelections` to JSON string
- Returns updated instance with related data

### Get Component Instance
**Endpoint:** `GET /api/component-instances/[id]`

**Logic (lines 4-32):**
- Fetches single instance with product and panel relationships

---

## 3. PRICING CALCULATION SYSTEM

### Price Calculation Endpoint
**File:** `/home/kyle/projects/Door-Quoter/src/app/api/openings/[id]/calculate-price/route.ts`

**Endpoint:** `POST /api/openings/[id]/calculate-price`

**Overall Flow (lines 276-503):**

1. **Fetch Opening with All Components**
   - Includes all panels, component instances, products with BOMs and sub-options
   - Gets project settings (extrusion costing method, excluded parts)

2. **Calculate Component Costs**

   For each panel with a component instance:

   a. **BOM Costs** (lines 355-368)
   - Calls `calculateBOMItemPrice()` for each BOM item
   - Accounts for extrusions, hardware, and other parts

   b. **Hardware Option Costs** (lines 370-401)
   - Parses `subOptionSelections` JSON (line 373)
   - Loops through selected options
   - Finds matching `IndividualOption` by ID
   - **Adds price directly to component cost** (line 395)
   
   ```typescript
   if (individualOption && individualOption.price > 0) {
     componentBreakdown.optionCosts.push({
       categoryName: category?.name || '',
       optionName: individualOption.name,
       price: individualOption.price
     })
     componentBreakdown.totalOptionCost += individualOption.price
     componentCost += individualOption.price
   }
   ```

   c. **Glass Costs** (lines 403-474)
   - Calculates glass area based on panel dimensions
   - Uses product glass formulas (width, height, quantity)
   - Multiplies by `GlassType.pricePerSqFt`

3. **Cost Breakdown Structure** (lines 341-353)
   ```typescript
   {
     productName: string,
     panelId: number,
     width: number,
     height: number,
     bomCosts: [],        // Line items for each BOM
     optionCosts: [],     // Line items for hardware options
     glassCost: object,   // Glass pricing details
     totalBOMCost: number,
     totalOptionCost: number,
     totalGlassCost: number,
     totalComponentCost: number
   }
   ```

4. **Database Update**
   - Updates `Opening.price` and `Opening.priceCalculatedAt`

---

## 4. PRICING DISPLAY IN QUOTES

### Quote Generation API
**File:** `/home/kyle/projects/Door-Quoter/src/app/api/projects/[id]/quote/route.ts`

**Endpoint:** `GET /api/projects/[id]/quote`

**Hardware Options in Quote** (lines 155-187):

```typescript
// Extract hardware from component options
if (panel.componentInstance?.subOptionSelections) {
  try {
    const selections = JSON.parse(panel.componentInstance.subOptionSelections)
    
    for (const [categoryId, optionId] of Object.entries(selections)) {
      if (optionId) {
        // Find the individual option
        const category = product.productSubOptions.find(pso =>
          pso.category.id === parseInt(categoryId)
        )?.category
        
        const individualOption = category?.individualOptions.find(io =>
          io.id === parseInt(optionId as string)
        )
        
        if (individualOption && individualOption.price > 0) {
          hardwareItems.push({
            name: `${pso.category.name}: ${option.name}`,
            price: option.price || 0
          })
          totalHardwarePrice += option.price || 0
          hardwareCost += option.price || 0
        }
      }
    }
  } catch (error) {
    console.error('Error parsing hardware options:', error)
  }
}
```

**Quote Item Structure** (lines 231-250):
```typescript
{
  openingId: number,
  name: string,
  description: string,
  dimensions: string,
  color: string,
  hardware: string,        // Formatted hardware list with prices
  hardwarePrice: number,   // Sum of hardware option prices
  glassType: string,
  costPrice: number,       // Base cost (before markup)
  price: number,           // Final price (after markup)
  elevationImages: string[],
  costBreakdown: {         // Detailed breakdown by type
    extrusion: { base: number, markedUp: number },
    hardware: { base: number, markedUp: number },
    glass: { base: number, markedUp: number },
    other: { base: number, markedUp: number }
  }
}
```

---

## 5. FRONTEND COMPONENT SELECTION UI

### ProjectDetailView Component
**File:** `/home/kyle/projects/Door-Quoter/src/components/views/ProjectDetailView.tsx`

#### Hardware Options Display
**Location:** Lines 1119-1170 (component list view)

Shows selected hardware options for each component with format: "Category Name: Option Name"

#### Component Edit Modal
**Location:** Lines 1538-1710

**Features:**
1. **Edit Dimensions** (lines 1544-1577)
   - Width and height inputs
   - Step increment: 0.125 inches

2. **Edit Hardware Options** (lines 1579-1612)
   - Dynamic select dropdowns per category
   - Shows option name with price (if > 0)
   - Tracks selected values in `selectedOptions` state

   **Example Select Option:**
   ```typescript
   <select
     value={selectedOptions[option.category.id] || ''}
     onChange={(e) => setSelectedOptions({
       ...selectedOptions,
       [option.category.id]: e.target.value ? parseInt(e.target.value) : null
     })}
   >
     <option value="">Select option...</option>
     {option.category.individualOptions?.map((individualOption: any) => (
       <option key={individualOption.id} value={individualOption.id}>
         {individualOption.name}
         {individualOption.price > 0 && ` (+$${individualOption.price})`}
       </option>
     ))}
   </select>
   ```

3. **Save Changes** (lines 1627-1710)
   - Updates panel dimensions via `PATCH /api/panels/[id]`
   - Updates component via `PATCH /api/components/[id]` with `subOptionSelections`
   - Triggers price recalculation for the affected opening
   - Shows success/error toast

#### Component Options Fetching
**Location:** Lines 651-678

**Flow:**
1. Fetch component instance: `GET /api/component-instances/[id]`
2. Fetch product with options: `GET /api/products/[id]`
3. Parse current selections: `JSON.parse(componentData.subOptionSelections || '{}')`
4. Display available options from `productSubOptions[].category.individualOptions`

---

## 6. DATA FLOW DIAGRAM

```
User selects hardware option in ProjectDetailView
         ↓
Component Edit Modal displays options from Product.productSubOptions
         ↓
User saves selection → selectedOptions = { categoryId: optionId, ... }
         ↓
PATCH /api/components/[id] with subOptionSelections (JSON.stringify)
         ↓
ComponentInstance.subOptionSelections = JSON string
         ↓
POST /api/openings/[id]/calculate-price
         ↓
Parse subOptionSelections → for each categoryId/optionId pair
         ↓
Find IndividualOption by ID
         ↓
Add IndividualOption.price to component cost
         ↓
Store updated Opening.price in database
         ↓
GET /api/projects/[id]/quote displays:
    - Hardware items with prices
    - Total hardware cost
    - Cost breakdown (hardware marked up separately if PricingMode exists)
    - Final customer price
```

---

## 7. KEY DATA STRUCTURES

### Selected Options Format
```typescript
// Stored in ComponentInstance.subOptionSelections
const subOptionSelections = {
  "3": 5,    // categoryId "3" → selected optionId 5
  "4": 8,    // categoryId "4" → selected optionId 8
  "7": null  // categoryId "7" → no selection
}

// Stored as JSON string:
ComponentInstance.subOptionSelections = '{"3":5,"4":8,"7":null}'
```

---

## Files and Line Numbers Summary

**Critical Files for Hardware Options:**

1. `/home/kyle/projects/Door-Quoter/prisma/schema.prisma`
   - ComponentInstance: Lines 184-195
   - IndividualOption (pricing): Lines 124-135
   - ProductSubOption: Lines 137-148
   - SubOptionCategory: Lines 112-122

2. `/home/kyle/projects/Door-Quoter/src/app/api/component-instances/route.ts`
   - POST handler: Lines 32-102

3. `/home/kyle/projects/Door-Quoter/src/app/api/component-instances/[id]/route.ts`
   - PUT handler: Lines 34-67

4. `/home/kyle/projects/Door-Quoter/src/app/api/openings/[id]/calculate-price/route.ts`
   - Option cost calculation: Lines 370-401

5. `/home/kyle/projects/Door-Quoter/src/app/api/projects/[id]/quote/route.ts`
   - Hardware option extraction: Lines 155-187
   - Quote item creation: Lines 231-250

6. `/home/kyle/projects/Door-Quoter/src/components/views/ProjectDetailView.tsx`
   - Hardware display in list: Lines 1119-1170
   - Component edit modal: Lines 1538-1710
   - Options fetching: Lines 651-678

7. `/home/kyle/projects/Door-Quoter/src/lib/pricing.ts`
   - Markup calculation: Full file (96 lines)
