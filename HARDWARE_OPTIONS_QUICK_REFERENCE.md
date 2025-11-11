# Hardware Options Quick Reference Guide

**Last Updated:** 2025-11-10  
**Branch:** dev

---

## Quick Answer: How Hardware Options Work

### The Core Concept
1. **User selects** a hardware option from a dropdown (e.g., "Chrome Handle: +$45")
2. **Selection stored** as JSON in `ComponentInstance.subOptionSelections` (e.g., `{"3": 5}`)
3. **Price calculated** by looking up the selected `IndividualOption.price` and adding it to component cost
4. **Quote displays** the hardware item with its price

---

## Database Structure (What's Stored)

```
ComponentInstance
  └─ subOptionSelections: '{"3":5,"4":8}'
     ├─ "3" = SubOptionCategory.id (e.g., "Handle Type")
     └─ 5 = IndividualOption.id (e.g., "Chrome Handle")

IndividualOption (where price lives)
  ├─ id: 5
  ├─ categoryId: 3
  ├─ name: "Chrome Handle"
  └─ price: 45.50 ◄─── THIS IS THE HARDWARE COST
```

---

## API Flow (What Happens)

### Create/Update Component with Options
```
Frontend                      → Backend
selectedOptions = {3: 5}      → PATCH /api/components/[id]
                              → JSON.stringify({3: 5})
                              → Store in DB as string
                              ← Return updated component
```

### Calculate Price (includes hardware)
```
Backend fetches
  → ComponentInstance.subOptionSelections = '{"3":5}'
  → JSON.parse('{"3":5}') = {3: 5}
  → Find IndividualOption(id=5)
  → IndividualOption.price = 45.50
  → Add 45.50 to component cost
  → Store Opening.price = base_cost + 45.50 + other_costs
```

### Display in Quote
```
Quote generator
  → Fetch ComponentInstance.subOptionSelections
  → Parse JSON and resolve option names
  → Build hardware items list
  → Display: "Handle Type: Chrome Handle | +$45.50"
  → Apply markup if PricingMode exists
  → Return final customer price
```

---

## Files You Need to Know

| When You Need To... | Look At This File | Line Numbers |
|------------------|-------------------|--------------|
| **Add hardware option cost** | `/api/openings/[id]/calculate-price` | 370-401 |
| **Display in quote** | `/api/projects/[id]/quote` | 155-187, 231-250 |
| **Show UI to select** | `ProjectDetailView.tsx` | 1579-1612 |
| **Store selection** | `component-instances/[id]/route.ts` | 34-67 |
| **Schema** | `prisma/schema.prisma` | 112-195 |

---

## The JSON Format

### How Selected Options Are Stored

```javascript
// What the user sees:
[✓] Handle Type: Chrome Handle
[✓] Lock Type: Electronic

// What gets stored in database:
subOptionSelections = '{"3": 5, "4": 12}'
```

### Parsing in Backend

```javascript
const selections = JSON.parse(componentInstance.subOptionSelections)
// selections = { "3": 5, "4": 12 }

for (const [categoryId, optionId] of Object.entries(selections)) {
  const option = await findIndividualOption(optionId)
  totalCost += option.price // Add hardware cost
}
```

---

## Pricing: Where Hardware Cost Is Added

**File:** `/src/app/api/openings/[id]/calculate-price/route.ts` (lines 370-401)

```typescript
// Parse selections
const selections = JSON.parse(component.subOptionSelections)

// For each selected option
for (const [categoryId, optionId] of Object.entries(selections)) {
  // Find the option
  const individualOption = category?.individualOptions.find(io =>
    io.id === parseInt(optionId as string)
  )
  
  // THIS IS WHERE HARDWARE COST IS ADDED
  if (individualOption && individualOption.price > 0) {
    componentBreakdown.totalOptionCost += individualOption.price
    componentCost += individualOption.price  // ◄── Goes to component total
  }
}
```

---

## UI: How Users Select Hardware Options

**File:** `ProjectDetailView.tsx` (lines 1579-1612)

```typescript
{componentOptions.map((option) => (
  <select
    value={selectedOptions[option.category.id] || ''}
    onChange={(e) => setSelectedOptions({
      ...selectedOptions,
      [option.category.id]: e.target.value ? parseInt(e.target.value) : null
    })}
  >
    <option value="">Select option...</option>
    {option.category.individualOptions?.map((indOption) => (
      <option key={indOption.id} value={indOption.id}>
        {indOption.name}
        {indOption.price > 0 && ` (+$${indOption.price})`}  // ◄── Shown here
      </option>
    ))}
  </select>
))}
```

---

## Quote Display: How Hardware Is Shown to Customer

**File:** `/api/projects/[id]/quote/route.ts` (lines 155-187, 237)

```typescript
// Extract hardware options
for (const [categoryId, optionId] of Object.entries(selections)) {
  const option = findIndividualOption(optionId)
  hardwareItems.push({
    name: `${categoryName}: ${optionName}`,
    price: option.price
  })
  totalHardwarePrice += option.price
}

// In quote item:
{
  hardware: "Handle Type: Chrome Handle | +$45.50 • Lock Type: Electronic | +$125.00",
  hardwarePrice: 170.50,  // Total of all hardware options
  ...
}
```

