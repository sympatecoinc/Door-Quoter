# Name: fix-conversion-rate
# Date: 09-27-25

## Scope
Files to modify:
- /home/kyle/projects/Door-Quoter/src/components/views/CRMView.tsx: Replace hardcoded conversion rate with actual calculation based on won leads

## Tasks
- [ ] Task 1: Add API call to fetch leads with their stages for conversion calculation
- [ ] Task 2: Calculate conversion rate as (won leads / total leads) * 100
- [ ] Task 3: Handle edge case when total leads is 0 to avoid division by zero

## Success Criteria
- Conversion rate displays actual percentage based on leads with "Won" stage
- No division by zero errors when no leads exist
- Rate updates when leads are added/modified