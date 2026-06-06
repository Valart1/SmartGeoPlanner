/**
 * EmailVerificationScreen – Auth View
 * Placeholder shown after signup, prompts user to verify email.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthViewModel } from '../../viewmodels/useAuthViewModel';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { Colors, Spacing, BorderRadius, Typography } from '../../theme/theme';

type Props = { navigation: NativeStackNavigationProp<AuthStackParamList, 'EmailVerification'> };

export default function EmailVerificationScreen({ navigation }: Props) {
  const { user, logout } = useAuthViewModel();

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <View style={styles.container}>
        <Text style={styles.icon}>📧</Text>
        <Text style={styles.title}>Verify your Email</Text>
        <Text style={styles.subtitle}>
          We've sent a verification link to{'\n'}
          <Text style={styles.email}>{user?.email ?? 'your email'}</Text>
        </Text>

        <View style={styles.card}>
          <Text style={styles.instructionTitle}>What to do next:</Text>
          {[
            '1. Check your email inbox',
            '2. Open the verification email',
            '3. Click the verification link',
            '4. Return here and sign in',
          ].map(step => (
            <Text key={step} style={styles.step}>{step}</Text>
          ))}
        </View>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => navigation.navigate('Login')}
          accessibilityLabel="Go to login button"
        >
          <Text style={styles.primaryBtnText}>I've Verified My Email</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.resendBtn} onPress={() => {}}>
          <Text style={styles.resendText}>Resend verification email</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={logout} style={styles.logoutLink}>
          <Text style={styles.logoutText}>Sign out and use different email</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  container: {
    flex: 1, padding: Spacing.xl, paddingTop: Spacing.xxxl,
    alignItems: 'center', gap: Spacing.base,
  },
  icon: { fontSize: 72, marginBottom: Spacing.sm },
  title: { fontSize: Typography.fontSize.xxl, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  subtitle: { fontSize: Typography.fontSize.base, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  email: { color: Colors.primary, fontWeight: '600' },
  card: {
    backgroundColor: Colors.card, borderRadius: BorderRadius.lg,
    padding: Spacing.base, borderWidth: 1, borderColor: Colors.border,
    width: '100%', gap: Spacing.xs,
  },
  instructionTitle: { fontSize: Typography.fontSize.base, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  step: { fontSize: Typography.fontSize.base, color: Colors.textSecondary },
  primaryBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.xxl, alignItems: 'center', width: '100%',
  },
  primaryBtnText: { color: Colors.textOnPrimary, fontSize: Typography.fontSize.md, fontWeight: '700' },
  resendBtn: { padding: Spacing.xs },
  resendText: { color: Colors.primary, fontSize: Typography.fontSize.base },
  logoutLink: { marginTop: Spacing.sm },
  logoutText: { color: Colors.textMuted, fontSize: Typography.fontSize.sm },
});
