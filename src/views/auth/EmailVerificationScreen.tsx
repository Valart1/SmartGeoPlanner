/**
 * EmailVerificationScreen – Auth View
 * Shown after signup, and when an unverified account tries to sign in.
 * Guides the user to open the verification email and tap "Verify my email".
 * No code entry — verification happens via a one-click link in the inbox.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthViewModel } from '../../viewmodels/useAuthViewModel';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { Colors, Spacing, BorderRadius, Typography } from '../../theme/theme';

type Props = { navigation: NativeStackNavigationProp<AuthStackParamList, 'EmailVerification'> };

const RESEND_COOLDOWN_SECONDS = 30;

export default function EmailVerificationScreen({ navigation }: Props) {
  const {
    pendingEmail,
    pendingDevVerifyUrl,
    resendVerification,
    isLoading,
    error,
    logout,
  } = useAuthViewModel();

  const [cooldown, setCooldown] = useState(0);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(seconds => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleResend = async () => {
    if (cooldown > 0 || isLoading) return;
    setResent(false);
    const ok = await resendVerification();
    if (ok) {
      setResent(true);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    }
  };

  const email = pendingEmail ?? 'your email';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.icon}>📧</Text>
        <Text style={styles.title}>Verify your email</Text>
        <Text style={styles.subtitle}>
          We sent a verification email to
          {'\n'}
          <Text style={styles.email}>{email}</Text>
        </Text>

        <View style={styles.card}>
          <Text style={styles.instructionTitle}>What to do next</Text>
          <Text style={styles.step}>1. Open your email inbox</Text>
          <Text style={styles.step}>2. Open the email from Smart Geo-Planner</Text>
          <Text style={styles.step}>3. Tap the <Text style={styles.stepBold}>"Verify my email"</Text> button</Text>
          <Text style={styles.step}>4. Come back here and sign in</Text>
        </View>

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {pendingDevVerifyUrl && (
          <View style={styles.devBanner}>
            <Text style={styles.devBannerTitle}>Dev mode — SMTP not configured</Text>
            <Text style={styles.devBannerText}>
              The email was logged to the backend console instead of sent. Open this link:
            </Text>
            <Text style={styles.devLink}>{pendingDevVerifyUrl}</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => navigation.navigate('Login')}
          accessibilityLabel="Go to login button"
        >
          <Text style={styles.primaryBtnText}>I've verified — go to sign in</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.resendBtn}
          onPress={handleResend}
          disabled={cooldown > 0 || isLoading}
          accessibilityLabel="Resend verification email"
        >
          {isLoading ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            <Text style={[styles.resendText, cooldown > 0 && styles.resendDisabled]}>
              {resent
                ? 'Email resent'
                : cooldown > 0
                  ? `Resend in ${cooldown}s`
                  : 'Resend verification email'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={async () => {
            await logout();
            navigation.navigate('Login');
          }}
          style={styles.logoutLink}
        >
          <Text style={styles.logoutText}>Sign out and use a different email</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  container: {
    flexGrow: 1,
    padding: Spacing.xl,
    paddingTop: Spacing.xxxl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  icon: { fontSize: 72, marginBottom: Spacing.sm },
  title: { fontSize: Typography.fontSize.xxl, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  subtitle: { fontSize: Typography.fontSize.base, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  email: { color: Colors.primary, fontWeight: '700' },
  card: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
    width: '100%',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  instructionTitle: { fontSize: Typography.fontSize.base, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  step: { fontSize: Typography.fontSize.base, color: Colors.textSecondary },
  stepBold: { color: Colors.primary, fontWeight: '700' },
  errorBanner: {
    backgroundColor: `${Colors.error}22`,
    borderWidth: 1,
    borderColor: Colors.error,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    width: '100%',
  },
  errorText: { color: Colors.error, fontSize: Typography.fontSize.sm, textAlign: 'center' },
  devBanner: {
    backgroundColor: `${Colors.warning}22`,
    borderWidth: 1,
    borderColor: Colors.warning,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    width: '100%',
    gap: 2,
  },
  devBannerTitle: { color: Colors.warning, fontSize: Typography.fontSize.sm, fontWeight: '700' },
  devBannerText: { color: Colors.textSecondary, fontSize: Typography.fontSize.sm, lineHeight: 18 },
  devLink: { color: Colors.warning, fontWeight: '600' },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    width: '100%',
    marginTop: Spacing.sm,
  },
  primaryBtnText: { color: Colors.textOnPrimary, fontSize: Typography.fontSize.md, fontWeight: '700' },
  resendBtn: { padding: Spacing.xs, minHeight: 24, justifyContent: 'center' },
  resendText: { color: Colors.primary, fontSize: Typography.fontSize.base },
  resendDisabled: { color: Colors.textMuted },
  logoutLink: { marginTop: Spacing.sm },
  logoutText: { color: Colors.textMuted, fontSize: Typography.fontSize.sm },
});