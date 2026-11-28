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
  toggleDiet,
  togglePreferredArea,
  useRecipePreferences,
} from '@/lib/preferences';
import { Diet, DIETS, fitsDiets } from '@/lib/dietary';
import { Difficulty } from '@/lib/matching';
import { RankedRecipe, usablePantryIngredients, useRecipeMatches } from '@/lib/recipes';
import { MY_RECIPE_EMOJI, toScreenId, useMyRecipes } from '@/lib/my-recipes';
import { isReadyToCook, rankOwnRecipes, rankSimpleMeals } from '@/lib/simple-meals';

// The filter chips: TheMealDB difficulties, plus the built-in super easy meals
// and the user's own recipes (Week 10)
type RecipeView = Difficulty | 'Any' | 'Super easy' | 'Mine';

export default function RecipesScreen() {
  const { user } = useAuth();
  const uid = user?.uid ?? '';
  const pantry = usePantryItems(user?.uid);
  const { prefs, loading: prefsLoading } = useRecipePreferences(user?.uid);
  const { recipes, loading, error, retry } = useRecipeMatches(pantry.items, prefs, pantry.loading || prefsLoading);

  // Hide a recipe right away, without waiting for the search to run again
  const hidden = new Set(prefs.hiddenRecipeIds);
  const [difficulty, setDifficulty] = useState<RecipeView>('Any');
  const notHidden = recipes.filter(
    (recipe) => !hidden.has(recipe.id) && (difficulty === 'Any' || recipe.difficulty === difficulty),
  );

  // Week 11: dietary filters. If the full recipe didn't load we can't check its
  // ingredients, so leave it out while a diet is picked.
  const diets = prefs.dietaryPreferences;
  const fitsDiet = (recipe: RankedRecipe) =>
    diets.length === 0 || (recipe.ingredientsKnown && fitsDiets(recipe.ingredients, diets));
  const visible = notHidden.filter(fitsDiet);

  // Week 10: built-in super easy meals and the user's own recipes,
  // ranked against the pantry the same way (no TheMealDB needed)
  const myRecipes = useMyRecipes(user?.uid);
  const [soonest, setSoonest] = useState<Map<string, number | null>>(new Map());
  useEffect(() => {
    if (pantry.loading) return;
    usablePantryIngredients(pantry.items).then(setSoonest);
  }, [pantry.items, pantry.loading]);
  const allSimpleMeals = rankSimpleMeals(soonest);
  const allMine = rankOwnRecipes(
    myRecipes.recipes.map((r) => ({ ...r, id: toScreenId(r.id), emoji: MY_RECIPE_EMOJI })),
    soonest,
  );
  const ownView = difficulty === 'Super easy' || difficulty === 'Mine';
  const beforeDiet = difficulty === 'Super easy' ? allSimpleMeals : difficulty === 'Mine' ? allMine : notHidden;
  const listData = ownView ? beforeDiet.filter(fitsDiet) : visible;
  // True when there were recipes, but none fit the picked diets
  const dietHidAll = diets.length > 0 && beforeDiet.length > 0 && listData.length === 0;

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
          <DietFilter selected={diets} onToggle={(diet, on) => toggleDiet(uid, diet, on)} />
        </View>

        {firstLoad && !ownView ? (
          <ActivityIndicator style={styles.message} color="#2e7d32" />
        ) : (error || pantry.error) && !ownView ? (
          <View style={styles.errorBox}>
            <ThemedText style={[styles.message, styles.error]}>{error || pantry.error}</ThemedText>
            {error ? (
              <Pressable onPress={retry} style={styles.addRecipeButton}>
                <ThemedText type="smallBold" style={styles.regionSelectedText}>
                  Try again
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <FlatList
            data={listData}
            keyExtractor={(recipe) => recipe.id}
            renderItem={({ item }) => (
              // Only TheMealDB recipes can be hidden with "Not interested"
              <RecipeCard recipe={item} onHide={ownView ? undefined : () => hideRecipe(uid, item.id)} />
            )}
            ListHeaderComponent={
              <>
                {difficulty === 'Super easy' && (
                  <ThemedText type="small" themeColor="textSecondary">
                    Quick meals with just a few ingredients, like a PB&J or an egg burrito.
                  </ThemedText>
                )}
                {difficulty === 'Mine' && (
                  <Pressable style={styles.addRecipeButton} onPress={() => router.push('/my-recipe-form')}>
                    <ThemedText type="smallBold" style={styles.regionSelectedText}>
                      + Add your own recipe
                    </ThemedText>
                  </Pressable>
                )}
                {!ownView &&
                // Explain when the picked region has no recipes that use this pantry's food
                prefs.preferredAreas.length > 0 &&
                !loading &&
                visible.length > 0 &&
                !visible.some((r) => r.preferredArea) ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    No recipes from your regions use the food in your pantry right now, so here are other ideas.
                  </ThemedText>
                ) : null}
                {diets.length > 0 && listData.length > 0 && (
                  <ThemedText type="small" themeColor="textSecondary">
                    Diet filters are a best guess from ingredient names, so always check food labels.
                  </ThemedText>
                )}
              </>
            }
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <ThemedText themeColor="textSecondary" style={styles.message}>
                {dietHidAll
                  ? 'No recipes fit your diet filters for the food in your pantry right now. Try turning one off.'
                  : difficulty === 'Mine' && allMine.length === 0
                    ? "You haven't added any recipes yet. Add a family recipe, or save one you found online."
                    : pantry.items.length === 0
                      ? 'Add items to your pantry to see recipes you can make.'
                      : difficulty !== 'Any' && recipes.length > 0
                        ? `No ${difficulty.toLowerCase()} recipes for the food in your pantry right now.`
                        : 'No recipes found for the items in your pantry.'}
              </ThemedText>
            }
            ListFooterComponent={
              hidden.size > 0 && !ownView ? (
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

// A "Label: Choice ▾" button that opens a list, styled like the Regions button.
// single: tapping an option picks it and closes the list (Difficulty).
// multi: options tick on and off, then the user taps Done (Diet).
function FilterDropdown<T extends string>({
  label,
  title,
  options,
  selected,
  onPress,
  multi = false,
}: {
  label: string; // e.g. "Diet"
  title: string; // shown at the top of the list
  options: { value: T; label: string }[];
  selected: T[];
  onPress: (value: T) => void;
  multi?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // Highlight the button green when it's filtering something
  // (for single choice, the first option means "no filter")
  const active = multi ? selected.length > 0 : selected[0] !== options[0].value;
  const names = options.filter((o) => selected.includes(o.value)).map((o) => o.label);
  // "Any", "Vegan", or "Vegan +1"
  const summary = !active ? 'Any' : names.length === 1 ? names[0] : `${names[0]} +${names.length - 1}`;

  return (
    <View style={styles.regionRow}>
      <Pressable onPress={() => setOpen(true)}>
        <ThemedView
          type={active ? undefined : 'backgroundElement'}
          style={[styles.regionButton, active && styles.regionSelected]}>
          <ThemedText type="small" style={active && styles.regionSelectedText}>
            {label}: {summary} ▾
          </ThemedText>
        </ThemedView>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheetArea} onPress={(event) => event.stopPropagation()}>
            <ThemedView style={styles.sheet}>
              <ThemedText type="smallBold" style={styles.sheetTitle}>
                {title}
              </ThemedText>
              {options.map((option) => {
                const checked = selected.includes(option.value);
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      onPress(option.value);
                      if (!multi) setOpen(false);
                    }}
                    style={styles.regionOption}>
                    <ThemedText style={[styles.checkbox, checked && styles.regionOptionSelected]}>
                      {multi ? (checked ? '☑' : '☐') : checked ? '◉' : '○'}
                    </ThemedText>
                    <ThemedText style={checked && styles.regionOptionSelected}>{option.label}</ThemedText>
                  </Pressable>
                );
              })}
              {multi && (
                <Pressable onPress={() => setOpen(false)} style={styles.doneButton}>
                  <ThemedText style={styles.doneText}>Done</ThemedText>
                </Pressable>
              )}
            </ThemedView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// Any / Super easy / Easy / Medium / Hard / Added by me: pick one
const DIFFICULTY_OPTIONS: { value: RecipeView; label: string }[] = [
  { value: 'Any', label: 'Any difficulty' },
  { value: 'Super easy', label: 'Super easy' },
  { value: 'Easy', label: 'Easy' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Hard', label: 'Hard' },
  { value: 'Mine', label: 'Added by me' },
];

function DifficultyFilter({ selected, onSelect }: { selected: RecipeView; onSelect: (view: RecipeView) => void }) {
  return (
    <FilterDropdown
      label="Difficulty"
      title="Show recipes that are"
      options={DIFFICULTY_OPTIONS}
      selected={[selected]}
      onPress={onSelect}
    />
  );
}

// Vegetarian / Vegan / Gluten-free / Dairy-free: tick any number of them.
// Choices are saved to the user's profile, so they stay on next time.
function DietFilter({ selected, onToggle }: { selected: Diet[]; onToggle: (diet: Diet, on: boolean) => void }) {
  return (
    <FilterDropdown
      label="Diet"
      title="Only show recipes that are"
      options={DIETS.map(({ id, label }) => ({ value: id, label }))}
      selected={selected}
      onPress={(diet) => onToggle(diet, !selected.includes(diet))}
      multi
    />
  );
}

function RecipeCard({ recipe, onHide }: { recipe: RankedRecipe; onHide?: () => void }) {
  // Week 10: you already have every ingredient, so make this card stand out
  const readyToCook = isReadyToCook(recipe);

  return (
    // Tap anywhere on the card to open the full recipe
    <Pressable onPress={() => router.push({ pathname: '/recipe', params: { id: recipe.id } })}>
      <ThemedView type="backgroundElement" style={[styles.card, readyToCook && styles.readyCard]}>
        {recipe.emoji ? (
          <View style={[styles.thumbnail, styles.emojiThumbnail]}>
            <ThemedText style={styles.emoji}>{recipe.emoji}</ThemedText>
          </View>
        ) : (
          <Image source={{ uri: recipe.thumbnail }} style={styles.thumbnail} />
        )}
        <View style={styles.cardText}>
          {readyToCook && (
            <ThemedText type="small" style={styles.readyBadge}>
              ✓ Ready to cook
            </ThemedText>
          )}
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
          {readyToCook ? (
            <ThemedText type="smallBold" style={styles.readyText}>
              {recipe.difficulty} · You have all {recipe.totalCount} ingredients
            </ThemedText>
          ) : recipe.ingredientsKnown ? (
            <ThemedText type="small" themeColor="textSecondary">
              {recipe.difficulty} · You have {recipe.haveCount} of {recipe.totalCount} ingredients
            </ThemedText>
          ) : (
            // The full recipe didn't load, so we only know which of your items it uses
            <ThemedText type="small" themeColor="textSecondary">
              Uses {recipe.matchedIngredients.length} of your items · tap to see the full recipe
            </ThemedText>
          )}
          {recipe.preferredArea && (
            <ThemedText type="small" style={styles.areaTag}>
              {recipe.preferredArea} recipe
            </ThemedText>
          )}
        </View>
        {onHide && (
          <Pressable onPress={onHide} hitSlop={8} style={styles.hideButton}>
            <ThemedText type="small" themeColor="textSecondary">
              Not interested
            </ThemedText>
          </Pressable>
        )}
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
  addRecipeButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#2e7d32',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  emojiThumbnail: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(128, 128, 128, 0.2)',
  },
  emoji: {
    fontSize: 36,
    lineHeight: 44,
  },
  // Green outline and tint for recipes you can make right now
  readyCard: {
    borderWidth: 2,
    borderColor: '#2e7d32',
    backgroundColor: 'rgba(46, 125, 50, 0.15)',
  },
  readyBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#2e7d32',
    color: '#ffffff',
    fontWeight: 'bold',
    borderRadius: 10,
    paddingHorizontal: Spacing.two,
    overflow: 'hidden',
  },
  readyText: {
    color: '#4caf50',
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
  errorBox: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
});
