-- Database Schema for School Performance Report App

-- Enable pgcrypto for password hashing in SQL
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create Table: PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'instructor', 'student')),
    class TEXT, -- e.g., '11', '12'
    section TEXT,
    mobile_no TEXT UNIQUE,
    parent_email TEXT,
    signature_url TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Table: SYSTEM_SETTINGS
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    principal_signature_url TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default system settings row
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
    
    lab_attendance NUMERIC CHECK (lab_attendance >= 0 AND lab_attendance <= 100),
    discipline TEXT,
    class_teacher_remark TEXT,
    
    created_by UUID REFERENCES public.profiles(id),
    email_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(student_id, period)
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

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

-- Trigger: Automatically mirror auth user metadata into profiles table
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role, class, section, mobile_no, parent_email)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', 'New User'),
    COALESCE(new.raw_user_meta_data->>'role', 'student'),
    new.raw_user_meta_data->>'class',
    new.raw_user_meta_data->>'section',
    new.raw_user_meta_data->>'mobile_no',
    new.raw_user_meta_data->>'parent_email'
  )
  ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      role = EXCLUDED.role,
      class = EXCLUDED.class,
      section = EXCLUDED.section,
      mobile_no = EXCLUDED.mobile_no,
      parent_email = EXCLUDED.parent_email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Secure RPC: Admin Create User Bypass
CREATE OR REPLACE FUNCTION public.create_auth_user(
    p_email TEXT,
    p_password TEXT,
    p_metadata JSONB
)
RETURNS UUID AS $$
DECLARE
    v_user_id UUID;
    v_encrypted_pw TEXT;
BEGIN
    -- Verify caller is Admin
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Only administrators can create users.';
    END IF;

    v_user_id := uuid_generate_v4();
    v_encrypted_pw := crypt(p_password, gen_salt('bf', 10));

    -- Insert into auth.users
    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        recovery_token
    ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        v_user_id,
        'authenticated',
        'authenticated',
        p_email,
        v_encrypted_pw,
        NOW(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        p_metadata,
        NOW(),
        NOW(),
        '',
        ''
    );

    -- Insert into auth.identities
    INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        last_sign_in_at,
        created_at,
        updated_at
    ) VALUES (
        v_user_id::text,
        v_user_id,
        json_build_object('sub', v_user_id, 'email', p_email)::jsonb,
        'email',
        NOW(),
        NOW(),
        NOW()
    );

    RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Secure RPC: Admin Reset User Password
CREATE OR REPLACE FUNCTION public.reset_user_password(
    p_user_id UUID,
    p_new_password TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_encrypted_pw TEXT;
BEGIN
    -- Verify caller is Admin
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Only administrators can reset passwords.';
    END IF;

    v_encrypted_pw := crypt(p_new_password, gen_salt('bf', 10));

    UPDATE auth.users
    SET encrypted_password = v_encrypted_pw,
        updated_at = NOW()
    WHERE id = p_user_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
