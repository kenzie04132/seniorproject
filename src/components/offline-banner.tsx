import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useOnline } from "@/lib/offline";

// A yellow strip across the top while there's no internet (Week 11 offline cache).
// It disappears by itself when the internet comes back.
export function OfflineBanner() {
  const online = useOnline();
  const insets = useSafeAreaInsets();
  if (online) return null;
  return (
    <View style={[styles.banner, { paddingTop: insets.top + 6 }]} accessibilityRole="alert">
      <Text style={styles.title}>You&apos;re offline</Text>
      <Text style={styles.text}>
        Showing your saved pantry and shopping list. Changes are kept on this device and will sync when you&apos;re back online.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: "#FFF4CE",
    borderBottomWidth: 1,
    borderBottomColor: "#E8C547",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  title: { fontWeight: "700", color: "#5C4400", fontSize: 14 },
  text: { color: "#5C4400", fontSize: 13, marginTop: 2 },
});
