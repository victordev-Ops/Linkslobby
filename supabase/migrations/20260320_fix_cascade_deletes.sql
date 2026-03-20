-- Fix missing ON DELETE CASCADE for foreign keys referencing profiles and users
-- This script safely drops existing restricting foreign keys and recreates them with ON DELETE CASCADE.
-- It targets the specific error in hot_seat_participants but also fixes any other table mapping to profiles/users.

DO $$
DECLARE
    row_record record;
BEGIN
    FOR row_record IN
        SELECT
            tc.table_schema,
            tc.table_name,
            tc.constraint_name,
            kcu.column_name,
            ccu.table_schema AS foreign_table_schema,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
        JOIN information_schema.referential_constraints rc
            ON tc.constraint_name = rc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_name IN ('profiles', 'users')
          AND ccu.table_schema IN ('public', 'auth')
          AND rc.delete_rule NOT IN ('CASCADE', 'SET NULL')
    LOOP
        EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I;', 
            row_record.table_schema, row_record.table_name, row_record.constraint_name);
            
        EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I.%I(%I) ON DELETE CASCADE;', 
            row_record.table_schema, row_record.table_name, row_record.constraint_name, 
            row_record.column_name, 
            row_record.foreign_table_schema, row_record.foreign_table_name, row_record.foreign_column_name);
            
        RAISE NOTICE 'Added ON DELETE CASCADE to %.% (%)', row_record.table_schema, row_record.table_name, row_record.constraint_name;
    END LOOP;
END $$;
