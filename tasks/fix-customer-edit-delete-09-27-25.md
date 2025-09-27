# Name: Fix Customer Edit and Delete Functionality
# Date: 09-27-25

## Scope
Files to modify:
- src/components/crm/CustomerList.tsx: Add edit/delete handlers and state management
- src/components/crm/CustomerForm.tsx: Update to support editing existing customers
- src/components/views/CRMView.tsx: Add edit mode support and refresh mechanisms

## Tasks
- [ ] Task 1: Add edit customer functionality to CustomerList with proper state management
- [ ] Task 2: Add delete customer functionality to CustomerList with confirmation dialog
- [ ] Task 3: Update CustomerForm to support both create and edit modes
- [ ] Task 4: Update CRMView to handle edit mode and customer data passing
- [ ] Task 5: Test the edit and delete functionality

## Success Criteria
- Edit button opens form pre-populated with customer data
- Edit form successfully updates customer via PUT request
- Delete button shows confirmation dialog before deletion
- Delete successfully removes customer via DELETE request
- Customer list refreshes after edit/delete operations
- All operations show appropriate loading/error states