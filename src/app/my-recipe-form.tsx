import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';
import { friendlyError } from '@/lib/errors';
import {
  addMyRecipe,
  checkRecipeForm,
  getMyRecipe,
  parseIngredientLines,
  parseStepLines,
  toFirestoreId,
  updateMyRecipe,
} from '@/lib/my-recipes';

type IngredientRow = { measure: string; name: string };
const EMPTY_ROWS: IngredientRow[] = [
  { measure: '', name: '' },
  { measure: '', name: '' },
  { measure: '', name: '' },
];

// Add (or edit) one of your own recipes: a family recipe typed in, or one from a website.
// /my-recipe-form           -> add a new recipe
// /my-recipe-form?id=my-abc -> edit that recipe
export default function MyRecipeFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!id;
  const { user } = useAuth();
  const theme = useTheme();

  const [name, setName] = useState('');
  const [link, setLink] = useState('');
  const [ingredients, setIngredients] = useState<IngredientRow[]>(EMPTY_ROWS);
  const [stepsText, setStepsText] = useState('');
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [stepsPasteOpen, setStepsPasteOpen] = useState(false);
  const [stepsPasteText, setStepsPasteText] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);

  // When editing, fill in the form
  useEffect(() => {
    if (!user || !id) return;
    getMyRecipe(user.uid, toFirestoreId(id))
      .then((recipe) => {
        if (!recipe) return setError('This recipe no longer exists.');
        setName(recipe.name);
        setLink(recipe.sourceUrl ?? '');
        setIngredients([...recipe.ingredients, { measure: '', name: '' }]);
        setStepsText(recipe.steps.join('\n'));
      })
      .catch((e) => setError(friendlyError(e, 'load this recipe')))
      .finally(() => setLoading(false));
  }, [user, id]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/recipes'));

  function updateRow(index: number, changes: Partial<IngredientRow>) {
    setIngredients(ingredients.map((row, i) => (i === index ? { ...row, ...changes } : row)));
  }

  // Split a pasted ingredient list into rows, replacing the empty rows
  function handlePaste() {
    const rows = parseIngredientLines(pasteText);
    if (rows.length === 0) return;
    const filled = ingredients.filter((row) => row.name.trim() || row.measure.trim());
    setIngredients([...filled, ...rows]);
    setPasteText('');
    setPasteOpen(false);
  }

  // Clean up pasted instructions (removes "1.", "Step 1" and blank lines) and add them to the steps box
  function handlePasteSteps() {
    const steps = parseStepLines(stepsPasteText);
    if (steps.length === 0) return;
    setStepsText([stepsText.trim(), ...steps].filter(Boolean).join('\n'));
    setStepsPasteText('');
    setStepsPasteOpen(false);
  }

  async function handleSave() {
    if (!user) return;
    const result = checkRecipeForm({ name, link, ingredients, stepsText });
    if ('error' in result) return setError(result.error);
    setSaving(true);
    setError('');
    try {
      if (id) await updateMyRecipe(user.uid, toFirestoreId(id), result.recipe);
      else await addMyRecipe(user.uid, result.recipe);
      close();
    } catch (e) {
      setError(friendlyError(e, 'save your recipe'));
      setSaving(false);
    }
  }

  const inputStyle = [styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }];

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator color="#2e7d32" />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={close} hitSlop={12}>
            <ThemedText type="linkPrimary">Cancel</ThemedText>
          </Pressable>
          <ThemedText type="smallBold">{isEditing ? 'Edit recipe' : 'Add your own recipe'}</ThemedText>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <ThemedText type="smallBold">Recipe name</ThemedText>
          <TextInput
            style={inputStyle}
            placeholder="e.g. Grandma's Chili"
            placeholderTextColor={theme.textSecondary}
            value={name}
            onChangeText={setName}
          />

          <ThemedText type="smallBold">Link (optional)</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Found it online? Paste the web address so you can open the original.
          </ThemedText>
          <TextInput
            style={inputStyle}
            placeholder="https://..."
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            keyboardType="url"
            value={link}
            onChangeText={setLink}
          />

          <ThemedText type="smallBold">Ingredients</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            These are matched with your pantry and can go on your shopping list.
          </ThemedText>
          {/* Copy the ingredient list from a recipe website and paste it here */}
          {pasteOpen ? (
            <View style={styles.pasteBox}>
              <TextInput
                style={[inputStyle, styles.stepsInput]}
                placeholder={'Paste the ingredient list, one per line:\n2 cups flour\n3 ripe bananas\n1 tsp baking soda'}
                placeholderTextColor={theme.textSecondary}
                multiline
                textAlignVertical="top"
                value={pasteText}
                onChangeText={setPasteText}
                autoFocus
              />
              <View style={styles.pasteButtons}>
                <Pressable onPress={() => setPasteOpen(false)} hitSlop={8}>
                  <ThemedText themeColor="textSecondary">Cancel</ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.smallGreenButton, !pasteText.trim() && styles.disabled]}
                  onPress={handlePaste}
                  disabled={!pasteText.trim()}>
                  <ThemedText type="smallBold" style={styles.saveText}>
                    Fill in ingredients
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable style={styles.pasteLink} onPress={() => setPasteOpen(true)} hitSlop={8}>
              <ThemedText type="linkPrimary">📋 Paste an ingredient list</ThemedText>
            </Pressable>
          )}
          {ingredients.map((row, i) => (
            <View key={i} style={styles.ingredientRow}>
              <TextInput
                style={[inputStyle, styles.measureInput]}
                placeholder="Amount"
                placeholderTextColor={theme.textSecondary}
                value={row.measure}
                onChangeText={(measure) => updateRow(i, { measure })}
              />
              <TextInput
                style={[inputStyle, styles.nameInput]}
                placeholder={i === 0 ? 'e.g. Ground Beef' : 'Ingredient'}
                placeholderTextColor={theme.textSecondary}
                value={row.name}
                onChangeText={(newName) => updateRow(i, { name: newName })}
              />
              <Pressable
                onPress={() => setIngredients(ingredients.filter((_, j) => j !== i))}
                hitSlop={8}
                disabled={ingredients.length === 1}>
                <ThemedText themeColor="textSecondary">✕</ThemedText>
              </Pressable>
            </View>
          ))}
          <Pressable onPress={() => setIngredients([...ingredients, { measure: '', name: '' }])} hitSlop={8}>
            <ThemedText type="linkPrimary">+ Add another ingredient</ThemedText>
          </Pressable>

          <ThemedText type="smallBold" style={styles.spaced}>
            Steps {link.trim() ? '(optional with a link)' : ''}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Put each step on its own line.
          </ThemedText>
          {stepsPasteOpen ? (
            <View style={styles.pasteBox}>
              <TextInput
                style={[inputStyle, styles.stepsInput]}
                placeholder={'Paste the instructions from the website:\n1. Preheat the oven to 350°F.\n2. Mash the bananas.'}
                placeholderTextColor={theme.textSecondary}
                multiline
                textAlignVertical="top"
                value={stepsPasteText}
                onChangeText={setStepsPasteText}
                autoFocus
              />
              <View style={styles.pasteButtons}>
                <Pressable onPress={() => setStepsPasteOpen(false)} hitSlop={8}>
                  <ThemedText themeColor="textSecondary">Cancel</ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.smallGreenButton, !stepsPasteText.trim() && styles.disabled]}
                  onPress={handlePasteSteps}
                  disabled={!stepsPasteText.trim()}>
                  <ThemedText type="smallBold" style={styles.saveText}>
                    Fill in steps
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable style={styles.pasteLink} onPress={() => setStepsPasteOpen(true)} hitSlop={8}>
              <ThemedText type="linkPrimary">📋 Paste instructions</ThemedText>
            </Pressable>
          )}
          <TextInput
            style={[inputStyle, styles.stepsInput]}
            placeholder={'Brown the beef in a large pot.\nAdd the beans and tomatoes and simmer 30 minutes.'}
            placeholderTextColor={theme.textSecondary}
            multiline
            textAlignVertical="top"
            value={stepsText}
            onChangeText={setStepsText}
          />

          {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

          <Pressable style={styles.saveButton} onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <ThemedText style={styles.saveText}>{isEditing ? 'Save changes' : 'Save recipe'}</ThemedText>
            )}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth / 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  headerSpacer: {
    width: 50,
  },
  form: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.two,
  },
  input: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  measureInput: {
    width: 100,
  },
  nameInput: {
    flex: 1,
  },
  spaced: {
    marginTop: Spacing.three,
  },
  stepsInput: {
    minHeight: 140,
  },
  pasteLink: {
    marginBottom: Spacing.one,
  },
  pasteBox: {
    gap: Spacing.two,
  },
  pasteButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: Spacing.four,
  },
  smallGreenButton: {
    backgroundColor: '#2e7d32',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  disabled: {
    opacity: 0.5,
  },
  error: {
    color: '#d93025',
  },
  saveButton: {
    backgroundColor: '#2e7d32',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.three,
  },
  saveText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
});
