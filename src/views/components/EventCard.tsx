/**
 * EventCard – Presentational component
 * Displays a single calendar event with time, color, and location info.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CalendarEvent } from '../../models/Event';
import { Colors, Spacing, BorderRadius, Typography } from '../../theme/theme';

interface EventCardProps {
  event: CalendarEvent;
  onPress?: (event: CalendarEvent) => void;
  onEdit?: (event: CalendarEvent) => void;
  onDelete?: (id: string) => void;
  /** Whether the current user may edit/delete this event (creator or admin). Defaults to true. */
  canManage?: boolean;
  /** Show a "created by" chip (used for events created by other users). */
  showCreator?: boolean;
}

export default function EventCard({
  event,
  onPress,
  onEdit,
  onDelete,
  canManage = true,
  showCreator = false,
}: EventCardProps) {
  return (
    <View style={styles.card}>
      {/* Left accent bar in event color */}
      <View style={[styles.accentBar, { backgroundColor: event.color }]} />

      <View style={styles.content}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => onPress?.(event)} activeOpacity={0.8} style={styles.titleTouchable}>
            <Text style={styles.title} numberOfLines={1}>{event.title}</Text>
          </TouchableOpacity>
          {onEdit && canManage && (
            <TouchableOpacity
              onPress={() => onEdit(event)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel={`Edit event ${event.title}`}
              style={styles.actionBtn}
            >
              <Text style={styles.actionIcon}>✏️</Text>
            </TouchableOpacity>
          )}
          {onDelete && canManage && (
            <TouchableOpacity
              onPress={() => onDelete(event.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel={`Delete event ${event.title}`}
              style={styles.actionBtn}
            >
              <Text style={styles.actionIcon}>🗑️</Text>
            </TouchableOpacity>
          )}
        </View>

        {!!event.description && (
          <Text style={styles.description} numberOfLines={1}>
            {event.description}
          </Text>
        )}

        <View style={styles.metaRow}>
          {!event.isAllDay ? (
            <View style={[styles.chip, { borderColor: event.color }]}>
              <Text style={[styles.chipText, { color: event.color }]}>
                {event.startTime} – {event.endTime}
              </Text>
            </View>
          ) : (
            <View style={[styles.chip, { borderColor: event.color }]}>
              <Text style={[styles.chipText, { color: event.color }]}>All Day</Text>
            </View>
          )}

          {event.location && (
            <View style={styles.locationChip}>
              <Text style={styles.locationText}>
                📍 {event.location.city ?? 'Location set'}
              </Text>
            </View>
          )}

          {showCreator && !!event.creatorUsername && (
            <View style={styles.creatorChip}>
              <Text style={styles.creatorText}>
                👤 {event.creatorUsername}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    marginVertical: Spacing.xs,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  accentBar: {
    width: 5,
  },
  content: {
    flex: 1,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleTouchable: {
    flex: 1,
  },
  title: {
    fontSize: Typography.fontSize.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  actionBtn: {
    padding: 4,
  },
  actionIcon: {
    fontSize: 16,
  },
  description: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  metaRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  chip: {
    borderWidth: 1,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  chipText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '600',
  },
  locationChip: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  locationText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
  },
  creatorChip: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  creatorText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
  },
});
