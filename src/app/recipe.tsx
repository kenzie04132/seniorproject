import { Image } from 'expo-image';
import { Href, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExternalLink } from '@/components/external-link';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { pantryHas } from '@/lib/matching';
import { usePantryItems } from '@/lib/pantry';
import { getRecipeDetails, RecipeDetails, usablePantryIngredients } from '@/lib/recipes';

// The full recipe: ingredients (marked if you have them) and step-by-step instructions.
// Opened by tapping a recipe on the Recipes tab: /recipe?id=52772
export default function RecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const pantry = usePantryItems(user?.uid);

  const [recipe, setRecipe] = useState<RecipeDetails | null>(null);
  const [pantryNames, setPantryNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    getRecipeDetails(id)
      .then((details) => {
        if (details) setRecipe(details);
        else setError('This recipe could not be found.');
      })
      .catch(() => setError("Couldn't load this recipe. Check your internet connection."))
      .finally(() => setLoading(false));
  }, [id]);

  // Which ingredients are already in the pantry (expired food doesn't count)
  useEffect(() => {
    usablePantryIngredients(pantry.items).then((names) => setPantryNames([...names.keys()]));
  }, [pantry.items]);

  // Go back to the Recipes tab (or open it, if this page was loaded directly)
  const close = () => (router.canGoBack() ? router.back() : router.replace('/recipes'));

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={close} hitSlop={12}>
            <ThemedText type="linkPrimary">‹ Back</ThemedText>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator style={styles.message} color="#2e7d32" />
        ) : error || !recipe ? (
          <ThemedText style={[styles.message, styles.error]}>{error}</ThemedText>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            <Image source={{ uri: recipe.thumbnail }} style={styles.photo} />
            <ThemedText type="subtitle">{recipe.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {[recipe.area, recipe.category].filter(Boolean).join(' · ')}
            </ThemedText>

            <ThemedText type="smallBold" style={styles.sectionTitle}>
              Ingredients
            </ThemedText>
            {recipe.ingredients.map((ing, i) => {
              const have = pantryHas(ing.name, pantryNames);
              return (
                <View key={i} style={styles.ingredientRow}>
                  <ThemedText style={[styles.mark, have ? styles.have : styles.need]}>{have ? '✓' : '○'}</ThemedText>
                  <ThemedText style={styles.ingredientText}>
                    {ing.measure ? `${ing.measure} ` : ''}
                    {ing.name}
                    {have && (
                      <ThemedText type="small" style={styles.have}>
                        {'  '}in your pantry
                      </ThemedText>
                    )}
                  </ThemedText>
                </View>
              );
            })}

            <ThemedText type="smallBold" style={styles.sectionTitle}>
              Instructions
            </ThemedText>
            {recipe.steps.map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <ThemedText type="smallBold" style={styles.stepNumber}>
                  {i + 1}
                </ThemedText>
                <ThemedText style={styles.stepText}>{step}</ThemedText>
              </View>
            ))}

            {(recipe.youtube || recipe.source) && (
              <View style={styles.links}>
                {recipe.youtube && (
                  <ExternalLink href={recipe.youtube as Href & string}>
                    <ThemedText type="linkPrimary">Watch the video</ThemedText>
                  </ExternalLink>
                )}
                {recipe.source && (
                  <ExternalLink href={recipe.source as Href & string}>
                    <ThemedText type="linkPrimary">See the original recipe</ThemedText>
                  </ExternalLink>
                )}
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
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
    maxWidth: MaxContentWidth / 2,
    // On web the tab bar sits at the top of the page, so leave room for it
    paddingTop: Platform.OS === 'web' ? Spacing.three : 0,
  },
  header: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.two,
  },
  photo: {
    width: '100%',
    aspectRatio: 1.6,
    borderRadius: 12,
    marginBottom: Spacing.two,
  },
  sectionTitle: {
    fontSize: 18,
    marginTop: Spacing.four,
  },
  ingredientRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  mark: {
    width: 20,
    textAlign: 'center',
  },
  have: {
    color: '#2e7d32',
  },
  need: {
    color: '#60646c',
  },
  ingredientText: {
    flex: 1,
  },
  stepRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginBottom: Spacing.two,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2e7d32',
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 24,
  },
  stepText: {
    flex: 1,
  },
  links: {
    marginTop: Spacing.four,
    gap: Spacing.three,
  },
  message: {
    marginTop: Spacing.five,
    textAlign: 'center',
  },
  error: {
    color: '#d93025',
  },
});
