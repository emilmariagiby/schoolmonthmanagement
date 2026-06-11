import { StyleSheet, Dimensions } from 'react-native';

export const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window');

export const COLORS = {
  // Deep space obsidian palettes
  background: '#0B0D17',
  cardBg: '#141829',
  cardBorder: '#232A45',
  
  // Neon accents
  primary: '#8A5CFF', // Deep electric violet
  primaryGlow: '#B399FF',
  secondary: '#00E5FF', // Cyan glow
  success: '#10B981', // Emerald
  warning: '#F59E0B', // Amber
  danger: '#EF4444', // Coral Red
  
  // Neutral texts
  textPrimary: '#FFFFFF',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  inputBg: '#1E243A',
  
  // Translucent overlay colors for glassmorphism
  glassBg: 'rgba(20, 24, 41, 0.75)',
  glassBorder: 'rgba(255, 255, 255, 0.08)',
};

export const SHADOWS = {
  glowPrimary: {
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  glowSecondary: {
    shadowColor: COLORS.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
};

export const THEME = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  glassCard: {
    backgroundColor: COLORS.glassBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    padding: 20,
    marginVertical: 10,
    ...SHADOWS.card,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: COLORS.textPrimary,
    fontSize: 15,
    marginBottom: 16,
  },
  btnPrimary: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.glowPrimary,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  btnSecondary: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.secondary,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryText: {
    color: COLORS.secondary,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleLarge: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
});
