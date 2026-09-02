/**
 * DashboardScreen – Main View
 * Summary screen: weather widget, task stats, upcoming events.
 * Consumes location, task, and calendar ViewModels.
 */

import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, StatusBar, Alert,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { usePlanner } from '../../context/PlannerContext';
import { useLocationViewModel } from '../../viewmodels/useLocationViewModel';
import WeatherWidget from '../components/WeatherWidget';
import TaskCard from '../components/TaskCard';
import EventCard from '../components/EventCard';
import { Colors, Spacing, BorderRadius, Typography } from '../../theme/theme';
import { scheduleTestNotification } from '../../services/notificationService';
import { todayString } from '../../utils/dateUtils';
import { Task } from '../../models/Task';
import { CalendarEvent } from '../../models/Event';

export default function DashboardScreen() {
  const { user, logout, deleteAccount } = useAuth();
  const { taskVM, calendarVM } = usePlanner();
  const locationVM = useLocationViewModel();
  const navigation = useNavigation();
  const [showSettings, setShowSettings] = useState(false);
  
  const openEditTask = (task: Task) => {
    // Navigate to Tasks tab
    (navigation as any).navigate('Tasks');
  };
  const openEditEvent = (event: CalendarEvent) => {
    // Navigate to Calendar tab
    (navigation as any).navigate('Calendar');
  };

  const handleLogout = async () => {
    setShowSettings(false);
    await logout();
  };

  const handleDeleteAccount = () => {
    setShowSettings(false);
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all data. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount();
              Alert.alert('Account Deleted', 'Your account has been permanently deleted.');
            } catch (error) {
              Alert.alert('Error', (error as Error).message || 'Failed to delete account. Please try again.');
            }
          }
        },
      ]
    );
  };

  useEffect(() => {
    locationVM.fetchCurrentLocation();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      taskVM.reload();
      calendarVM.reload();
    }, [calendarVM.reload, taskVM.reload]),
  );

  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      taskVM.reload(),
      calendarVM.reload(),
      locationVM.fetchCurrentLocation(),
    ]);
    setRefreshing(false);
  };

  const today = todayString();
  const upcomingEvents = calendarVM.events
    .filter(e => e.date >= today)
    .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
  const activeTasks = taskVM.tasks
    .filter(task => !task.isCompleted)
    .sort((a, b) => {
      const aDue = `${a.dueDate ?? '9999-12-31'} ${a.dueTime ?? '23:59'}`;
      const bDue = `${b.dueDate ?? '9999-12-31'} ${b.dueTime ?? '23:59'}`;
      return aDue.localeCompare(bDue);
    })
    .slice(0, 3);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const handleTestNotification = async () => {
    const notificationId = await scheduleTestNotification();
    Alert.alert(
      notificationId ? 'Notification scheduled' : 'Notifications unavailable',
      notificationId
        ? 'A local test notification should appear in about 10 seconds.'
        : 'Allow notifications for Expo Go in your phone settings, then try again.',
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting()},</Text>
          <Text style={styles.username}>{user?.displayName ?? 'Planner'} 👋</Text>
        </View>
        <TouchableOpacity 
          onPress={() => setShowSettings(true)} 
          style={styles.settingsBtn} 
          accessibilityLabel="Settings"
        >
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Settings Dropdown */}
      {showSettings && (
        <View style={styles.settingsDropdown}>
          <TouchableOpacity style={styles.settingsOption} onPress={handleLogout}>
            <Text style={styles.settingsOptionText}>🚪 Logout</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingsOption} onPress={handleDeleteAccount}>
            <Text style={[styles.settingsOptionText, styles.deleteText]}>🗑️ Delete Account</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingsCancel} onPress={() => setShowSettings(false)}>
            <Text style={styles.settingsCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatCard icon="✅" label="Completed" value={taskVM.completedTasks.length} color={Colors.success} />
          <StatCard icon="⏳" label="Pending" value={taskVM.pendingTasks.length} color={Colors.warning} />
          <StatCard icon="🚨" label="Overdue" value={taskVM.overdueTasks.length} color={Colors.error} />
        </View>

        {/* Weather */}
        <SectionHeader title="Current Weather" />
        <WeatherWidget
          weather={locationVM.weather}
          isLoading={locationVM.isLoadingWeather}
          error={locationVM.weatherError}
          locationLabel={locationVM.locationLabel}
        />
        <TouchableOpacity style={styles.testNotificationBtn} onPress={handleTestNotification}>
          <Text style={styles.testNotificationText}>Test Notification</Text>
        </TouchableOpacity>

        {/* Upcoming events */}
        <SectionHeader title={`Upcoming Events (${upcomingEvents.length})`} />
        {upcomingEvents.length === 0 ? (
          <EmptyState icon="📅" message="No upcoming events" />
        ) : (
          upcomingEvents.slice(0, 3).map(event => (
            <EventCard
              key={event.id}
              event={event}
              onEdit={openEditEvent}
              onDelete={calendarVM.deleteEvent}
              canManage={event.userId === user?.id || !!user?.isAdmin}
              showCreator={event.userId !== user?.id}
            />
          ))
        )}

        {/* Upcoming tasks */}
        <SectionHeader title="Active Tasks" />
        {activeTasks.length === 0 ? (
          <EmptyState icon="🎉" message="You're all caught up!" />
        ) : (
          activeTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onToggleComplete={taskVM.toggleComplete}
              onEdit={openEditTask}
              onDelete={taskVM.deleteTask}
            />
          ))
        )}

        <View style={{ height: Spacing.xxxl }} />
      </ScrollView>
    </View>
  );
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  return (
    <View style={[statStyles.card, { borderColor: `${color}44` }]}>
      <Text style={statStyles.icon}>{icon}</Text>
      <Text style={[statStyles.value, { color }]}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1, backgroundColor: Colors.card, borderRadius: BorderRadius.md,
    padding: Spacing.md, alignItems: 'center', gap: 4,
    borderWidth: 1,
  },
  icon: { fontSize: 22 },
  value: { fontSize: Typography.fontSize.xl, fontWeight: '800' },
  label: { fontSize: Typography.fontSize.xs, color: Colors.textMuted },
});

