import { BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

type Props = {
  visible: boolean;
  onScanned: (barcode: string) => void;
  onClose: () => void;
};

// Full-screen camera that reads one product barcode, then hands it back.
export function BarcodeScanner({ visible, onScanned, onClose }: Props) {
  const [permission, requestPermission] = useCameraPermissions();

  // The camera sees the same barcode many times a second, so only use the first one
  const scanned = useRef(false);
  useEffect(() => {
    if (visible) scanned.current = false;
  }, [visible]);

  function handleScan(result: BarcodeScanningResult) {
    if (scanned.current) return;
    scanned.current = true;
    onScanned(result.data);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
            onBarcodeScanned={handleScan}
          />
        ) : (
          <View style={styles.permission}>
            <ThemedText style={styles.whiteText}>
              SmartPantry needs your camera to scan barcodes.
            </ThemedText>
            <Pressable style={styles.button} onPress={requestPermission}>
              <ThemedText style={styles.whiteText}>Allow camera</ThemedText>
            </Pressable>
          </View>
        )}

        {/* Drawn on top of the camera */}
        <View style={styles.overlay} pointerEvents="box-none">
          <ThemedText style={styles.whiteText}>Point the camera at a barcode</ThemedText>
          <Pressable style={styles.button} onPress={onClose}>
            <ThemedText style={styles.whiteText}>Cancel</ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  permission: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.six,
    paddingBottom: Spacing.six,
  },
  button: {
    backgroundColor: '#2e7d32',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
  },
  whiteText: {
    color: '#ffffff',
    fontWeight: 700,
    textAlign: 'center',
  },
});