# Door Quoter - Project Plan

**Project Start Date:** 2025-10-02
**Last Updated:** 2025-10-13

---

## 1. Planned Features (To Be Implemented)

### ✅ Accounting & Pricing Rules (COMPLETED 2025-10-13)

- **✅ New "Accounting" Menu Tab**
  - Added "Accounting" to main navigation sidebar
  - Dedicated section for financial management
  - Houses pricing modes and links to pricing rules
  - **Implementation:** src/components/Sidebar.tsx, src/components/Dashboard.tsx, src/components/views/AccountingView.tsx

- **✅ Pricing Mode Dropdown for Projects**
  - Dropdown added to project create/edit forms
  - Auto-selects default pricing mode for new projects
  - Shows mode details (markup/discount percentages)
  - Saved with project in database
  - **Implementation:** src/components/views/ProjectsView.tsx, src/types/index.ts

- **✅ Pricing Modes Management**
  - Create, edit, delete pricing modes with CRUD interface
  - Configure markup and discount percentages per mode
  - Set default pricing mode for new projects
  - **Database:** PricingMode model with name, description, markup, discount, isDefault fields
  - **API Routes:** /api/pricing-modes (GET, POST), /api/pricing-modes/[id] (GET, PUT, DELETE)
  - **Implementation:** src/components/accounting/PricingModesTab.tsx

- **✅ Pricing Rules Management**
  - Informational tab linking to existing Master Parts pricing rules
  - Future enhancement: consolidated pricing rules view
  - **Implementation:** src/components/accounting/PricingRulesTab.tsx

### Extrusion Cut Length Units
- **Convert Cut Length Calculations to Millimeters**
  - Update formulas to calculate extrusion cut lengths in mm instead of inches
  - Display cut lengths in BOM using mm units
  - Master parts extrusion lengths remain in inches (no change to master data)
  - Conversion: 1 inch = 25.4 mm
  - Update all relevant calculation logic and display components

### Cost and Pricing Display in Project View
- **Show Component Cost, Sale Price, and Profit Margin**
  - Display cost and sale price for each component in opening view
  - Format: "Component Name COST / SALE (Profit Margin %)"
  - Example: "Fixed Panel $125.00 / $187.50 (50%)"
  - Apply to all components: Fixed Panels, Doors, Transoms, etc.
  - Real-time calculation and display of profit margins
  - Helps users understand pricing breakdown at component level

### Duplicate/Copy Opening Feature
- **Copy Openings with Rename Capability**
  - Add "Copy" or "Duplicate" action for existing openings
  - Copies all opening configuration: components, dimensions, hardware, etc.
  - Prompt user to rename the copied opening
  - Maintains all pricing and configuration from original
  - Speeds up workflow when creating similar openings
  - Helpful for repetitive opening types in large projects

### Shipping and Logistics Management
- **Shipping Price Calculation API**
  - Calculate shipping costs based on distance, weight, and configuration
  - Integration with shipping calculation API
  - Real-time shipping cost estimates for projects

- **New "Logistics" Menu Tab**
  - Add "Logistics" to main navigation sidebar
  - Dedicated section for shipping and delivery management

- **Logistics Configuration Interface**
  - Edit cost per mile rates
  - Manage truck/vehicle configurations
  - Set base shipping rates and surcharges
  - Configure delivery zones and rates
  - Weight-based pricing tiers
  - Fuel surcharge adjustments
  - Minimum shipping charges
  - Apply calculated shipping to project quotes

### Hardware Placement on Shop Drawings
- **Add Hardware SVG Overlay System**
  - Define placement points on door elevation SVG
  - Overlay handle/hardware SVGs at specified points
  - Hardware SVGs maintain original size (no scaling)
  - Independent positioning from door dimensions
  - Support multiple hardware placement points per door
  - Visual representation of hardware placement in shop drawings
  - Configurable anchor points for different hardware types

### Project Phase Management with Due Dates
- **Multiple Phase Due Dates**
  - Set different due dates for project phases:
    - Quote due date
    - Shop drawings due date
    - Ordering due date
    - Additional custom phases as needed
  - Configure due dates during project creation
  - Track and display phase completion status
  - Alert/notification system for approaching due dates
  - Visual timeline or gantt-style view of phases

- **CRM-Integrated Project Creation**
  - Remove standalone project creation
  - Projects can only be created within CRM module
  - Projects must be associated with a customer
  - Project creation workflow starts from customer detail page
  - Ensures all projects are properly linked to customers
  - Improves data organization and customer relationship tracking

