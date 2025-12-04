# Coordinator Exemption from Kitchen Duties - Implementation Guide

## Overview

This document describes the comprehensive implementation that ensures users with the "coordinator" role are completely exempt from all kitchen-related responsibilities.

## Protection Layers

### 1. Database Level Protection (Strongest)

#### a. Helper Function

**File**: `supabase/migrations/20251204141800_prevent_coordinators_in_kitchen_queue.sql`

```sql
CREATE FUNCTION public.is_coordinator_profile(profile_uuid UUID)
```

- Checks if a given profile_id belongs to a coordinator
- Used throughout the system for role validation
- SECURITY DEFINER ensures consistent checking

#### b. CHECK Constraint

```sql
ALTER TABLE public.kitchen_queue
ADD CONSTRAINT no_coordinators_in_queue
CHECK (NOT public.is_coordinator_profile(profile_id))
```

- **Prevents** any INSERT or UPDATE that would add a coordinator to kitchen_queue
- Database enforced - cannot be bypassed
- Raises an error if violated

#### c. Trigger Function

```sql
CREATE TRIGGER trigger_prevent_coordinator_in_queue
  BEFORE INSERT OR UPDATE ON public.kitchen_queue
```

- Additional layer that validates before data modification
- Provides clear error messages
- Runs before constraint check

#### d. Row Level Security (RLS) Policy

```sql
CREATE POLICY "Coordinators can insert queue positions"
WITH CHECK (
  has_role(auth.uid(), 'coordinator'::app_role)
  AND NOT public.is_coordinator_profile(profile_id)
)
```

- Ensures coordinators managing the queue cannot accidentally add themselves
- Policy-level protection in addition to constraints

### 2. Backend/Edge Function Protection

#### Rotation Function

**File**: `supabase/functions/rotate-kitchen-queue/index.ts`

**Protection**:

1. Fetches all user roles for queue members
2. Creates a Set of coordinator user_ids
3. Filters them out before processing:

```typescript
const activeQueue = currentQueue.filter(
  (item: any) =>
    item.profiles?.status === "active" &&
    !coordinatorUserIds.has(item.profiles?.user_id)
);
```

**Impact**: Even if a coordinator somehow gets into the queue, they will be skipped during rotation and will never be assigned to a team.

### 3. Application Logic Protection

#### Student Management - Queue Backfill

**File**: `src/pages/StudentManagement.tsx`

**Function**: `handleQueueBackfill()`

**Protection**:

```typescript
const { data: availableStudent } = await supabase
  .from("profiles_with_roles")
  .select("id")
  .eq("status", "active")
  .neq("role", "coordinator") // Excludes coordinators
  .not("id", "in", `(${queueProfileIds.join(",")})`);
```

**Impact**: When backfilling queue positions after a student deactivation, coordinators are never considered as replacement candidates.

#### Queue Management - Available Students

**File**: `src/pages/QueueManagement.tsx`

**Function**: `fetchAvailableStudents()`

**Protection**:

```typescript
const { data: allProfiles, error: profilesError } = await supabase
  .from("profiles_with_roles")
  .select("id, full_name, email, status")
  .eq("status", "active")
  .neq("role", "coordinator"); // Excludes coordinators
```

**Impact**: Coordinators never appear in the "Available Students" list when manually adding students to the queue.

### 4. Frontend UI Protection

#### Queue Management Interface

- Coordinators are filtered from the available students dropdown
- The UI never shows coordinators as options for adding to queue
- Prevents accidental selection by coordinator users

## Protection Flow Diagram

```
User Action: Add student to queue
          ↓
Frontend Filter: .neq('role', 'coordinator')
          ↓
Application Logic: Validates role in business logic
          ↓
Database RLS Policy: Checks role permissions
          ↓
Database Trigger: Validates before insert
          ↓
Database Constraint: Final CHECK validation
          ↓
Success (if not coordinator) / Error (if coordinator)
```

## Testing the Protection

### Test Case 1: Direct Database Insert

```sql
-- This should FAIL
INSERT INTO kitchen_queue (profile_id, queue_position)
VALUES (
  (SELECT id FROM profiles WHERE user_id =
    (SELECT user_id FROM user_roles WHERE role = 'coordinator' LIMIT 1)
  ),
  999
);
-- Expected: ERROR - "Coordinators cannot be added to the kitchen queue"
```

### Test Case 2: Frontend Addition

1. Login as coordinator
2. Go to Queue Management
3. Try to add a coordinator to queue
4. **Expected**: Coordinator should not appear in available students list

### Test Case 3: Rotation Function

1. Manually insert a coordinator into queue (will fail due to constraints)
2. If constraint was bypassed somehow, rotation function filters them out
3. **Expected**: Coordinator never assigned to any team

### Test Case 4: Queue Backfill

1. Deactivate a student in the queue
2. System tries to backfill from available students
3. **Expected**: Only non-coordinator students considered for backfill

## Error Messages

If protection is triggered, users will see:

1. **Database Level**: "Coordinators cannot be added to the kitchen queue"
2. **Application Level**: Toast notification - "Failed to add student to queue"
3. **Frontend Level**: Coordinator simply doesn't appear as an option

## Maintenance Notes

### When Adding New Queue Features

Always ensure:

1. Use `profiles_with_roles` view instead of `profiles` table when querying for queue candidates
2. Add `.neq('role', 'coordinator')` filter to all queries selecting students for queue
3. Test against the database constraint to ensure it catches edge cases

### When Modifying Role System

If the role system changes:

1. Update `is_coordinator_profile()` function to match new role logic
2. Verify all database constraints still work
3. Test all protection layers

## Files Modified

1. **Database Migration**

   - `supabase/migrations/20251204141800_prevent_coordinators_in_kitchen_queue.sql`

2. **Edge Functions**

   - `supabase/functions/rotate-kitchen-queue/index.ts`

3. **Frontend Components**
   - `src/pages/QueueManagement.tsx`
   - `src/pages/StudentManagement.tsx`

## Summary

This implementation provides **4 layers of protection**:

1. ✅ **Database Constraint** - Cannot physically store coordinator in queue
2. ✅ **Database Trigger** - Validates before any modification
3. ✅ **RLS Policy** - Permission-based prevention
4. ✅ **Application Logic** - Business logic enforcement
5. ✅ **Frontend UI** - User interface filtering
6. ✅ **Edge Function** - Rotation logic filtering

**Result**: Coordinators are completely exempt from kitchen duties with multiple failsafes ensuring the rule cannot be violated.
