import { Image } from 'expo-image';
import { ActivityIndicator, FlatList, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
 
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { usePantryItems } from '@/lib/pantry';
import { RecipeMatch, useRecipeMatches } from '@/lib/recipes';
 
export default function RecipesScreen() {
  const { user } = useAuth();
  const pantry = usePantryItems(user?.uid);
  const { recipes, loading, error } = useRecipeMatches(pantry.items, pantry.loading);
 
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <ThemedText type="subtitle">My Recipes</ThemedText>
        </View>
 
        {loading || pantry.loading ? (
          <ActivityIndicator style={styles.message} color="#2e7d32" />
        ) : error || pantry.error ? (
          <ThemedText style={[styles.message, styles.error]}>{error || pantry.error}</ThemedText>
        ) : (
          <FlatList
            data={recipes}
            keyExtractor={(recipe) => recipe.id}
            renderItem={({ item }) => <RecipeCard recipe={item} />}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <ThemedText themeColor="textSecondary" style={styles.message}>
                {pantry.items.length === 0
                  ? 'Add items to your pantry to see recipes you can make.'
                  : 'No recipes found for the items in your pantry.'}
              </ThemedText>
            }
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}
 
function RecipeCard({ recipe }: { recipe: RecipeMatch }) {
  const count = recipe.matchedIngredients.length;
 
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <Image source={{ uri: recipe.thumbnail }} style={styles.thumbnail} />
      <View style={styles.cardText}>
        <ThemedText type="smallBold" style={styles.recipeName}>
          {recipe.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Uses {count} pantry {count === 1 ? 'item' : 'items'}: {recipe.matchedIngredients.join(', ')}
        </ThemedText>
      </View>
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
    maxWidth: MaxContentWidth,
    // On web the tab bar sits at the top of the page, so leave room for it
    paddingTop: Platform.OS === 'web' ? Spacing.six + Spacing.three : 0,
  },
  header: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
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
  message: {
    marginTop: Spacing.five,
    textAlign: 'center',
  },
  error: {
    color: '#d93025',
  },
});
 