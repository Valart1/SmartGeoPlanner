/**
 * DashboardScreen – Main View
 * Summary screen: weather widget, task stats, upcoming events.
 * Consumes location, task, and calendar ViewModels.
 */

import React, { useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, StatusBar,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTaskViewModel } from '../../viewmodels/useTaskViewModel';
import { useCalendarViewModel } from '../../viewmodels/useCalendarViewModel';
import { useLocationViewModel } from '../../viewmodels/useLocationViewModel';
import WeatherWidget from '../components/WeatherWidget';
import TaskCard from '../components/TaskCard';
import EventCard from '../components/EventCard';
import { Colors, Spacing, BorderRadius, Typography } from '../../theme/theme';

export default function DashboardScreen() {
  const { user, logout } = useAuth();
  const taskVM = useTaskViewModel(user?.id ?? '');
  const calendarVM = useCalendarViewModel(user?.id ?? '');
  const locationVM = useLocationViewModel();

  useEffect(() => {
    locationVM.fetchCurrentLocation();
  }, []);

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

  const today = new Date().toISOString().split('T')[0];
  const todayEvents = calendarVM.events.filter(e => e.date === today)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const upcomingTasks = taskVM.pendingTasks.slice(0, 3);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
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
        <TouchableOpacity onPress={logout} style={styles.logoutBtn} accessibilityLabel="Logout">
          <Text style={styles.logoutIcon}>⏻</Text>
        </TouchableOpacity>
      </View>

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

        {/* Today's events */}
        <SectionHeader title={`Today's Events (${todayEvents.length})`} />
        {todayEvents.length === 0 ? (
          <EmptyState icon="📅" message="No events scheduled for today" />
        ) : (
          todayEvents.map(event => (
            <EventCard key={event.id} event={event} />
          ))
        )}

        {/* Upcoming tasks */}
        <SectionHeader title="Upcoming Tasks" />
        {upcomingTasks.length === 0 ? (
          <EmptyState icon="🎉" message="You're all caught up!" />
        ) : (
          upcomingTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onToggleComplete={taskVM.toggleComplete}
              onEdit={() => {}}
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
    paddingHorizontal: Spacing.base, paddingTop: Spacing.xl, paddingBottom: Spacing.md,
  },
  greeting: { fontSize: Typography.fontSize.base, color: Colors.textSecondary },
  username: { fontSize: Typography.fontSize.xl, fontWeight: '800', color: Colors.textPrimary },
  logoutBtn: {
    backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.full,
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  logoutIcon: { fontSize: 18 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.xl },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
});
