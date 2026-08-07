/**
 * CalendarScreen – Calendar Module View
 * Visual calendar with marked dates, event list for selected day, and add-event modal.
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal,
  TextInput, Alert, ActivityIndicator, StatusBar,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import { usePlanner } from '../../context/PlannerContext';
import { useLocationViewModel } from '../../viewmodels/useLocationViewModel';
import EventCard from '../components/EventCard';
import LocationPicker from '../components/LocationPicker';
import { CalendarEvent, CreateEventPayload, EventColor } from '../../models/Event';
import { Colors, Spacing, BorderRadius, Typography } from '../../theme/theme';
import { todayString } from '../../utils/dateUtils';

const EVENT_COLORS: EventColor[] = ['#6C63FF', '#FF6584', '#43C6AC', '#F7971E', '#56CCF2'];

export default function CalendarScreen() {
  const { calendarVM: vm } = usePlanner();
  const locVM = useLocationViewModel();

  const [modalVisible, setModalVisible] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  // Form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState<EventColor>('#6C63FF');
  const [isAllDay, setIsAllDay] = useState(false);
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date(Date.now() + 60 * 60 * 1000));
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      vm.reload();
    }, [vm.reload]),
  );

  const openCreateModal = () => {
    setEditingEvent(null);
    setTitle(''); setDescription(''); setColor('#6C63FF');
    setIsAllDay(false);
    // Set start time to next hour
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    setStartTime(oneHourLater);
    setEndTime(new Date(now.getTime() + 2 * 60 * 60 * 1000));
    locVM.setSelectedMapLocation(null); setShowLocationPicker(false);
    setModalVisible(true);
  };

  const openEditModal = (event: CalendarEvent) => {
    setEditingEvent(event);
    setTitle(event.title);
    setDescription(event.description);
    setColor(event.color);
    setIsAllDay(event.isAllDay);
    // Parse the HH:MM string as a local-time Date so the time picker shows
    // the same hour the user originally picked (no UTC shift).
    const [sh, sm] = event.startTime.split(':').map(Number);
    const [eh, em] = event.endTime.split(':').map(Number);
    setStartTime(new Date(2000, 0, 1, sh, sm));
    setEndTime(new Date(2000, 0, 1, eh, em));
    locVM.setSelectedMapLocation(event.location);
    setShowLocationPicker(!!event.location);
    setModalVisible(true);
  };

  const openModal = openCreateModal;

  const fmt = (d: Date) => `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;

  const handleSave = async () => {
    if (!title.trim()) { Alert.alert('Error', 'Title is required'); return; }
    try {
      const payload: CreateEventPayload = {
        title: title.trim(), description: description.trim(),
        date: vm.selectedDate, color, isAllDay,
        startTime: fmt(startTime), endTime: fmt(endTime),
        location: showLocationPicker ? locVM.selectedMapLocation : null,
      };
      if (editingEvent) {
        await vm.updateEvent(editingEvent.id, payload);
      } else {
        await vm.createEvent(payload);
      }
      setModalVisible(false);
    } catch (e) {
      Alert.alert('Error', (e as Error).message || 'Failed to save event');
    }
  };

  const handleDeleteEvent = (id: string) => {
    Alert.alert('Delete Event', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => vm.deleteEvent(id) },
    ]);
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      <View style={styles.header}>
        <Text style={styles.screenTitle}>Calendar</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openModal} accessibilityLabel="Add event">
          <Text style={styles.addBtnText}>+ Event</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Calendar */}
        <Calendar
          current={vm.selectedDate}
          onDayPress={day => vm.setSelectedDate(day.dateString)}
          markedDates={vm.markedDates}
          minDate={todayString()}
          theme={{
            backgroundColor: Colors.background,
            calendarBackground: Colors.card,
            textSectionTitleColor: Colors.textSecondary,
            selectedDayBackgroundColor: Colors.primary,
            selectedDayTextColor: '#fff',
            todayTextColor: Colors.primary,
            dayTextColor: Colors.textPrimary,
            textDisabledColor: Colors.textMuted,
            dotColor: Colors.primary,
            selectedDotColor: '#fff',
            arrowColor: Colors.primary,
            monthTextColor: Colors.textPrimary,
            indicatorColor: Colors.primary,
            textDayFontWeight: '500',
            textMonthFontWeight: '700',
            textDayHeaderFontWeight: '600',
          }}
          style={styles.calendar}
        />

        {/* Selected date events */}
        <View style={styles.eventsSection}>
          <View style={styles.eventsSectionHeader}>
            <Text style={styles.eventsSectionTitle}>
              {new Date(vm.selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{vm.eventsForSelectedDate.length}</Text>
            </View>
          </View>

          {vm.isLoading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xl }} />
          ) : vm.error ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{vm.error}</Text>
              <TouchableOpacity style={styles.emptyAddBtn} onPress={vm.reload}>
                <Text style={styles.emptyAddText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : vm.eventsForSelectedDate.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📅</Text>
              <Text style={styles.emptyText}>No events for this day</Text>
              <TouchableOpacity style={styles.emptyAddBtn} onPress={openModal}>
                <Text style={styles.emptyAddText}>Add Event</Text>
              </TouchableOpacity>
            </View>
          ) : (
            vm.eventsForSelectedDate.map(event => (
              <EventCard key={event.id} event={event} onEdit={openEditModal} onDelete={vm.deleteEvent} />
            ))
          )}
        </View>
      </ScrollView>

      {/* Add Event Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView style={styles.modal} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editingEvent ? 'Edit Event' : 'New Event'}</Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={styles.modalSave}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>Title *</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Event title" placeholderTextColor={Colors.textMuted} accessibilityLabel="Event title input" />

            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} placeholder="Optional notes" placeholderTextColor={Colors.textMuted} multiline numberOfLines={3} />

            {/* Color picker */}
            <Text style={styles.fieldLabel}>Color</Text>
            <View style={styles.colorRow}>
              {EVENT_COLORS.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.colorDot, { backgroundColor: c }, color === c && styles.colorDotSelected]}
                  onPress={() => setColor(c)}
                />
              ))}
            </View>

            {/* All day toggle */}
            <TouchableOpacity style={styles.toggleRow} onPress={() => setIsAllDay(v => !v)}>
              <Text style={styles.fieldLabel}>All Day</Text>
              <View style={[styles.toggle, isAllDay && styles.toggleOn]}>
                <View style={[styles.toggleThumb, isAllDay && styles.toggleThumbOn]} />
              </View>
            </TouchableOpacity>

            {!isAllDay && (
              <>
                <Text style={styles.fieldLabel}>Start Time</Text>
                <TouchableOpacity style={styles.timeBtn} onPress={() => setShowStartPicker(true)}>
                  <Text style={styles.timeBtnText}>{fmt(startTime)}</Text>
                </TouchableOpacity>
                 {showStartPicker && (
                   <DateTimePicker
                     value={startTime}
                     mode="time"
                     display="spinner"
                     onChange={(_, d) => {
                       setShowStartPicker(false);
                       if (d) {
                         // If selecting time for today, check if it's in the past
                         if (vm.selectedDate === todayString()) {
                           const [hours, minutes] = [d.getHours(), d.getMinutes()];
                           const now = new Date();
                           const selectedTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
                           if (selectedTime < now) {
                             Alert.alert('Error', 'Cannot select a time that has already passed today.');
                             return;
                           }
                         }
                         setStartTime(d);
                       }
                     }}
                     themeVariant="dark"
                   />
                 )}

                <Text style={styles.fieldLabel}>End Time</Text>
                <TouchableOpacity style={styles.timeBtn} onPress={() => setShowEndPicker(true)}>
                  <Text style={styles.timeBtnText}>{fmt(endTime)}</Text>
                </TouchableOpacity>
                {showEndPicker && (
                  <DateTimePicker
                    value={endTime}
                    mode="time"
                    display="spinner"
                    onChange={(_, d) => {
                      setShowEndPicker(false);
                      if (d) {
                        // If selecting time for today, check if it's in the past
                        if (vm.selectedDate === todayString()) {
                          const [hours, minutes] = [d.getHours(), d.getMinutes()];
                          const now = new Date();
                          const selectedTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
                          if (selectedTime < now) {
                            Alert.alert('Error', 'Cannot select a time that has already passed today.');
                            return;
                          }
                        }
                        // Check if end time is after start time
                        const startTimeStr = fmt(startTime);
                        const endTimeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
                        if (endTimeStr <= startTimeStr) {
                          Alert.alert('Error', 'End time must be after start time.');
                          return;
                        }
                        setEndTime(d);
                      }
                    }}
                    themeVariant="dark"
                  />
                )}
              </>
            )}

            {/* Location */}
            <TouchableOpacity style={styles.locationToggle} onPress={() => setShowLocationPicker(v => !v)}>
              <Text style={styles.locationToggleText}>
                {showLocationPicker ? '🗺️ Hide Location' : '📍 Add Location'}
              </Text>
            </TouchableOpacity>

            {showLocationPicker && (
              <LocationPicker
                location={locVM.selectedMapLocation}
                onPickLocation={locVM.setSelectedMapLocation}
                onUseCurrentLocation={async () => {
                  const location = await locVM.fetchCurrentLocation();
                  if (location) locVM.setSelectedMapLocation(location);
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.base, paddingTop: Spacing.xl },
  screenTitle: { fontSize: Typography.fontSize.xxl, fontWeight: '800', color: Colors.textPrimary },
  addBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.base, paddingVertical: Spacing.xs },
  addBtnText: { color: Colors.textOnPrimary, fontWeight: '700', fontSize: Typography.fontSize.base },
  calendar: { borderRadius: BorderRadius.lg, overflow: 'hidden', marginHorizontal: Spacing.base, marginBottom: Spacing.md },
  eventsSection: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.xxxl },
  eventsSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  eventsSectionTitle: { fontSize: Typography.fontSize.md, fontWeight: '700', color: Colors.textPrimary },
  countBadge: { backgroundColor: Colors.primary, borderRadius: BorderRadius.full, paddingHorizontal: 10, paddingVertical: 2 },
  countText: { color: '#fff', fontSize: Typography.fontSize.sm, fontWeight: '700' },
  empty: { alignItems: 'center', padding: Spacing.xxl, backgroundColor: Colors.card, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm },
  emptyIcon: { fontSize: 40 },
  emptyText: { fontSize: Typography.fontSize.base, color: Colors.textMuted },
  emptyAddBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.xs },
  emptyAddText: { color: '#fff', fontWeight: '600' },
  // Modal
  modal: { flex: 1, backgroundColor: Colors.background },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.base, borderBottomWidth: 1, borderColor: Colors.border },
  modalTitle: { fontSize: Typography.fontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  modalCancel: { color: Colors.textSecondary, fontSize: Typography.fontSize.base },
  modalSave: { color: Colors.primary, fontSize: Typography.fontSize.base, fontWeight: '700' },
  modalBody: { padding: Spacing.base },
  fieldLabel: { fontSize: Typography.fontSize.sm, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.xs, marginTop: Spacing.md },
  input: { backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontSize: Typography.fontSize.md, color: Colors.textPrimary },
  textArea: { height: 80, textAlignVertical: 'top' },
  colorRow: { flexDirection: 'row', gap: Spacing.md, paddingVertical: Spacing.xs },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  colorDotSelected: { borderWidth: 3, borderColor: '#fff', transform: [{ scale: 1.2 }] },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.md },
  toggle: { width: 48, height: 28, borderRadius: 14, backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', padding: 2 },
  toggleOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.textMuted },
  toggleThumbOn: { backgroundColor: '#fff', alignSelf: 'flex-end' },
  timeBtn: { backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, alignItems: 'center' },
  timeBtnText: { color: Colors.textPrimary, fontSize: Typography.fontSize.md, fontWeight: '600' },
  locationToggle: { backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.borderLight, padding: Spacing.md, alignItems: 'center', marginTop: Spacing.md },
  locationToggleText: { color: Colors.primary, fontWeight: '600', fontSize: Typography.fontSize.base },
});
