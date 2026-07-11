-- Migration: Add is_admin column to profiles and default existing admins to true
ALTER TABLE profiles 
ADD COLUMN is_admin BOOLEAN DEFAULT false;

-- Update profiles where plan is 'admin' (which we set via the script) to be is_admin = true
UPDATE profiles 
SET is_admin = true
WHERE plan = 'admin';
