-- Seed Data for Testing School Performance Report App

-- 1. Seed System Settings (Principal Signature Placeholder)
-- This UUID matches the hardcoded one in our app logic
INSERT INTO public.system_settings (id, principal_signature_url)
VALUES ('00000000-0000-0000-0000-000000000000', NULL)
ON CONFLICT (id) DO NOTHING;

-- 2. Seed Approved Instructors (Staff Email whitelist)
INSERT INTO public.approved_instructors (email, name)
VALUES 
    ('teacher.sarah@school.edu', 'Sarah Jenkins'),
    ('teacher.robert@school.edu', 'Robert Chen'),
    ('principal@school.edu', 'Dr. Arthur Vance')
ON CONFLICT (email) DO NOTHING;

-- 3. Seed Approved Student Roster (Student Mobile whitelist)
INSERT INTO public.approved_students (mobile_no, name, class, section, parent_email)
VALUES 
    ('9876543210', 'Alex Johnson', '12', 'A', 'parent.alex@gmail.com'),
    ('9876543211', 'Emily Smith', '12', 'B', 'parent.emily@gmail.com'),
    ('9876543212', 'Michael Chang', '11', 'A', 'parent.michael@gmail.com'),
    ('9876543213', 'Sophia Rodriguez', '11', 'B', 'parent.sophia@gmail.com')
ON CONFLICT (mobile_no) DO NOTHING;

-- Note on Admin Account Creation:
-- In Supabase Auth, you can register a user with email `admin@school.com` and password of your choice.
-- To make that user an Admin, set the `role` metadata to `admin` during registration,
-- or manually update their profile role in the database after registration:
-- UPDATE public.profiles SET role = 'admin' WHERE mobile_no = 'your-admin-mobile';
