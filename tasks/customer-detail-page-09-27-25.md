# Name: Customer Detail Page
# Date: 09-27-25

## Scope
Files to modify:
- src/components/views/CustomerDetailView.tsx: Create comprehensive customer detail page
- src/components/crm/CustomerNotes.tsx: Notes management component
- src/components/crm/CustomerFiles.tsx: File upload and management component
- src/components/crm/CustomerLeads.tsx: Customer-specific leads display
- src/components/crm/CustomerProjects.tsx: Customer-specific projects display
- src/components/crm/CustomerList.tsx: Add navigation to customer detail page
- src/app/api/customers/[id]/notes/route.ts: API for customer notes
- src/app/api/customers/[id]/files/route.ts: API for file uploads
- src/stores/appStore.ts: Add customer detail state management

## Tasks
- [ ] Task 1: Create CustomerDetailView with tabbed interface for different sections
- [ ] Task 2: Create CustomerNotes component for adding/editing customer notes
- [ ] Task 3: Create CustomerFiles component for file upload and management
- [ ] Task 4: Create CustomerLeads component for viewing/managing customer leads
- [ ] Task 5: Create CustomerProjects component for creating/viewing customer projects
- [ ] Task 6: Add customer notes API endpoints
- [ ] Task 7: Add customer files API endpoints with file upload support
- [ ] Task 8: Update CustomerList to navigate to customer detail page
- [ ] Task 9: Update appStore to support customer detail view state
- [ ] Task 10: Integrate all components into a cohesive customer detail page

## Success Criteria
- Customer detail page displays comprehensive customer information
- Users can view and edit customer information inline
- Users can upload and manage files associated with customers
- Users can add, edit, and view notes for customers
- Users can view and manage leads associated with the customer
- Users can create new projects for the customer
- Navigation from customer list to detail page works seamlessly
- All data persists correctly through API endpoints