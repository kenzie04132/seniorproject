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
import { hideRecipe, loadAreas, setPreferredArea, showHiddenRecipes, useRecipePreferences } from '@/lib/preferences';
import { RankedRecipe, useRecipeMatches } from '@/lib/recipes';

export default function RecipesScreen() {
  const { user } = useAuth();
  const uid = user?.uid ?? '';
  const pantry = usePantryItems(user?.uid);
  const { prefs, loading: prefsLoading } = useRecipePreferences(user?.uid);
  const { recipes, loading, error } = useRecipeMatches(pantry.items, prefs, pantry.loading || prefsLoading);

  // Hide a recipe right away, without waiting for the search to run again
  const hidden = new Set(prefs.hiddenRecipeIds);
  const visible = recipes.filter((recipe) => !hidden.has(recipe.id));

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

        <RegionPicker selected={prefs.preferredArea} onSelect={(area) => setPreferredArea(uid, area)} />

        {firstLoad ? (
          <ActivityIndicator style={styles.message} color="#2e7d32" />
        ) : error || pantry.error ? (
          <ThemedText style={[styles.message, styles.error]}>{error || pantry.error}</ThemedText>
        ) : (
          <FlatList
            data={visible}
            keyExtractor={(recipe) => recipe.id}
            renderItem={({ item }) => (
              <RecipeCard recipe={item} area={prefs.preferredArea} onHide={() => hideRecipe(uid, item.id)} />
            )}
            ListHeaderComponent={
              // Explain when the picked region has no recipes that use this pantry's food
              prefs.preferredArea && !loading && visible.length > 0 && !visible.some((r) => r.fromPreferredArea) ? (
                <ThemedText type="small" themeColor="textSecondary">
                  No {prefs.preferredArea} recipes use the food in your pantry right now, so here are other ideas.
                </ThemedText>
              ) : null
            }
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <ThemedText themeColor="textSecondary" style={styles.message}>
                {pantry.items.length === 0
                  ? 'Add items to your pantry to see recipes you can make.'
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

// A "Region: Any ▾" button. Tapping it opens a scrollable list of regions to pick from.
function RegionPicker({ selected, onSelect }: { selected: string | null; onSelect: (area: string | null) => void }) {
  const [areas, setAreas] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    loadAreas()
      .then(setAreas)
      .catch(() => setAreas([])); // no internet: just don't show the region button
  }, []);

  if (areas.length === 0) return null;

  const choose = (area: string | null) => {
    onSelect(area);
    setOpen(false);
  };

  return (
    <View style={styles.regionRow}>
      <Pressable onPress={() => setOpen(true)}>
        <ThemedView
          type={selected ? undefined : 'backgroundElement'}
          style={[styles.regionButton, selected && styles.regionSelected]}>
          <ThemedText type="small" style={selected && styles.regionSelectedText}>
            Region: {selected ?? 'Any'} ▾
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
                Show more recipes from
              </ThemedText>
              <FlatList
                data={[null, ...areas]}
                keyExtractor={(area) => area ?? 'any'}
                renderItem={({ item: area }) => (
                  <Pressable onPress={() => choose(area)} style={styles.regionOption}>
                    <ThemedText style={area === selected && styles.regionOptionSelected}>
                      {area ?? 'Any region'}
                      {area === selected ? '  ✓' : ''}
                    </ThemedText>
                  </Pressable>
                )}
              />
            </ThemedView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function RecipeCard({ recipe, area, onHide }: { recipe: RankedRecipe; area: string | null; onHide: () => void }) {
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
            You have {recipe.haveCount} of {recipe.totalCount} ingredients
          </ThemedText>
          {recipe.fromPreferredArea && area && (
            <ThemedText type="small" style={styles.areaTag}>
              {area} recipe
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
  regionRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
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
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
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