function SectionHeader({ title }: { title: string }) {
  return <Text style={sectionStyles.header}>{title}</Text>;
}

const sectionStyles = StyleSheet.create({
  header: {
    fontSize: Typography.fontSize.md, fontWeight: '700', color: Colors.textPrimary,
    marginTop: Spacing.xl, marginBottom: Spacing.sm, paddingHorizontal: Spacing.base,
  },
});

function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <View style={emptyStyles.container}>
      <Text style={emptyStyles.icon}>{icon}</Text>
      <Text style={emptyStyles.text}>{message}</Text>
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  container: {
    alignItems: 'center', padding: Spacing.xl, marginHorizontal: Spacing.base,
    backgroundColor: Colors.card, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  icon: { fontSize: 36, marginBottom: Spacing.xs },
  text: { fontSize: Typography.fontSize.base, color: Colors.textMuted },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.base, paddingTop: Spacing.xl + 10, paddingBottom: Spacing.md,
  },
  greeting: { fontSize: Typography.fontSize.base, color: Colors.textSecondary },
  username: { fontSize: Typography.fontSize.xl, fontWeight: '800', color: Colors.textPrimary },
  settingsBtn: {
    backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.full,
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  settingsIcon: { fontSize: 18 },
  settingsDropdown: {
    position: 'absolute', top: 70, right: Spacing.base, backgroundColor: Colors.card,
    borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.xs, zIndex: 100, elevation: 10,
    minWidth: 150,
  },
  settingsOption: {
    padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  settingsOptionText: {
    fontSize: Typography.fontSize.base, color: Colors.textPrimary,
  },
  deleteText: {
    color: Colors.error,
  },
  settingsCancel: {
    padding: Spacing.md, alignItems: 'center',
  },
  settingsCancelText: {
    fontSize: Typography.fontSize.base, color: Colors.primary, fontWeight: '600',
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.xl },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  testNotificationBtn: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  testNotificationText: {
    color: Colors.primary,
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
  },
});
