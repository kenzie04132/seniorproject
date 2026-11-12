import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { capitalize, expiryColor, expiryLabel, usePantryItems } from '@/lib/pantry';
import {
  clearPreferredAreas,
  hideRecipe,
  loadAreas,
  showHiddenRecipes,
  togglePreferredArea,
  useRecipePreferences,
} from '@/lib/preferences';
import { Difficulty } from '@/lib/matching';
import { RankedRecipe, useRecipeMatches } from '@/lib/recipes';

export default function RecipesScreen() {
  const { user } = useAuth();
  const uid = user?.uid ?? '';
  const pantry = usePantryItems(user?.uid);
  const { prefs, loading: prefsLoading } = useRecipePreferences(user?.uid);
  const { recipes, loading, error } = useRecipeMatches(pantry.items, prefs, pantry.loading || prefsLoading);

  // Hide a recipe right away, without waiting for the search to run again
  const hidden = new Set(prefs.hiddenRecipeIds);
  const [difficulty, setDifficulty] = useState<Difficulty | 'Any'>('Any');
  const visible = recipes.filter(
    (recipe) => !hidden.has(recipe.id) && (difficulty === 'Any' || recipe.difficulty === difficulty),
  );

  // Only show the full-screen spinner the first time. After that, keep the old list
  // on screen while new results load, so hiding a recipe doesn't make the list flash.
  const firstLoad = (loading && recipes.length === 0) || pantry.loading || prefsLoading;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <ThemedText type="subtitle">My Recipes</ThemedText>
            {loading && !firstLoad && <ActivityIndicator color="#2e7d32" />}
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            Ranked to use up your soonest-expiring food first
          </ThemedText>
        </View>

        <View style={styles.filters}>
          <RegionPicker
            selected={prefs.preferredAreas}
            onToggle={(area, on) => togglePreferredArea(uid, area, on)}
            onClear={() => clearPreferredAreas(uid)}
          />
          <DifficultyFilter selected={difficulty} onSelect={setDifficulty} />
        </View>

        {firstLoad ? (
          <ActivityIndicator style={styles.message} color="#2e7d32" />
        ) : error || pantry.error ? (
          <ThemedText style={[styles.message, styles.error]}>{error || pantry.error}</ThemedText>
        ) : (
          <FlatList
            data={visible}
            keyExtractor={(recipe) => recipe.id}
            renderItem={({ item }) => <RecipeCard recipe={item} onHide={() => hideRecipe(uid, item.id)} />}
            ListHeaderComponent={
              // Explain when the picked region has no recipes that use this pantry's food
              prefs.preferredAreas.length > 0 &&
              !loading &&
              visible.length > 0 &&
              !visible.some((r) => r.preferredArea) ? (
                <ThemedText type="small" themeColor="textSecondary">
                  No recipes from your regions use the food in your pantry right now, so here are other ideas.
                </ThemedText>
              ) : null
            }
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <ThemedText themeColor="textSecondary" style={styles.message}>
                {pantry.items.length === 0
                  ? 'Add items to your pantry to see recipes you can make.'
                  : difficulty !== 'Any' && recipes.length > 0
                    ? `No ${difficulty.toLowerCase()} recipes for the food in your pantry right now.`
                    : 'No recipes found for the items in your pantry.'}
              </ThemedText>
            }
            ListFooterComponent={
              hidden.size > 0 ? (
                <Pressable onPress={() => showHiddenRecipes(uid)} hitSlop={8} style={styles.footer}>
                  <ThemedText type="small" style={styles.link}>
                    Show {hidden.size} hidden {hidden.size === 1 ? 'recipe' : 'recipes'} again
                  </ThemedText>
                </Pressable>
              ) : null
            }
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

type RegionRow = { kind: 'heading'; title: string } | { kind: 'any' } | { kind: 'area'; area: string };

// A "Regions: Any ▾" button. Tapping it opens a list where the user ticks the regions they like.
// Popular regions are listed first, then all the others A-Z. Choices save as soon as they're tapped.
function RegionPicker({
  selected,
  onToggle,
  onClear,
}: {
  selected: string[];
  onToggle: (area: string, on: boolean) => void;
  onClear: () => void;
}) {
  const [areas, setAreas] = useState<{ popular: string[]; others: string[] } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    loadAreas()
      .then(setAreas)
      .catch(() => setAreas(null)); // no internet: just don't show the region button
  }, []);

  if (!areas) return null;

  const rows: RegionRow[] = [
    { kind: 'any' },
    { kind: 'heading', title: 'Popular' },
    ...areas.popular.map((area) => ({ kind: 'area' as const, area })),
    { kind: 'heading', title: 'All regions' },
    ...areas.others.map((area) => ({ kind: 'area' as const, area })),
  ];

  // "Any", "Italian", or "Italian +2"
  const label =
    selected.length === 0 ? 'Any' : selected.length === 1 ? selected[0] : `${selected[0]} +${selected.length - 1}`;
  const hasSelection = selected.length > 0;

  return (
    <View style={styles.regionRow}>
      <Pressable onPress={() => setOpen(true)}>
        <ThemedView
          type={hasSelection ? undefined : 'backgroundElement'}
          style={[styles.regionButton, hasSelection && styles.regionSelected]}>
          <ThemedText type="small" style={hasSelection && styles.regionSelectedText}>
            Regions: {label} ▾
          </ThemedText>
        </ThemedView>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        {/* Tapping the dark background closes the list */}
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          {/* Taps inside the list itself don't close it */}
          <Pressable style={styles.sheetArea} onPress={(event) => event.stopPropagation()}>
            <ThemedView style={styles.sheet}>
              <ThemedText type="smallBold" style={styles.sheetTitle}>
                Show recipes from these regions first
              </ThemedText>
              <FlatList
                data={rows}
                keyExtractor={(row) => (row.kind === 'area' ? row.area : row.kind === 'heading' ? row.title : 'any')}
                renderItem={({ item: row }) => {
                  if (row.kind === 'heading') {
                    return (
                      <ThemedText type="small" themeColor="textSecondary" style={styles.regionHeading}>
                        {row.title.toUpperCase()}
                      </ThemedText>
                    );
                  }
                  const isAny = row.kind === 'any';
                  const checked = isAny ? !hasSelection : selected.includes(row.area);
                  return (
                    <Pressable
                      onPress={() => (isAny ? onClear() : onToggle(row.area, !checked))}
                      style={styles.regionOption}>
                      <ThemedText style={[styles.checkbox, checked && styles.regionOptionSelected]}>
                        {checked ? '☑' : '☐'}
                      </ThemedText>
                      <ThemedText style={checked && styles.regionOptionSelected}>
                        {isAny ? 'Any region' : row.area}
                      </ThemedText>
                    </Pressable>
                  );
                }}
              />
              <Pressable onPress={() => setOpen(false)} style={styles.doneButton}>
                <ThemedText style={styles.doneText}>Done</ThemedText>
              </Pressable>
            </ThemedView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// Any / Easy / Medium / Hard: only show recipes of that difficulty
function DifficultyFilter({
  selected,
  onSelect,
}: {
  selected: Difficulty | 'Any';
  onSelect: (difficulty: Difficulty | 'Any') => void;
}) {
  const options: (Difficulty | 'Any')[] = ['Any', 'Easy', 'Medium', 'Hard'];
  return (
    <View style={styles.difficultyRow}>
      {options.map((option) => {
        const isSelected = option === selected;
        return (
          <Pressable key={option} onPress={() => onSelect(option)}>
            <ThemedView
              type={isSelected ? undefined : 'backgroundElement'}
              style={[styles.regionButton, isSelected && styles.regionSelected]}>
              <ThemedText type="small" style={isSelected && styles.regionSelectedText}>
                {option === 'Any' ? 'Any difficulty' : option}
              </ThemedText>
            </ThemedView>
          </Pressable>
        );
      })}
    </View>
  );
}

function RecipeCard({ recipe, onHide }: { recipe: RankedRecipe; onHide: () => void }) {
  return (
    // Tap anywhere on the card to open the full recipe
    <Pressable onPress={() => router.push({ pathname: '/recipe', params: { id: recipe.id } })}>
      <ThemedView type="backgroundElement" style={styles.card}>
        <Image source={{ uri: recipe.thumbnail }} style={styles.thumbnail} />
        <View style={styles.cardText}>
          <ThemedText type="smallBold" style={styles.recipeName}>
            {recipe.name}
          </ThemedText>
          <View style={styles.chips}>
            {recipe.matchedIngredients.map((ing) => (
              <ThemedText
                key={ing.name}
                type="small"
                style={[styles.chip, { borderColor: expiryColor(ing.daysLeft), color: expiryColor(ing.daysLeft) }]}>
                {capitalize(ing.name)} · {expiryLabel(ing.daysLeft)}
              </ThemedText>
            ))}
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {recipe.difficulty} · You have {recipe.haveCount} of {recipe.totalCount} ingredients
          </ThemedText>
          {recipe.preferredArea && (
            <ThemedText type="small" style={styles.areaTag}>
              {recipe.preferredArea} recipe
            </ThemedText>
          )}
        </View>
        <Pressable onPress={onHide} hitSlop={8} style={styles.hideButton}>
          <ThemedText type="small" themeColor="textSecondary">
            Not interested
          </ThemedText>
        </Pressable>
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
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  regionRow: {
    flexDirection: 'row',
  },
  difficultyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  regionButton: {
    borderRadius: 16,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  regionSelected: {
    backgroundColor: '#2e7d32',
  },
  regionSelectedText: {
    color: '#ffffff',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  sheetArea: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '70%',
  },
  sheet: {
    flexShrink: 1,
    borderRadius: 12,
    paddingVertical: Spacing.three,
  },
  sheetTitle: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
  },
  regionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  regionHeading: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.one,
    letterSpacing: 1,
  },
  checkbox: {
    fontSize: 18,
  },
  doneButton: {
    backgroundColor: '#2e7d32',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    marginHorizontal: Spacing.four,
    marginTop: Spacing.three,
    alignItems: 'center',
  },
  doneText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  regionOptionSelected: {
    color: '#2e7d32',
    fontWeight: 'bold',
  },
  areaTag: {
    color: '#2e7d32',
    fontWeight: 'bold',
  },
  hideButton: {
    alignSelf: 'flex-start',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
  },
  link: {
    color: '#2e7d32',
  },
  list: {
    gap: Spacing.two + Spacing.one,
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 12,
    padding: Spacing.three,
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: 8,
  },
  cardText: {
    flex: 1,
    gap: Spacing.one,
  },
  recipeName: {
    fontSize: 16,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.two,
    paddingVertical: 1,
    fontSize: 12,
  },
  message: {
    marginTop: Spacing.five,
    textAlign: 'center',
  },
  error: {
    color: '#d93025',
  },
});
