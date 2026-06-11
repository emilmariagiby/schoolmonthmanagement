import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { supabase } from '../lib/supabaseClient';
import { COLORS, THEME } from '../theme';

interface AuthScreenProps {
  onLoginSuccess: (session: any) => void;
}

export default function AuthScreen({ onLoginSuccess }: AuthScreenProps) {
  const [isStudent, setIsStudent] = useState<boolean>(true);
  
  // Input States
  const [email, setEmail] = useState<string>('');
  const [mobileNo, setMobileNo] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  
  // Loading & Error States
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const handleLogin = async () => {
    setErrorMsg('');
    setLoading(true);

    try {
      let loginEmail = '';
      if (isStudent) {
        const cleanMobile = mobileNo.trim();
        if (!cleanMobile) {
          setErrorMsg('Please enter your mobile number.');
          setLoading(false);
          return;
        }
        loginEmail = `${cleanMobile}@school.report`;
      } else {
        const cleanEmail = email.trim().toLowerCase();
        if (!cleanEmail) {
          setErrorMsg('Please enter your email.');
          setLoading(false);
          return;
        }
        loginEmail = cleanEmail;
      }

      if (!password) {
        setErrorMsg('Please enter your password.');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setErrorMsg('Invalid login details. Initial student passwords are set to their registered Mobile Number.');
        } else {
          setErrorMsg(error.message);
        }
      } else if (data?.session) {
        onLoginSuccess(data.session);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={THEME.safeArea}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.headerContainer}>
          <Text style={styles.titleText}>ACADEMIA</Text>
          <Text style={styles.subtitleText}>Performance Report Portal</Text>
        </View>

        <View style={THEME.glassCard}>
          {/* Tab Selector */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabButton, isStudent && styles.activeTab]}
              onPress={() => {
                setIsStudent(true);
                setErrorMsg('');
              }}
            >
              <Text style={[styles.tabText, isStudent && styles.activeTabText]}>
                Student / Parent
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, !isStudent && styles.activeTab]}
              onPress={() => {
                setIsStudent(false);
                setErrorMsg('');
              }}
            >
              <Text style={[styles.tabText, !isStudent && styles.activeTabText]}>
                School Staff
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.cardHeader}>
            {isStudent ? 'Sign in as Student / Parent' : 'Sign in as Instructor / Admin'}
          </Text>

          {errorMsg ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          {isStudent ? (
            <>
              <Text style={THEME.label}>Registered Mobile Number</Text>
              <TextInput
                style={THEME.input}
                placeholder="Enter 10-digit mobile no."
                placeholderTextColor={COLORS.textMuted}
                keyboardType="phone-pad"
                value={mobileNo}
                onChangeText={setMobileNo}
                autoCapitalize="none"
              />
            </>
          ) : (
            <>
              <Text style={THEME.label}>Staff Email Address</Text>
              <TextInput
                style={THEME.input}
                placeholder="teacher@school.edu"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
              />
            </>
          )}

          <Text style={THEME.label}>Password</Text>
          <TextInput
            style={THEME.input}
            placeholder="••••••••"
            placeholderTextColor={COLORS.textMuted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
          />

          <TouchableOpacity
            style={[THEME.btnPrimary, loading && styles.disabledBtn]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={THEME.btnPrimaryText}>Secure Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>Highly Secure Connection</Text>
          <Text style={styles.footerSubText}>
            Protected by Row Level Security (RLS) & JWT Authentication
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  titleText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  subtitleText: {
    fontSize: 14,
    color: COLORS.secondary,
    letterSpacing: 1,
    marginTop: 4,
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.inputBg,
    borderRadius: 10,
    padding: 4,
    marginBottom: 24,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  cardHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 20,
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: COLORS.danger,
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  disabledBtn: {
    opacity: 0.7,
  },
  footerContainer: {
    alignItems: 'center',
    marginTop: 32,
  },
  footerText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  footerSubText: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
});
