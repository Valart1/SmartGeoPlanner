/**
 * AuthNavigator
 * Native stack for unauthenticated flows: Login → Signup → ForgotPassword → EmailVerification
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../views/auth/LoginScreen';
import SignupScreen from '../views/auth/SignupScreen';
import ForgotPasswordScreen from '../views/auth/ForgotPasswordScreen';
import EmailVerificationScreen from '../views/auth/EmailVerificationScreen';

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
  EmailVerification: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="EmailVerification" component={EmailVerificationScreen} />
    </Stack.Navigator>
  );
}
