import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, StatusBar, SafeAreaView, Platform } from 'react-native';
import { supabase, isSupabaseConfigured } from './src/lib/supabaseClient';
import { COLORS, THEME } from './src/theme';

// Import Screens
import AuthScreen from './src/screens/AuthScreen';
import StudentDashboard from './src/screens/StudentDashboard';
import InstructorDashboard from './src/screens/InstructorDashboard';
import AdminDashboard from './src/screens/AdminDashboard';

export default function App() {
  const [configured, setConfigured] = useState<boolean>(true);
  const [session, setSession] = useState<any>(null);
  const [role, setRole] = useState<'admin' | 'instructor' | 'student' | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // 1. Check if Supabase variables are set up
    if (!isSupabaseConfigured()) {
      setConfigured(false);
      setLoading(false);
      return;
    }

    // 2. Fetch current session & subscribe to auth changes
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchUserRole(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchUserRole(session.user.id);
      } else {
        setRole(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchUserRole = async (userId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setRole(data?.role as any);
    } catch (err: any) {
      console.error('Error fetching user role:', err.message);
      // Fallback or retry logic
      setRole('student'); // Default safe fallback
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error(err);
    } finally {
      setSession(null);
      setRole(null);
      setLoading(false);
    }
  };

  // Graceful setup instructions fallback screen
  if (!configured) {
    return (
      <SafeAreaView style={THEME.safeArea}>
        <StatusBar barStyle="light-content" />
        <View style={styles.center}>
          <Text style={styles.setupTitle}>Configuration Required</Text>
          <Text style={styles.setupText}>
            Please define your Supabase credentials in a `.env` file at the root of the project:
          </Text>
          <View style={styles.codeBlock}>
            <Text style={styles.codeLine}>EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co</Text>
            <Text style={styles.codeLine}>EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key</Text>
          </View>
          <Text style={styles.setupSub}>
            Restart the development server once variables have been loaded.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={THEME.safeArea}>
      <StatusBar barStyle="light-content" />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.secondary} />
          <Text style={styles.loadingText}>Loading Account Securely...</Text>
        </View>
      ) : !session ? (
        <AuthScreen onLoginSuccess={(sess) => setSession(sess)} />
      ) : role === 'admin' ? (
        <AdminDashboard session={session} onLogout={handleLogout} />
      ) : role === 'instructor' ? (
        <InstructorDashboard session={session} onLogout={handleLogout} />
      ) : (
        <StudentDashboard session={session} onLogout={handleLogout} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    backgroundColor: COLORS.background,
  },
  loadingText: {
    color: COLORS.textSecondary,
    marginTop: 14,
    fontSize: 14,
    fontWeight: '600',
  },
  setupTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  setupText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  codeBlock: {
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  codeLine: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    color: COLORS.secondary,
    marginVertical: 4,
  },
  setupSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
});
