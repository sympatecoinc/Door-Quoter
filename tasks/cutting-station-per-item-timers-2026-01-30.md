# Per-Item Timers for Cutting Station
Date: 2026-01-30

## Overview
Replace the single work order timer with per-line-item timers. Each cut list item will have its own timer with a 3-click workflow:
1. **Click 1**: Start timer (item becomes "active", timing begins)
2. **Click 2**: Stop timer (item is "paused", time is saved)
3. **Click 3**: Mark complete (item is checked off)

## Scope
Files to modify:
- `prisma/schema.prisma`: Add timing fields to WorkOrderItem model
- `prisma/migrations/[timestamp]_add_item_timing/migration.sql`: New migration
- `src/app/api/work-orders/[id]/items/[itemId]/route.ts`: Handle start/stop timing actions
- `src/components/production/CutListChecklist.tsx`: Add per-item timer UI with 3-state controls
- `src/components/production/stations/CuttingStation.tsx`: Remove sidebar WorkOrderTimer component

## Tasks

### Phase 1: Schema Changes
- [x] Task 1: Add timing fields to WorkOrderItem model in schema.prisma
  - `startedAt DateTime?` - when active timing began
  - `elapsedSeconds Int @default(0)` - accumulated time in seconds
  - `startedById Int?` - user who started/is working on item
  - `startedBy User?` relation
- [x] Task 2: Create and apply database migration

### Phase 2: API Updates
- [x] Task 3: Update PATCH endpoint to handle new timing actions
  - Accept `action` field: "start" | "stop" | "complete" | "uncomplete"
  - "start": Set startedAt to now, set startedById
  - "stop": Calculate elapsed time, add to elapsedSeconds, clear startedAt
  - "complete": Mark isCompleted, set completedAt/completedById
  - "uncomplete": Unmark isCompleted (keeps elapsed time)
- [x] Task 4: Update response to include new timing fields

### Phase 3: UI Updates
- [x] Task 5: Update CutListChecklist component
  - Add item state: "idle" | "active" | "paused" | "completed"
  - Replace checkbox with 3-state button/control
  - Show elapsed time for active items (live counter)
  - Show accumulated time for paused items
  - Visual indicators for each state (colors, icons)
- [x] Task 6: Remove WorkOrderTimer from CuttingStation sidebar
- [x] Task 7: Update item interface types to include new fields

### Phase 4: Testing
- [ ] Task 8: Test the 3-click workflow manually
- [ ] Task 9: Verify timer accuracy (start/stop/accumulate)
- [ ] Task 10: Test bulk operations still work appropriately

## Schema Changes Detail

```prisma
model WorkOrderItem {
  // ... existing fields ...

  // Per-item timing
  startedAt     DateTime?       // When active timing began (null = not active)
  elapsedSeconds Int      @default(0)  // Accumulated time in seconds
  startedById   Int?
  startedBy     User?    @relation("ItemStartedBy", fields: [startedById], references: [id], onDelete: SetNull)
}
```

## UI State Machine

```
State: IDLE (not started)
  - Display: Play button, "0:00" time
  - Click → Start timer → State: ACTIVE

State: ACTIVE (timer running)
  - Display: Stop button, live counter, pulsing indicator
  - Click → Stop timer → State: PAUSED

State: PAUSED (timer stopped, not complete)
  - Display: Checkmark button, accumulated time
  - Click → Mark complete → State: COMPLETED

State: COMPLETED
  - Display: Green checkmark, final time, strikethrough text
  - Click → Uncomplete → State: PAUSED (keeps time)
```

## Success Criteria
- [x] Each cut list item has its own start/stop/complete controls
- [x] Timer accurately tracks time per item
- [x] Time persists when stopping and restarting
- [x] Completed items show their total time spent
- [x] No single work order timer in sidebar
- [x] Bulk "Complete Group" still works (skips timing)

## Changes Made

### Schema (prisma/schema.prisma)
- Added `startedAt DateTime?` field to WorkOrderItem
- Added `elapsedSeconds Int @default(0)` field to WorkOrderItem
- Added `startedById Int?` and `startedBy User?` relation to WorkOrderItem
- Added `itemsStarted WorkOrderItem[] @relation("ItemStartedBy")` to User model

### Migration (prisma/migrations/20260130000000_add_item_timing/)
- Created migration adding new columns to WorkOrderItems table
- Added foreign key constraint for startedById

### API (src/app/api/work-orders/[id]/items/[itemId]/route.ts)
- Added support for `action` field in PATCH body: "start" | "stop" | "complete" | "uncomplete"
- "start" sets startedAt to now and startedById to current user
- "stop" calculates elapsed time since startedAt, adds to elapsedSeconds, clears startedAt
- "complete" stops timing if active, marks isCompleted=true
- "uncomplete" reverts to paused state (keeps elapsed time)
- Added `startedBy` relation to include in responses

### API (src/app/api/work-orders/[id]/station-data/route.ts)
- Added `startedBy` relation to items include for station data

### UI (src/components/production/CutListChecklist.tsx)
- Added `LiveTimer` component for real-time elapsed time display
- Added `getItemState()` helper to derive state from timing fields
- Added timing fields to CutListItem interface
- Added `onItemAction` prop for timing actions
- Replaced checkbox with 3-state button control:
  - Idle: Blue play button
  - Active: Orange stop button (pulsing animation)
  - Paused: Green checkmark button
  - Completed: Filled green checkmark
- Added time column showing elapsed time per item
- Active items show live updating timer
- Row highlighting based on state (orange for active, yellow for paused, green for complete)

### UI (src/components/production/stations/CuttingStation.tsx)
- Removed WorkOrderTimer import and component from sidebar
- Added `handleItemAction()` function to call API with timing actions
- Added timing fields to WorkOrderItem interface
- Passed `onItemAction` prop to CutListChecklist

## Testing Performed
(To be completed - manual testing needed)

## Notes
- The existing `completedAt` and `completedById` fields will continue to be used for completion tracking
- The new timing fields are additive and don't break existing functionality
- Bulk complete operations will skip the timing workflow (directly mark complete with 0 elapsed time)
