# Hardware Options System - Documentation Index

**Exploration Date:** 2025-11-10  
**Current Branch:** dev  
**Status:** Complete Analysis

---

## Documentation Files Overview

This exploration provides three complementary documents about the hardware options system:

### 1. **HARDWARE_OPTIONS_EXPLORATION.md** (Main Reference)
**Purpose:** Complete technical analysis with detailed line numbers  
**Contents:**
- Database schema models (ComponentInstance, IndividualOption, etc.)
- API endpoint specifications (request/response formats)
- Price calculation flow (step-by-step breakdown)
- Quote generation logic (how hardware displays to customers)
- Frontend UI implementation (ProjectDetailView component)
- Data flow diagrams
- Dependency maps
- Critical modification points
- File and line number summary table

**Best for:** Understanding the full system architecture

---

### 2. **HARDWARE_OPTIONS_ARCHITECTURE.txt** (Visual Reference)
**Purpose:** Visual diagrams and data transformation pipeline  
**Contents:**
- ASCII architecture diagrams
- Database layer structure
- API endpoints flow
- Frontend UI layer
- Pricing calculation flow
- Data transformation pipeline (5 steps)
- Modification checklist
- Critical lookups reference

**Best for:** Quick visual understanding of data flow

---

### 3. **HARDWARE_OPTIONS_QUICK_REFERENCE.md** (Developer Guide)
**Purpose:** Quick lookup guide with examples and testing  
**Contents:**
- Core concept explanation
- Database structure (what's stored)
- API flow (what happens)
- JSON format examples
- Complete flow example scenario
- Testing checklist
- Common modifications with code examples
- Debugging tips
- Schema reference
- API response examples

**Best for:** Quick lookups, implementation guidance

---

## Quick Navigation

### I Need To...

**Understand how hardware options work**
→ Read: **HARDWARE_OPTIONS_QUICK_REFERENCE.md** (Core Concept section)

**Modify hardware pricing in the database**
→ Reference: **HARDWARE_OPTIONS_QUICK_REFERENCE.md** (Common Modifications)

**Add a new hardware option category**
→ Reference: **HARDWARE_OPTIONS_EXPLORATION.md** (Section 1: Database Schema)

**Find where costs are calculated**
→ Go To: **HARDWARE_OPTIONS_EXPLORATION.md** (Section 3) or  
**HARDWARE_OPTIONS_QUICK_REFERENCE.md** (Pricing section)

**Find where hardware displays in quotes**
→ Go To: **HARDWARE_OPTIONS_EXPLORATION.md** (Section 4) or  
**HARDWARE_OPTIONS_QUICK_REFERENCE.md** (Quote Display)

**Understand the UI selection flow**
→ Reference: **HARDWARE_OPTIONS_EXPLORATION.md** (Section 5) or  
**HARDWARE_OPTIONS_QUICK_REFERENCE.md** (UI section)

**Debug hardware option issues**
→ Go To: **HARDWARE_OPTIONS_QUICK_REFERENCE.md** (Debugging Tips)

**See data transformation visually**
→ Read: **HARDWARE_OPTIONS_ARCHITECTURE.txt** (Data Transformation Pipeline)

**Get complete file references with line numbers**
→ Reference: **HARDWARE_OPTIONS_EXPLORATION.md** (Section 12: Summary Table)

---

## Key Takeaways

### The Core System
Hardware options are managed through a simple concept:
1. User selects option from dropdown
2. Selection stored as JSON: `{"categoryId": optionId}`
3. During pricing, the option's cost is added to component total
4. Quote displays hardware with cost and applies markup if configured

### Critical Files
- **Database:** `/prisma/schema.prisma` (lines 112-195)
- **Price Calc:** `/src/app/api/openings/[id]/calculate-price/route.ts` (lines 370-401)
- **Quote Display:** `/src/app/api/projects/[id]/quote/route.ts` (lines 155-187, 231-250)
- **UI Selection:** `/src/components/views/ProjectDetailView.tsx` (lines 1579-1612)

### Important Models
```
ComponentInstance.subOptionSelections = '{"3": 5}'
  └─ Stores selected options as JSON string
  
IndividualOption.price = 45.50
  └─ Where the hardware cost is stored
  
SubOptionCategory
  └─ Groups options (e.g., "Handle Type", "Lock Type")
  
ProductSubOption
  └─ Links products to available categories
```

---

## Documentation Structure

Each document covers different aspects:

| Aspect | Exploration | Architecture | Quick Ref |
|--------|-------------|--------------|-----------|
| **Concepts** | Deep | Visual | Basic |
| **Line Numbers** | Yes (detailed) | Minimal | Summary |
| **Code Examples** | Full context | Pseudocode | Short snippets |
| **Diagrams** | Text-based | ASCII visual | None |
| **Examples** | Embedded | Flow diagrams | Complete scenarios |
| **Debugging** | Not covered | Not covered | Yes |
| **Testing** | Not covered | Not covered | Yes |
| **Modifications** | Mentioned | Checkmarks | Code examples |

---

## For Specific Tasks

### Modifying Hardware Costs
1. Read **Quick Reference** - "Add New Hardware Option" section
2. Reference **Exploration** - "Section 3: Pricing Calculation System"
3. Check line 129 in `/prisma/schema.prisma` for the price field

### Creating New Hardware Categories
1. Check **Architecture** - "Database Layer" section
2. Reference **Exploration** - "Section 1: Database Schema"
3. Look at SubOptionCategory model (lines 112-122)

### Implementing New Features
1. Understand current flow - **Architecture** document
2. Find relevant code - **Exploration** document with line numbers
3. Test using checklist - **Quick Reference** document

### Fixing Issues
1. Identify problem type
2. Go to **Quick Reference** - "Debugging Tips" section
3. Reference specific files from **Exploration** summary table

---

## The Flow at a Glance

```
User Selection (Frontend)
  ↓
Store as JSON (Database)
  ↓
Parse & Lookup Cost (API)
  ↓
Add to Total (Pricing)
  ↓
Display in Quote (Quote API)
  ↓
Apply Markup (Category-Specific)
  ↓
Show to Customer (Quote View)
```

---

## File Statistics

| Document | Size | Lines | Sections |
|----------|------|-------|----------|
| HARDWARE_OPTIONS_EXPLORATION.md | 12K | 350+ | 12 sections + tables |
| HARDWARE_OPTIONS_ARCHITECTURE.txt | 8.3K | 300+ | 8 sections with ASCII |
| HARDWARE_OPTIONS_QUICK_REFERENCE.md | 9.3K | 280+ | 12 sections + examples |

**Total Coverage:** 29.3K of documentation across 3 complementary documents

---

## Implementation Checklist

Before implementing changes to hardware options, ensure you have:

- [ ] Read appropriate section(s) of documentation
- [ ] Located relevant files and line numbers
- [ ] Understood current data flow
- [ ] Identified modification points
- [ ] Created test cases from Testing Checklist
- [ ] Updated relevant code
- [ ] Verified pricing calculations
- [ ] Tested quote generation
- [ ] Checked UI display

---

## Key Concepts Covered

### Database
- ComponentInstance storage format
- IndividualOption pricing structure
- ProductSubOption relationships
- SubOptionCategory grouping
- JSON serialization

### API
- Create/Read/Update operations
- JSON stringify/parse handling
- Price calculation logic
- Quote generation with hardware
- Category-specific markup application

### Frontend
- Component selection UI
- Modal dropdown display
- Option price display
- Selection state management
- API communication

### Pricing
- Hardware cost addition
- Category-specific markups
- Quote price calculation
- Cost breakdown by type
- Markup application hierarchy

---

## Glossary of Terms

**ComponentInstance**
- Database record linking a Panel to a Product with selected options
- Contains `subOptionSelections` JSON

**IndividualOption**
- Specific hardware option (e.g., "Chrome Handle")
- Has a `price` field

**SubOptionCategory**
- Group of related options (e.g., "Handle Type")
- Contains multiple IndividualOptions

**ProductSubOption**
- Junction table linking Product to available categories
- Enables certain categories for specific products

**subOptionSelections**
- JSON string storing selected options: `{"categoryId": optionId}`
- Stored in ComponentInstance

**hardwarePrice**
- Sum of all selected hardware option prices
- Displayed separately in quotes

**hardwareMarkup**
- Percentage markup applied specifically to hardware costs
- Can differ from extrusion/glass markups

---

## Related Documentation

This exploration focuses specifically on:
- Hardware options and their pricing
- Component instance management
- Quote display with hardware

Related systems not covered in detail:
- Glass pricing (separate system in same pricing file)
- Extrusion stock length rules
- BOM management
- PricingMode configuration
- Installation cost calculation

For those topics, refer to the relevant sections in HARDWARE_OPTIONS_EXPLORATION.md under "Dependencies" and "Related Models".

---

## Questions Answered By This Documentation

**Q: Where are hardware option costs stored?**  
A: `IndividualOption.price` in the database, referenced by `ComponentInstance.subOptionSelections` JSON

**Q: How is hardware cost added to the opening price?**  
A: In `/api/openings/[id]/calculate-price` endpoint (lines 370-401)

**Q: How are hardware options displayed to customers?**  
A: In `/api/projects/[id]/quote` endpoint, extracted from `subOptionSelections` and formatted

**Q: How do I change a hardware option price?**  
A: Update `IndividualOption.price` in the database; pricing automatically includes new value

**Q: How do hardware markups work?**  
A: If `PricingMode.hardwareMarkup` is set, it's applied separately to hardware costs in quote generation

**Q: Can I see a complete example?**  
A: Yes, see **HARDWARE_OPTIONS_QUICK_REFERENCE.md** - "Complete Flow Example" section

---

## Summary

This documentation provides everything needed to understand, debug, and modify the hardware options system in Door Quoter. Start with the Quick Reference for quick answers, use Architecture for visual understanding, and consult Exploration for detailed technical information.

All documentation includes:
- Specific file paths
- Line number references
- Code examples
- Data structure details
- API specifications
- Testing guidance

**Ready to implement changes!**

---

**Created:** 2025-11-10  
**Status:** Complete Exploration  
**Next Steps:** Ready for implementation or modifications
