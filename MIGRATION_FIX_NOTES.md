# Migration Fix Notes

## Issue

The initial migration failed with error:

```
ERROR: 23514: check constraint "no_coordinators_in_queue" of relation "kitchen_queue" is violated by some row
```

## Root Cause

The database already contained coordinator profiles in the `kitchen_queue` table when we tried to add the CHECK constraint. The constraint cannot be added if existing data violates it.

## Solution

Updated the migration file to include a cleanup step **before** adding the constraint:

### Step 1: Clean Up Existing Coordinators

```sql
DELETE FROM public.kitchen_queue
WHERE profile_id IN (
  SELECT p.id
  FROM public.profiles p
  JOIN public.user_roles ur ON p.user_id = ur.user_id
  WHERE ur.role = 'coordinator'::app_role
);
```

### Step 2: Reorder Queue Positions

After removing coordinators, queue positions may have gaps (e.g., 1, 2, 5, 7).
We reorder to ensure sequential positions (1, 2, 3, 4):

```sql
WITH numbered_queue AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY queue_position) as new_position
  FROM public.kitchen_queue
  ORDER BY queue_position
)
UPDATE public.kitchen_queue kq
SET queue_position = nq.new_position
FROM numbered_queue nq
WHERE kq.id = nq.id;
```

### Step 3: Add Constraint

Only after cleanup can we safely add the constraint:

```sql
ALTER TABLE public.kitchen_queue
ADD CONSTRAINT no_coordinators_in_queue CHECK (
    NOT public.is_coordinator_profile (profile_id)
);
```

## Migration Order

The updated migration (`20251204141800_prevent_coordinators_in_kitchen_queue.sql`) now executes in this order:

1. ✅ Create helper function `is_coordinator_profile()`
2. ✅ **DELETE** any coordinators from kitchen_queue
3. ✅ **REORDER** queue positions to be sequential
4. ✅ Add CHECK constraint
5. ✅ Update RLS policy
6. ✅ Create trigger function
7. ✅ Create trigger

## Testing the Fix

Run the migration:

```bash
# Local Supabase
supabase db reset

# Or push to remote
supabase db push
```

## Expected Outcome

- ✅ Any coordinators in the queue are removed automatically
- ✅ Queue positions are renumbered to be sequential
- ✅ CHECK constraint is successfully added
- ✅ Future attempts to add coordinators will be blocked

## Data Impact

- **Coordinators removed from queue**: Will be logged during migration
- **Queue reordering**: Maintains relative order but ensures no gaps
- **No data loss**: Only coordinators (who shouldn't be in queue anyway) are removed

## Rollback Plan

If needed, the constraint can be removed with:

```sql
ALTER TABLE public.kitchen_queue DROP CONSTRAINT IF EXISTS no_coordinators_in_queue;
DROP TRIGGER IF EXISTS trigger_prevent_coordinator_in_queue ON public.kitchen_queue;
DROP FUNCTION IF EXISTS public.prevent_coordinator_in_queue();
DROP FUNCTION IF EXISTS public.is_coordinator_profile(UUID);
```

## Next Steps

After successful migration:

1. Verify no coordinators in queue: `SELECT * FROM kitchen_queue JOIN profiles_with_roles ON profile_id = id WHERE role = 'coordinator';`
2. Test adding a student to queue (should work)
3. Test adding a coordinator to queue (should fail with clear error)
