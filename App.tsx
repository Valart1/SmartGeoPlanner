/**
 * App.tsx – Root Entry Point
 * Wraps the app in AuthProvider and renders AppNavigator.
 * Registers notification response listeners at the root level.
 *
 * NOTE: expo-notifications is never imported here directly. It is loaded
 * lazily via the notificationService so that Expo Go (Android, SDK 53+) does
 * not crash on startup with "[runtime not ready]".
 */

import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import {
  registerNotificationListeners,
  requestNotificationPermissions,
} from './src/services/notificationService';

export default function App() {
  useEffect(() => {
    // Request notification permissions on startup (no-op in unsupported envs).
    requestNotificationPermissions();

    // Listen for foreground and tapped notifications. The service returns an
    // unsubscribe function; it no-ops where notifications are unsupported.
    return registerNotificationListeners(
      notification => {
        console.log('[Notification received]', notification.request.content.title);
      },
      response => {
        console.log('[Notification tapped]', response.notification.request.content.title);
        // TODO: Navigate to the relevant task or event screen based on notification data
      },
    );
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
