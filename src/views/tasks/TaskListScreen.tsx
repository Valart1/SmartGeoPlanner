/**
 * TaskListScreen – Task Module View
 * Lists all tasks grouped by status, supports filtering and add/edit via modal.
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, Modal,
  TextInput, ScrollView, ActivityIndicator, Alert, StatusBar,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../../context/AuthContext';
import { useTaskViewModel } from '../../viewmodels/useTaskViewModel';
import { useLocationViewModel } from '../../viewmodels/useLocationViewModel';
import TaskCard from '../components/TaskCard';
import LocationPicker from '../components/LocationPicker';
import { Task, CreateTaskPayload, TaskPriority } from '../../models/Task';
import { Colors, Spacing, BorderRadius, Typography } from '../../theme/theme';

type FilterType = 'all' | 'pending' | 'completed' | 'overdue';

const PRIORITY_OPTIONS: TaskPriority[] = ['low', 'medium', 'high'];
const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: Colors.accent, medium: Colors.warning, high: Colors.error,
};

export default function TaskListScreen() {
  const { user } = useAuth();
  const vm = useTaskViewModel(user?.id ?? '');
  const locVM = useLocationViewModel();

  const [filter, setFilter] = useState<FilterType>('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const openCreateModal = () => {
    setEditingTask(null);
    setTitle(''); setDescription(''); setPriority('medium'); setDueDate(null);
    locVM.setSelectedMapLocation(null);
    setShowLocationPicker(false);
    setModalVisible(true);
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setTitle(task.title); setDescription(task.description); setPriority(task.priority);
    setDueDate(task.dueDate ? new Date(task.dueDate) : null);
    locVM.setSelectedMapLocation(task.location);
    setShowLocationPicker(!!task.location);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!title.trim()) { Alert.alert('Error', 'Title is required'); return; }
    const dueDateStr = dueDate ? dueDate.toISOString().split('T')[0] : null;
    const dueTimeStr = dueDate
      ? `${dueDate.getHours().toString().padStart(2, '0')}:${dueDate.getMinutes().toString().padStart(2, '0')}`
      : null;

    const payload: CreateTaskPayload = {
      title: title.trim(), description: description.trim(),
      priority, status: 'pending', isCompleted: false,
      dueDate: dueDateStr, dueTime: dueTimeStr,
      location: showLocationPicker ? locVM.selectedMapLocation : null,
    };

    if (editingTask) {
      await vm.updateTask(editingTask.id, payload);
    } else {
      await vm.createTask(payload);
    }
    setModalVisible(false);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Task', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => vm.deleteTask(id) },
    ]);
  };

  const filteredTasks = (() => {
    switch (filter) {
      case 'pending': return vm.pendingTasks;
      case 'completed': return vm.completedTasks;
      case 'overdue': return vm.overdueTasks;
      default: return vm.tasks;
    }
  })();

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.screenTitle}>My Tasks</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openCreateModal} accessibilityLabel="Add task">
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Filter tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar} contentContainerStyle={styles.filterContent}>
        {(['all', 'pending', 'overdue', 'completed'] as FilterType[]).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Task list */}
      {vm.isLoading ? (
        <ActivityIndicator style={{ marginTop: Spacing.xxxl }} color={Colors.primary} />
      ) : (
        <FlatList
          data={filteredTasks}
          keyExtractor={t => t.id}
          renderItem={({ item }) => (
            <TaskCard
              task={item}
              onToggleComplete={vm.toggleComplete}
              onEdit={openEditModal}
              onDelete={handleDelete}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyText}>No {filter} tasks</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 80 }}
        />
      )}

      {/* Add/Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView style={styles.modal} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editingTask ? 'Edit Task' : 'New Task'}</Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={styles.modalSave}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            <FormField label="Title *">
              <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Task title" placeholderTextColor={Colors.textMuted} accessibilityLabel="Task title input" />
            </FormField>

            <FormField label="Description">
              <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} placeholder="Optional description" placeholderTextColor={Colors.textMuted} multiline numberOfLines={3} accessibilityLabel="Task description input" />
            </FormField>

            {/* Priority */}
            <FormField label="Priority">
              <View style={styles.priorityRow}>
                {PRIORITY_OPTIONS.map(p => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.priorityBtn, priority === p && { backgroundColor: PRIORITY_COLORS[p], borderColor: PRIORITY_COLORS[p] }]}
                    onPress={() => setPriority(p)}
                  >
                    <Text style={[styles.priorityBtnText, priority === p && styles.priorityBtnTextActive]}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </FormField>

            {/* Due Date/Time */}
            <FormField label="Due Date & Time">
              <View style={styles.dateRow}>
                <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDatePicker(true)}>
                  <Text style={styles.dateBtnText}>{dueDate ? dueDate.toLocaleDateString() : 'Select date'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dateBtn} onPress={() => setShowTimePicker(true)}>
                  <Text style={styles.dateBtnText}>
                    {dueDate ? `${dueDate.getHours().toString().padStart(2, '0')}:${dueDate.getMinutes().toString().padStart(2, '0')}` : 'Select time'}
                  </Text>
                </TouchableOpacity>
                {dueDate && (
                  <TouchableOpacity onPress={() => setDueDate(null)} style={styles.clearDate}>
                    <Text style={styles.clearDateText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            </FormField>

            {showDatePicker && (
              <DateTimePicker
                value={dueDate ?? new Date()}
                mode="date"
                display="spinner"
                onChange={(_, date) => { setShowDatePicker(false); if (date) setDueDate(d => d ? new Date(date.getFullYear(), date.getMonth(), date.getDate(), d.getHours(), d.getMinutes()) : date); }}
                minimumDate={new Date()}
                themeVariant="dark"
              />
            )}
            {showTimePicker && (
              <DateTimePicker
                value={dueDate ?? new Date()}
                mode="time"
                display="spinner"
                onChange={(_, date) => { setShowTimePicker(false); if (date) setDueDate(d => d ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), date.getHours(), date.getMinutes()) : date); }}
                themeVariant="dark"
              />
            )}

            {/* Location */}
            <FormField label="">
              <TouchableOpacity style={styles.locationToggle} onPress={() => setShowLocationPicker(v => !v)}>
                <Text style={styles.locationToggleText}>
                  {showLocationPicker ? '🗺️ Hide Location Picker' : '📍 Add Location'}
                </Text>
              </TouchableOpacity>
            </FormField>

            {showLocationPicker && (
              <LocationPicker
                location={locVM.selectedMapLocation}
                onPickLocation={locVM.setSelectedMapLocation}
                onUseCurrentLocation={async () => {
                  await locVM.fetchCurrentLocation();
                  if (locVM.currentLocation) locVM.setSelectedMapLocation(locVM.currentLocation);
                }}
                onClearLocation={() => locVM.setSelectedMapLocation(null)}
                isLoading={locVM.isLoadingLocation}
              />
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={fieldStyles.field}>
      {!!label && <Text style={fieldStyles.label}>{label}</Text>}
      {children}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  field: { marginBottom: Spacing.md },
  label: { fontSize: Typography.fontSize.sm, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.xs },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.base, paddingTop: Spacing.xl },
  screenTitle: { fontSize: Typography.fontSize.xxl, fontWeight: '800', color: Colors.textPrimary },
  addBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.base, paddingVertical: Spacing.xs },
  addBtnText: { color: Colors.textOnPrimary, fontWeight: '700', fontSize: Typography.fontSize.base },
  filterBar: { maxHeight: 48 },
  filterContent: { paddingHorizontal: Spacing.base, gap: Spacing.xs, paddingBottom: Spacing.sm },
  filterTab: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card },
  filterTabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterTabText: { color: Colors.textSecondary, fontSize: Typography.fontSize.sm, fontWeight: '500' },
  filterTabTextActive: { color: Colors.textOnPrimary, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: Spacing.xxxl },
  emptyIcon: { fontSize: 48, marginBottom: Spacing.md },
  emptyText: { fontSize: Typography.fontSize.base, color: Colors.textMuted },
  // Modal
  modal: { flex: 1, backgroundColor: Colors.background },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.base, borderBottomWidth: 1, borderColor: Colors.border },
  modalTitle: { fontSize: Typography.fontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  modalCancel: { color: Colors.textSecondary, fontSize: Typography.fontSize.base },
  modalSave: { color: Colors.primary, fontSize: Typography.fontSize.base, fontWeight: '700' },
  modalBody: { padding: Spacing.base },
  input: { backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontSize: Typography.fontSize.md, color: Colors.textPrimary },
  textArea: { height: 80, textAlignVertical: 'top' },
  priorityRow: { flexDirection: 'row', gap: Spacing.sm },
  priorityBtn: { flex: 1, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surfaceElevated },
  priorityBtnText: { color: Colors.textSecondary, fontWeight: '600', fontSize: Typography.fontSize.sm },
  priorityBtnTextActive: { color: '#fff' },
  dateRow: { flexDirection: 'row', gap: Spacing.xs, alignItems: 'center' },
  dateBtn: { flex: 1, backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, alignItems: 'center' },
  dateBtnText: { color: Colors.textPrimary, fontSize: Typography.fontSize.base },
  clearDate: { padding: Spacing.xs },
  clearDateText: { color: Colors.error, fontSize: 16 },
  locationToggle: { backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.borderLight, padding: Spacing.md, alignItems: 'center' },
  locationToggleText: { color: Colors.primary, fontWeight: '600', fontSize: Typography.fontSize.base },
});
