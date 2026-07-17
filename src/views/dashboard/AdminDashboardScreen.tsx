/**
 * AdminDashboardScreen – Admin View
 * Shows all users, tasks, and events across the system.
 * Only accessible by admin users.
 */

import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, StatusBar, ActivityIndicator, Alert,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Colors, Spacing, BorderRadius, Typography } from '../../theme/theme';
import { getAdminStats, getAllUsers, getAllTasks, getAllEvents, AdminStats } from '../../services/apiService';
import { Task } from '../../models/Task';
import { CalendarEvent } from '../../models/Event';
import { User } from '../../models/User';

export default function AdminDashboardScreen() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<(User & { is_admin: boolean })[]>([]);
  const [tasks, setTasks] = useState<(Task & { user_email: string; user_username: string })[]>([]);
  const [events, setEvents] = useState<(CalendarEvent & { user_email: string; user_username: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'stats' | 'users' | 'tasks' | 'events'>('stats');

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [statsData, usersData, tasksData, eventsData] = await Promise.all([
        getAdminStats(),
        getAllUsers(),
        getAllTasks(),
        getAllEvents(),
      ]);
      setStats(statsData);
      setUsers(usersData);
      setTasks(tasksData);
      setEvents(eventsData);
    } catch (error) {
      Alert.alert('Error', 'Failed to load admin data: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAdminData();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading admin data...</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Admin Panel</Text>
          <Text style={styles.subtitle}>Welcome, {user?.displayName ?? 'Admin'} 👋</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn} accessibilityLabel="Logout">
          <Text style={styles.logoutIcon}>🚪</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        {(['stats', 'users', 'tasks', 'events'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'stats' && stats && (
          <View style={styles.statsContainer}>
            <StatCard icon="👥" label="Total Users" value={stats.totalUsers} color={Colors.primary} />
            <StatCard icon="📋" label="Total Tasks" value={stats.totalTasks} color={Colors.warning} />
            <StatCard icon="✅" label="Completed" value={stats.completedTasks} color={Colors.success} />
            <StatCard icon="📅" label="Total Events" value={stats.totalEvents} color={Colors.info} />
          </View>
        )}

        {activeTab === 'users' && (
          <View>
            <Text style={styles.sectionTitle}>All Users ({users.length})</Text>
            {users.length === 0 ? (
              <EmptyState icon="👤" message="No users found" />
            ) : (
              users.map(u => (
                <UserCard key={u.id} user={u} />
              ))
            )}
          </View>
        )}

        {activeTab === 'tasks' && (
          <View>
            <Text style={styles.sectionTitle}>All Tasks ({tasks.length})</Text>
            {tasks.length === 0 ? (
              <EmptyState icon="📋" message="No tasks found" />
            ) : (
              tasks.map(t => (
                <TaskItem key={t.id} task={t} />
              ))
            )}
          </View>
        )}

        {activeTab === 'events' && (
          <View>
            <Text style={styles.sectionTitle}>All Events ({events.length})</Text>
            {events.length === 0 ? (
              <EmptyState icon="📅" message="No events found" />
            ) : (
              events.map(e => (
                <EventItem key={e.id} event={e} />
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  return (
    <View style={[statStyles.card, { borderColor: `${color}44`, backgroundColor: Colors.card }]}>
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
  icon: { fontSize: 24 },
  value: { fontSize: Typography.fontSize.xxl, fontWeight: '800' },
  label: { fontSize: Typography.fontSize.xs, color: Colors.textMuted },
});

function UserCard({ user }: { user: User & { is_admin: boolean } }) {
  return (
    <View style={[userStyles.card, { backgroundColor: Colors.card, borderColor: Colors.border }]}>
      <View style={userStyles.info}>
        <Text style={userStyles.name}>{user.displayName || user.username}</Text>
        <Text style={userStyles.email}>{user.email}</Text>
      </View>
      {user.is_admin && (
        <View style={userStyles.adminBadge}>
          <Text style={userStyles.adminText}>Admin</Text>
        </View>
      )}
    </View>
  );
}

const userStyles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.md, marginHorizontal: Spacing.base, marginVertical: 4,
    borderRadius: BorderRadius.md, borderWidth: 1,
  },
  info: { flex: 1 },
  name: { fontSize: Typography.fontSize.base, fontWeight: '600', color: Colors.textPrimary },
  email: { fontSize: Typography.fontSize.sm, color: Colors.textMuted },
  adminBadge: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full },
  adminText: { fontSize: Typography.fontSize.xs, color: Colors.textOnPrimary, fontWeight: '700' },
});

function TaskItem({ task }: { task: Task & { user_email: string; user_username: string } }) {
  return (
    <View style={[taskStyles.card, { backgroundColor: Colors.card, borderColor: Colors.border }]}>
      <Text style={taskStyles.title}>{task.title}</Text>
      <Text style={taskStyles.user}>By: {task.user_username || task.user_email}</Text>
      <View style={[taskStyles.badge, { backgroundColor: task.isCompleted ? Colors.success : Colors.warning }]}>
        <Text style={taskStyles.badgeText}>{task.isCompleted ? 'Done' : 'Pending'}</Text>
      </View>
    </View>
  );
}

const taskStyles = StyleSheet.create({
  card: {
    padding: Spacing.md, marginHorizontal: Spacing.base, marginVertical: 4,
    borderRadius: BorderRadius.md, borderWidth: 1,
  },
  title: { fontSize: Typography.fontSize.base, fontWeight: '600', color: Colors.textPrimary },
  user: { fontSize: Typography.fontSize.sm, color: Colors.textMuted },
  badge: {
    alignSelf: 'flex-start', paddingHorizontal: Spacing.sm, paddingVertical: 2,
    borderRadius: BorderRadius.full, marginTop: Spacing.xs,
  },
  badgeText: { fontSize: Typography.fontSize.xs, color: Colors.textOnPrimary },
});

function EventItem({ event }: { event: CalendarEvent & { user_email: string; user_username: string } }) {
  return (
    <View style={[eventStyles.card, { backgroundColor: Colors.card, borderColor: Colors.border }]}>
      <Text style={eventStyles.title}>{event.title}</Text>
      <Text style={eventStyles.user}>By: {event.user_username || event.user_email}</Text>
      <Text style={eventStyles.date}>{event.date} | {event.startTime} - {event.endTime}</Text>
    </View>
  );
}

const eventStyles = StyleSheet.create({
  card: {
    padding: Spacing.md, marginHorizontal: Spacing.base, marginVertical: 4,
    borderRadius: BorderRadius.md, borderWidth: 1,
  },
  title: { fontSize: Typography.fontSize.base, fontWeight: '600', color: Colors.textPrimary },
  user: { fontSize: Typography.fontSize.sm, color: Colors.textMuted },
  date: { fontSize: Typography.fontSize.xs, color: Colors.textMuted, marginTop: 2 },
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
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  loadingText: { marginTop: Spacing.md, color: Colors.textMuted, fontSize: Typography.fontSize.base },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.base, paddingTop: Spacing.xl + 10, paddingBottom: Spacing.md,
  },
  title: { fontSize: Typography.fontSize.xl, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: Typography.fontSize.base, color: Colors.textSecondary },
  logoutBtn: {
    backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.full,
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  logoutIcon: { fontSize: 18 },
  tabContainer: {
    flexDirection: 'row', paddingHorizontal: Spacing.base, gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  tab: {
    flex: 1, paddingVertical: Spacing.sm, alignItems: 'center',
    backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontSize: Typography.fontSize.sm, color: Colors.textMuted },
  tabTextActive: { color: Colors.textOnPrimary, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.xl },
  statsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
  sectionTitle: {
    fontSize: Typography.fontSize.md, fontWeight: '700', color: Colors.textPrimary,
    marginTop: Spacing.xl, marginBottom: Spacing.sm, paddingHorizontal: Spacing.base,
  },
});