---

## Complete Flow Example

### Scenario: User selects "Chrome Handle" (+$45) for a door

**1. Frontend Selection** (ProjectDetailView.tsx)
```
User clicks dropdown → selects "Chrome Handle" (id: 5)
selectedOptions = { 3: 5 }
```

**2. Save to Database** (component-instances/[id]/route.ts)
```
PATCH /api/components/10
Body: { subOptionSelections: { 3: 5 } }

Database stores: ComponentInstance(id=10).subOptionSelections = '{"3":5}'
```

**3. Calculate Price** (openings/[id]/calculate-price/route.ts)
```
GET ComponentInstance(id=10).subOptionSelections = '{"3":5}'
PARSE: { 3: 5 }
FIND: IndividualOption(id=5) = { name: "Chrome Handle", price: 45.00 }
ADD: componentCost += 45.00

Opening.price = baseCost + 45.00 + taxes/markups
```

**4. Display in Quote** (projects/[id]/quote/route.ts)
```
GET ComponentInstance.subOptionSelections = '{"3":5}'
FIND: SubOptionCategory(id=3).name = "Handle Type"
FIND: IndividualOption(id=5).name = "Chrome Handle"

Quote Item:
{
  hardware: "Handle Type: Chrome Handle | +$45.00",
  hardwarePrice: 45.00,
  price: 45.00 * (1 + 20% markup) = $54.00  // With markup
}
```

---

## Testing Checklist

When you modify hardware options, verify:

- [ ] **Create**: Can create component with option selected
- [ ] **Store**: `subOptionSelections` is valid JSON in database
- [ ] **Parse**: Backend can parse the JSON without errors
- [ ] **Cost**: Option price is added to component cost
- [ ] **Quote**: Hardware item appears in quote with correct name & price
- [ ] **Markup**: If PricingMode exists, hardware markup is applied correctly
- [ ] **Update**: Can change selected option and price recalculates
- [ ] **Delete**: Can remove option selection (set to null) and cost decreases

---

## Common Modifications

### Add New Hardware Option with Price

```javascript
// Create new IndividualOption
const newOption = await prisma.individualOption.create({
  data: {
    categoryId: 3,  // Handle Type category
    name: "Brushed Nickel Handle",
    price: 55.00
  }
})

// Ensure ProductSubOption exists
const pso = await prisma.productSubOption.findUnique({
  where: { productId_categoryId: { productId: 1, categoryId: 3 } }
})
// If it doesn't exist, create it

// Now users can select it in the UI and pay the $55 extra
```

### Change Hardware Option Price

```javascript
// Update existing IndividualOption
await prisma.individualOption.update({
  where: { id: 5 },
  data: { price: 50.00 }
})

// Recalculate opening prices to reflect new cost
```

### View Hardware Costs in Quote

Already implemented! Just access:
```javascript
quoteItem.hardware  // "Handle Type: Chrome | +$45 • Lock: Elec | +$125"
quoteItem.hardwarePrice  // 170
```

---

## Debugging Tips

**Hardware option not appearing in dropdown?**
- Check `ProductSubOption` exists for [productId, categoryId]
- Check `IndividualOption` exists and is not deleted
- Check `subOptionSelections` being parsed correctly

**Hardware cost not in total?**
- Verify `IndividualOption.price > 0`
- Check price calculation runs `componentCost += option.price`
- Verify opening price was recalculated after selection

**Markup not applied?**
- Check `Project.pricingModeId` is set
- Check `PricingMode.hardwareMarkup > 0`
- Verify quote API applies markup: `calculateMarkupPrice(cost, 'Hardware', pricingMode)`

**Option showing wrong price in quote?**
- Check `IndividualOption.price` value in database
- Verify JSON parsing: `JSON.parse(subOptionSelections)`
- Check lookup finds correct option by ID

---

## Schema Reference

```prisma
// Core tables
ComponentInstance.subOptionSelections: string  // '{"3":5,...}'
IndividualOption.price: float                  // 45.50
SubOptionCategory.id: int                      // 3
ProductSubOption [productId, categoryId]       // Enables category for product
```

---

## API Response Examples

### Component Instance (with selections)
```json
{
  "id": 10,
  "panelId": 5,
  "productId": 1,
  "subOptionSelections": "{\"3\": 5, \"4\": 8}",
  "product": { ... },
  "panel": { ... }
}
```

### Quote Item (with hardware)
```json
{
  "openingId": 1,
  "name": "Opening 1",
  "hardware": "Handle Type: Chrome | +$45.50 • Lock: Electronic | +$125.00",
  "hardwarePrice": 170.50,
  "costPrice": 500.00,
  "price": 600.00,
  "costBreakdown": {
    "hardware": { "base": 170.50, "markedUp": 204.60 }
  }
}
```

---

**Last Updated:** 2025-11-10  
**Relevant Files Modified:** None (exploration only)  
**Next Steps:** Ready for modifications
