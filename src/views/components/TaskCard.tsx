/**
 * TaskCard – Presentational component
 * Displays a single task with priority badge, completion toggle, and action buttons.
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Task } from '../../models/Task';
import { Colors, Spacing, BorderRadius, Typography } from '../../theme/theme';

interface TaskCardProps {
  task: Task;
  onToggleComplete: (id: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
}

const PRIORITY_COLORS: Record<Task['priority'], string> = {
  low: Colors.accent,
  medium: Colors.warning,
  high: Colors.error,
};

const PRIORITY_LABELS: Record<Task['priority'], string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

export default function TaskCard({ task, onToggleComplete, onEdit, onDelete }: TaskCardProps) {
  const priorityColor = PRIORITY_COLORS[task.priority];

  const formatDueDate = (date: string | null, time: string | null): string => {
    if (!date) return '';
    const d = new Date(date);
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return time ? `${dateStr} at ${time}` : dateStr;
  };

  return (
    <View style={[styles.card, task.isCompleted && styles.cardCompleted]}>
      {/* Priority bar */}
      <View style={[styles.priorityBar, { backgroundColor: priorityColor }]} />

      <View style={styles.content}>
        {/* Header row */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={[styles.checkbox, task.isCompleted && styles.checkboxChecked]}
            onPress={() => onToggleComplete(task.id)}
            activeOpacity={0.7}
            accessibilityLabel={`Toggle task ${task.title}`}
          >
            {task.isCompleted && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>

          <View style={styles.titleArea}>
            <Text
              style={[styles.title, task.isCompleted && styles.titleCompleted]}
              numberOfLines={2}
            >
              {task.title}
            </Text>
            <View style={styles.badges}>
              <View style={[styles.badge, { backgroundColor: `${priorityColor}22` }]}>
                <Text style={[styles.badgeText, { color: priorityColor }]}>
                  {PRIORITY_LABELS[task.priority]}
                </Text>
              </View>
              {task.location && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>📍 {task.location.city ?? 'Location'}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              onPress={() => onEdit(task)}
              style={styles.actionBtn}
              accessibilityLabel={`Edit task ${task.title}`}
            >
              <Text style={styles.actionIcon}>✏️</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onDelete(task.id)}
              style={styles.actionBtn}
              accessibilityLabel={`Delete task ${task.title}`}
            >
              <Text style={styles.actionIcon}>🗑️</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Description */}
        {!!task.description && (
          <Text style={styles.description} numberOfLines={2}>
            {task.description}
          </Text>
        )}

        {/* Due date */}
        {task.dueDate && (
          <View style={styles.dueRow}>
            <Text style={styles.dueIcon}>🕐</Text>
            <Text style={[styles.dueText, task.isCompleted && styles.textMuted]}>
              {formatDueDate(task.dueDate, task.dueTime)}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    marginHorizontal: Spacing.base,
    marginVertical: Spacing.xs,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardCompleted: {
    opacity: 0.65,
  },
  priorityBar: {
    width: 4,
  },
  content: {
    flex: 1,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
  },
  checkmark: {
    color: Colors.textOnPrimary,
    fontSize: 12,
    fontWeight: 'bold',
  },
  titleArea: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: Typography.fontSize.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  titleCompleted: {
    textDecorationLine: 'line-through',
    color: Colors.textMuted,
  },
  badges: {
    flexDirection: 'row',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  badge: {
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  badgeText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    gap: 4,
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
    lineHeight: 18,
  },
  dueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  dueIcon: {
    fontSize: 12,
  },
  dueText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
    fontWeight: '500',
  },
  textMuted: {
    color: Colors.textMuted,
  },
});
