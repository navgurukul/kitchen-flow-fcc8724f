# Student Deletion Implementation

## Overview

This document describes the complete implementation of the student deletion functionality for the KitchenFlow application.

## Problem Statement

The original delete functionality was incomplete - it only removed students from the queue but did not fully delete student profiles and associated data from the system.

## Solution Implemented

### 1. Database Migration (`20251204140600_add_delete_policies_for_students.sql`)

#### Added DELETE Policies

Three new Row Level Security (RLS) policies were created to allow coordinators to delete records:

1. **Profiles Table**: `"Coordinators can delete profiles"`
   - Allows coordinators to delete student profile records
2. **Skip Requests Table**: `"Coordinators can delete skip requests"`
   - Allows coordinators to delete skip request records
3. **User Roles Table**: `"Coordinators can delete user roles"`
   - Allows coordinators to delete user role assignments

#### Created Database Function

A new PostgreSQL function `delete_student_completely()` was created to ensure atomic deletion:

**Function Signature:**

```sql
public.delete_student_completely(student_profile_id UUID)
```

**What it does:**

1. Verifies the caller is a coordinator
2. Retrieves the user_id associated with the profile
3. Deletes records from `kitchen_queue` table
4. Deletes records from `skip_requests` table
5. Deletes records from `user_roles` table
6. Deletes the profile record (which cascades to other related tables)
7. Logs the deletion for audit purposes

**Security:**

- Function is `SECURITY DEFINER` to bypass RLS for transactional integrity
- Includes explicit coordinator role check
- Proper error handling with descriptive messages

### 2. Frontend Implementation (`StudentManagement.tsx`)

#### Updated `handleDeleteStudent` Function

The function now:

- Uses the `delete_student_completely` RPC function for atomic deletion
- Provides better error messages with specific permission checks
- Shows the student's name in success messages
- Properly handles and logs errors

**Key Changes:**

```typescript
// Before: Manual deletion with potential inconsistencies
await supabase.from("kitchen_queue").delete().eq("profile_id", student.id);
await supabase.from("skip_requests").delete().eq("profile_id", student.id);
const { error } = await supabase.from("profiles").delete().eq("id", student.id);

// After: Atomic deletion using database function
const { error: functionError } = await supabase.rpc(
  "delete_student_completely",
  {
    student_profile_id: student.id,
  }
);
```

### 3. TypeScript Types Update (`types.ts`)

Added the new function signature to Supabase types:

```typescript
delete_student_completely: {
  Args: {
    student_profile_id: string;
  }
  Returns: undefined;
}
```

## Database Tables Affected

### Direct Deletions:

1. `kitchen_queue` - Student's queue position
2. `skip_requests` - Student's skip requests
3. `user_roles` - Student's role assignment
4. `profiles` - Student's profile record

### Cascade Deletions (Automatic):

Tables with `ON DELETE CASCADE` foreign keys will automatically delete related records when the profile is deleted.

## Testing the Implementation

### Prerequisites:

1. Apply the migration to your Supabase database
2. Ensure you're logged in as a coordinator

### Test Steps:

1. Navigate to Student Management page
2. Find a test student (preferably inactive and not in today's team)
3. Click the red trash icon
4. Confirm the deletion in the dialog
5. Verify the student is completely removed from:
   - Student list
   - Queue (if they were in it)
   - Skip requests
   - Database tables

### Expected Behavior:

- **Success**: Toast shows "Student Deleted - [Name] has been permanently removed from the system"
- **Permission Error**: Toast shows "You don't have permission to delete students"
- **Other Errors**: Toast shows specific error message

## Migration Instructions

### Step 1: Apply Migration

```bash
# If using Supabase CLI
supabase migration up

# Or apply directly via Supabase Dashboard:
# 1. Go to SQL Editor
# 2. Paste the contents of 20251204140600_add_delete_policies_for_students.sql
# 3. Run the query
```

### Step 2: Verify Policies

```sql
-- Check if policies were created
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE policyname LIKE '%delete%';
```

### Step 3: Test Function

```sql
-- Test the function (replace UUID with actual student profile ID)
SELECT delete_student_completely('your-student-profile-id-here');
```

### Step 4: Restart Development Server

```bash
npm run dev
```

## Important Notes

### ⚠️ Limitations

1. **Auth Users**: The Supabase Auth `auth.users` record is NOT deleted by this implementation

   - This requires admin privileges and should be handled separately if needed
   - The student cannot log back in but the auth record remains

2. **Permanent Action**: This deletion is PERMANENT and cannot be undone

   - Consider implementing soft deletes (using status field) instead
   - Or add a confirmation step requiring additional verification

3. **Data Integrity**: Before deleting, ensure:
   - Student is not in today's kitchen team
   - No critical data dependencies exist
   - Historical records don't require this profile

### 🔒 Security Considerations

- Only coordinators can delete students (enforced at database level)
- Function uses `SECURITY DEFINER` but includes explicit role checks
- All deletions are logged via PostgreSQL NOTICE messages

### 📊 Audit Trail

Consider adding an audit table to track deletions:

```sql
CREATE TABLE deletion_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deleted_profile_id UUID NOT NULL,
  deleted_by UUID NOT NULL,
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  profile_data JSONB
);
```

## Rollback Instructions

If you need to rollback this migration:

```sql
-- Remove the function
DROP FUNCTION IF EXISTS public.delete_student_completely(UUID);

-- Remove the policies
DROP POLICY IF EXISTS "Coordinators can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Coordinators can delete skip requests" ON public.skip_requests;
DROP POLICY IF EXISTS "Coordinators can delete user roles" ON public.user_roles;
```

## Files Modified

1. `/supabase/migrations/20251204140600_add_delete_policies_for_students.sql` - New migration
2. `/src/pages/StudentManagement.tsx` - Updated delete handler
3. `/src/integrations/supabase/types.ts` - Added function types

## Related Documentation

- [Supabase Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Security Definer Functions](https://www.postgresql.org/docs/current/sql-createfunction.html)
- [Cascade Delete](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK)

## Support

For issues or questions:

1. Check the browser console for detailed error messages
2. Check Supabase logs for database errors
3. Verify the coordinator role is properly assigned
4. Ensure the migration was applied successfully
