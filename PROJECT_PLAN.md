# Door Quoter - Project Plan

**Project Start Date:** 2025-10-02
**Last Updated:** 2025-10-02

---

## 1. Project Vision

The Door Quoter system is a comprehensive web application designed to streamline the door and hardware quoting process. The system enables users to:
- Create detailed door and hardware quotes
- Generate accurate pricing based on configurable product catalogs
- Produce professional shop drawings and technical documentation
- Manage customer information and quote history
- Track inventory and product specifications

---

## 2. Core Architecture

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

## 3. Key Features

### Phase 1: Core Quoting (Current)
- ✅ Basic quote creation
- ✅ Product selection
- ✅ Line item management
- 🟡 Pricing calculation (in progress)
- ⏳ Shop drawing generation
- ⏳ PDF export

### Phase 2: Enhanced Features (Future)
- ⏳ Advanced pricing rules
- ⏳ Inventory management
- ⏳ Multi-user support
- ⏳ Role-based permissions
- ⏳ Reporting and analytics

### Phase 3: Advanced Capabilities (Future)
- ⏳ API integrations
- ⏳ Mobile application
- ⏳ Automated ordering

---

## 4. Data Models

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

## 5. User Workflows

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

## 6. Technical Considerations

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

## 7. Development Standards

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

## 9. Future Enhancements

### Short-term (Next 3 months)
- Complete shop drawing system
- PDF generation and export
- Enhanced pricing calculations
- Improved quote management UI

### Medium-term (3-6 months)
- Multi-user support
- Advanced reporting
- Inventory tracking
- Email notifications (Resend)

### Long-term (6+ months)
- Mobile application
- Third-party integrations
- Advanced analytics
- AI-powered recommendations

---

## 10. Success Metrics

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
