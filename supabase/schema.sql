-- Database Schema for School Performance Report App

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create Table: APPROVED_STUDENTS (Pre-approved roster uploaded by Admin)
CREATE TABLE IF NOT EXISTS public.approved_students (
    mobile_no TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    class TEXT NOT NULL,
    section TEXT NOT NULL,
    parent_email TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Table: APPROVED_INSTRUCTORS (Pre-approved instructors uploaded by Admin)
CREATE TABLE IF NOT EXISTS public.approved_instructors (
    email TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Table: PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'instructor', 'student')),
    class TEXT, -- e.g., '11', '12' (applicable to students)
    section TEXT, -- e.g., 'A', 'B' (applicable to students)
    mobile_no TEXT UNIQUE, -- used as login and identifier
    parent_email TEXT, -- email to send report summaries to
    signature_url TEXT, -- for instructors/teachers
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Table: SYSTEM_SETTINGS
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    principal_signature_url TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert a default system setting row if not exists
INSERT INTO public.system_settings (id, principal_signature_url)
VALUES ('00000000-0000-0000-0000-000000000000', NULL)
ON CONFLICT (id) DO NOTHING;

-- Create Table: REPORTS
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    period TEXT NOT NULL CHECK (period IN ('MAY_TO_JUNE', 'AUGUST_TO_SEPTEMBER', 'OCT_TO_NOVEMBER', 'DECEMBER_TO_JANUARY', 'FEB')),
    
    subject_1_name TEXT NOT NULL,
    subject_1_score NUMERIC CHECK (subject_1_score >= 0 AND subject_1_score <= 100),
    
    subject_2_name TEXT NOT NULL,
    subject_2_score NUMERIC CHECK (subject_2_score >= 0 AND subject_2_score <= 100),
    
    subject_3_name TEXT NOT NULL,
    subject_3_score NUMERIC CHECK (subject_3_score >= 0 AND subject_3_score <= 100),
    
    subject_4_name TEXT NOT NULL,
    subject_4_score NUMERIC CHECK (subject_4_score >= 0 AND subject_4_score <= 100),
    
    subject_5_name TEXT NOT NULL,
    subject_5_score NUMERIC CHECK (subject_5_score >= 0 AND subject_5_score <= 100),
    
    lab_attendance NUMERIC CHECK (lab_attendance >= 0 AND lab_attendance <= 100), -- percentage
    discipline TEXT, -- e.g. 'Excellent', 'A', 'B'
    class_teacher_remark TEXT,
    
    created_by UUID REFERENCES public.profiles(id),
    email_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure a student only has one report per period
    UNIQUE(student_id, period)
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.approved_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approved_instructors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Approved Students Policies (Only Admin can manage)
CREATE POLICY admin_approved_stud_policy ON public.approved_students
    FOR ALL USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );

-- Approved Instructors Policies (Only Admin can manage)
CREATE POLICY admin_approved_inst_policy ON public.approved_instructors
    FOR ALL USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );

-- Profiles Policies
CREATE POLICY profiles_select_policy ON public.profiles
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY profiles_insert_policy ON public.profiles
    FOR INSERT WITH CHECK (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );

CREATE POLICY profiles_update_policy ON public.profiles
    FOR UPDATE USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin' OR 
        auth.uid() = id
    );

CREATE POLICY profiles_delete_policy ON public.profiles
    FOR DELETE USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );

-- System Settings Policies
CREATE POLICY settings_select_policy ON public.system_settings
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY settings_all_policy ON public.system_settings
    FOR ALL USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );

-- Reports Policies
CREATE POLICY reports_select_policy ON public.reports
    FOR SELECT USING (
        auth.uid() = student_id OR
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'instructor')
    );

CREATE POLICY reports_insert_policy ON public.reports
    FOR INSERT WITH CHECK (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'instructor')
    );

CREATE POLICY reports_update_policy ON public.reports
    FOR UPDATE USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'instructor')
    );

CREATE POLICY reports_delete_policy ON public.reports
    FOR DELETE USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );

-- Trigger: Automatically create profile when a user registers in auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    user_role TEXT;
    student_record RECORD;
    instructor_record RECORD;
    user_mobile TEXT;
    user_email TEXT;
BEGIN
    user_role := COALESCE(new.raw_user_meta_data->>'role', 'student');
    user_mobile := new.raw_user_meta_data->>'mobile_no';
    user_email := new.email;

    -- Admin Bypass
    IF user_role = 'admin' THEN
        INSERT INTO public.profiles (id, name, role, mobile_no)
        VALUES (new.id, COALESCE(new.raw_user_meta_data->>'name', 'Admin User'), 'admin', user_mobile);
        RETURN NEW;
    END IF;

    -- Instructor Registration Flow
    IF user_role = 'instructor' THEN
        SELECT * INTO instructor_record FROM public.approved_instructors WHERE email = user_email;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'This email is not approved by school administration.';
        END IF;
        
        INSERT INTO public.profiles (id, name, role)
        VALUES (new.id, instructor_record.name, 'instructor');
        RETURN NEW;
    END IF;

    -- Student Registration Flow
    IF user_role = 'student' THEN
        SELECT * INTO student_record FROM public.approved_students WHERE mobile_no = user_mobile;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'This mobile number is not registered on the student roster. Contact admin.';
        END IF;
        
        INSERT INTO public.profiles (id, name, role, class, section, mobile_no, parent_email)
        VALUES (
            new.id, 
            student_record.name, 
            'student', 
            student_record.class, 
            student_record.section, 
            student_record.mobile_no, 
            student_record.parent_email
        );
        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