### Installation Cost Management
- **Manual Installation Cost Entry in Quotes**
  - Add installation cost field when creating/editing quotes
  - Manual entry for now (can be automated in future)
  - Include installation cost in quote totals
  - Display installation cost separately in quote breakdown
  - Option to show/hide installation cost from customer-facing quotes
  - Store installation cost history per project
  - Support for notes/description for installation charges

### UI Reorganization - Categories
- **Move Categories Tab to Master Parts View**
  - Remove categories tab from Products view
  - Add categories tab to Master Parts List view
  - Categories management should be alongside master parts
  - Maintain all existing category functionality
  - Improve organization and logical grouping of related features

### Additional Features
(More features to be added)


---


## Project Vision

The Door Quoter system is a comprehensive web application designed to streamline the door and hardware quoting process. The system enables users to:
- Create detailed door and hardware quotes
- Generate accurate pricing based on configurable product catalogs
- Produce professional shop drawings and technical documentation
- Manage customer information and quote history
- Track inventory and product specifications

---

## Core Architecture

### Technology Stack
- **Frontend:** Next.js 14+ (React, TypeScript)
- **Backend:** Next.js API Routes
- **Database:** PostgreSQL (Cloud SQL)
- **ORM:** Prisma
- **Authentication:** NextAuth.js
- **Styling:** Tailwind CSS
- **Drawing Generation:** Parametric SVG system
- **Deployment:** Google Cloud Run

### System Components
1. **Quote Management System**
   - Quote creation and editing
   - Line item management
   - Pricing calculation engine
   - Quote versioning

2. **Product Catalog System**
   - Door types and specifications
   - Hardware catalog
   - Pricing matrices
   - Product configurations

3. **Shop Drawing System**
   - Parametric SVG generation
   - Elevation and plan views
   - Automatic scaling and formatting
   - Multi-page document generation

4. **Customer Management**
   - Customer database
   - Contact information
   - Quote history
   - Project tracking

---

## Data Models

### Core Entities
- **Quote:** Main quote document
- **QuoteLineItem:** Individual line items in a quote
- **Door:** Door specifications and configurations
- **Hardware:** Hardware products and pricing
- **Customer:** Customer information
- **Project:** Project/job details
- **User:** System users and authentication

### Relationships
- Quote → QuoteLineItems (one-to-many)
- Quote → Customer (many-to-one)
- Quote → Project (many-to-one)
- QuoteLineItem → Door (many-to-one)
- QuoteLineItem → Hardware[] (many-to-many)

---

## User Workflows

### Creating a Quote
1. User creates new quote
2. Adds customer information
3. Adds door line items with specifications
4. Selects hardware for each door
5. System calculates pricing
6. User reviews and adjusts
7. Generate shop drawings
8. Export to PDF
9. Send to customer

### Managing Products
1. Admin accesses product catalog
2. Add/edit door types
3. Configure hardware items
4. Set pricing rules
5. Update inventory levels

---

## Technical Considerations

### Performance
- Efficient database queries with Prisma
- Server-side rendering for initial load
- Client-side caching for better UX
- Optimized SVG generation

### Security
- Secure authentication with NextAuth
- Role-based access control
- Input validation and sanitization
- SQL injection prevention via Prisma

### Scalability
- Cloud-based infrastructure (Google Cloud)
- Containerized deployment (Cloud Run)
- Database connection pooling
- CDN for static assets

---

## Development Standards

### Code Quality
- TypeScript for type safety
- ESLint for code consistency
- Prettier for formatting
- Component-based architecture

### Testing Strategy
- Unit tests for business logic
- Integration tests for API routes
- E2E tests for critical workflows
- Manual testing for UI/UX

### Documentation
- Code comments for complex logic
- API documentation
- User guides
- Development guides (this document + CLAUDE.md)

---

## 8. Deployment Strategy

### Environments
- **Development:** Local environment
- **Staging:** Cloud Run staging
- **Production:** Cloud Run production

### Database Migrations
- Prisma migrations for schema changes
- Migration testing before production
- Backup strategy for production data

---



## Success Metrics

### User Metrics
- Quote creation time (target: <10 minutes)
- User satisfaction score (target: >4.5/5)
- System adoption rate

### Technical Metrics
- Page load time (target: <2 seconds)
- API response time (target: <500ms)
- System uptime (target: >99.5%)
- Error rate (target: <1%)

### Business Metrics
- Quotes generated per month
- Conversion rate (quotes to orders)
- Time saved vs manual process
- ROI analysis

---

## Notes

- This is a living document and should be updated as the project evolves
- See PROJECT_PLAN_STATUS.md for current implementation status
- See CLAUDE.md for development workflow and constraints
- All dates use ISO 8601 format (YYYY-MM-DD)
