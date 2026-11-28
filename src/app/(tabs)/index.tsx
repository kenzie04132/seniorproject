import { router } from 'expo-router';
import { signOut } from 'firebase/auth';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TestDataButtons } from '@/components/test-data-buttons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { auth } from '@/lib/firebase';
import {
  capitalize,
  CATEGORIES,
  CATEGORY_EMOJI,
  categoryLabel,
  daysUntil,
  expiryColor,
  expiryLabel,
  usePantryItems,
} from '@/lib/pantry';
import { Category, PantryItem } from '@/types/models';

export default function PantryScreen() {
  const { user } = useAuth();
  const { items, loading, error } = usePantryItems(user?.uid);
  const [filter, setFilter] = useState<Category | 'all'>('all');

  // Only show chips for categories that are actually in the pantry
  const usedCategories = CATEGORIES.filter((c) => items.some((item) => item.category === c));
  const visibleItems = filter === 'all' ? items : items.filter((item) => item.category === filter);

  // Summary at the top: how much needs using up soon
  const days = items.map((item) => daysUntil(item.expirationDate));
  const expired = days.filter((d) => d !== null && d < 0).length;
  const soon = days.filter((d) => d !== null && d >= 0 && d <= 7).length;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <ThemedText type="subtitle">My Pantry</ThemedText>
          <Pressable onPress={() => signOut(auth)} hitSlop={12}>
            <ThemedText type="linkPrimary">Sign out</ThemedText>
          </Pressable>
        </View>

        {items.length > 0 && (
          <View style={styles.summaryRow}>
            <SummaryStat value={items.length} label={items.length === 1 ? 'item' : 'items'} color="#4caf50" />
            <SummaryStat value={soon} label="expiring this week" color="#f29900" />
            <SummaryStat value={expired} label="expired" color="#d93025" />
          </View>
        )}

        <TestDataButtons />

        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <FilterChip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
            {usedCategories.map((c) => (
              <FilterChip key={c} label={categoryLabel(c)} selected={filter === c} onPress={() => setFilter(c)} />
            ))}
          </ScrollView>
        </View>

        {loading ? (
          <ActivityIndicator style={styles.message} color="#2e7d32" />
        ) : error ? (
          <ThemedText style={[styles.message, styles.error]}>{error}</ThemedText>
        ) : (
          <FlatList
            data={visibleItems}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <ItemCard item={item} />}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <ThemedText themeColor="textSecondary" style={styles.message}>
                {items.length === 0
                  ? 'Your pantry is empty. Tap + to add your first item.'
                  : 'No items in this category.'}
              </ThemedText>
            }
          />
        )}

        <Pressable style={styles.addButton} onPress={() => router.push('/item-form')}>
          <ThemedText style={styles.addButtonText}>+</ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <ThemedView
        type={selected ? undefined : 'backgroundElement'}
        style={[styles.chip, selected && styles.chipSelected]}>
        <ThemedText type="small" style={selected && styles.chipSelectedText}>
          {label}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

// One number in the summary row, e.g. "4 expiring this week"
function SummaryStat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <ThemedView type="backgroundElement" style={styles.stat}>
      <ThemedText style={[styles.statValue, { color }]}>{value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </ThemedView>
  );
}

// One pantry item. Tap it to edit or delete.
// The colored stripe and pill show how soon it expires (red, orange, or gray).
function ItemCard({ item }: { item: PantryItem }) {
  const days = daysUntil(item.expirationDate);
  const color = expiryColor(days);

  return (
    <Pressable onPress={() => router.push({ pathname: '/item-form', params: { id: item.id } })}>
      <ThemedView type="backgroundElement" style={[styles.card, { borderLeftColor: color }]}>
        <View style={styles.iconCircle}>
          <ThemedText style={styles.icon}>{CATEGORY_EMOJI[item.category]}</ThemedText>
        </View>
        <View style={styles.cardText}>
          <ThemedText type="smallBold" style={styles.itemName}>
            {item.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {item.quantity} {item.unit} · {capitalize(item.category)}
          </ThemedText>
        </View>
        <ThemedText
          type="small"
          style={[styles.expiryPill, { color, borderColor: color, backgroundColor: color + '22' }]}>
          {days !== null && days >= 0 && days <= 7 ? '⏰ ' : ''}
          {expiryLabel(days)}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    // On web the tab bar sits at the top of the page, so leave room for it
    paddingTop: Platform.OS === 'web' ? Spacing.six + Spacing.three : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  chipRow: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  chip: {
    borderRadius: 16,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  chipSelected: {
    backgroundColor: '#2e7d32',
  },
  chipSelectedText: {
    color: '#ffffff',
  },
  list: {
    gap: Spacing.two + Spacing.one,
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.six + Spacing.five,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 12,
    borderLeftWidth: 5,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
  },
  icon: {
    fontSize: 22,
    lineHeight: 28,
  },
  expiryPill: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    fontWeight: 'bold',
    overflow: 'hidden',
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.one,
    borderRadius: 12,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  cardText: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
  },
  message: {
    marginTop: Spacing.five,
    textAlign: 'center',
  },
  error: {
    color: '#d93025',
  },
  addButton: {
    position: 'absolute',
    right: Spacing.four,
    bottom: BottomTabInset + Spacing.three,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2e7d32',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.25)',
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 28,
    lineHeight: 30,
    fontWeight: 700,
  },
});
