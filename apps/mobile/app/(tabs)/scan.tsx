import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export default function ScanScreen() {
  const [image, setImage] = useState<string | null>(null);

  async function pickImage(useCamera: boolean) {
    const permissionResult = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert(
        'Permission Required',
        `Please allow access to your ${useCamera ? 'camera' : 'photos'} to scan pages.`
      );
      return;
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.8,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.8,
        });

    if (!result.canceled && result.assets[0]) {
      setImage(result.assets[0].uri);
    }
  }

  function handleProcess() {
    Alert.alert('Coming Soon', 'OCR processing will be available soon!');
  }

  function handleClear() {
    setImage(null);
  }

  return (
    <View style={styles.container}>
      {!image ? (
        <View style={styles.selectContainer}>
          <Text style={styles.title}>Scan Your Work</Text>
          <Text style={styles.subtitle}>
            Take a photo or select an image of your textbook, worksheet, or homework
          </Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => pickImage(true)}
            >
              <Text style={styles.selectIcon}>📷</Text>
              <Text style={styles.selectLabel}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => pickImage(false)}
            >
              <Text style={styles.selectIcon}>🖼️</Text>
              <Text style={styles.selectLabel}>Choose Photo</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tips}>
            <Text style={styles.tipsTitle}>Tips for best results:</Text>
            <Text style={styles.tipText}>• Make sure the page is well-lit</Text>
            <Text style={styles.tipText}>• Keep the camera steady</Text>
            <Text style={styles.tipText}>• Include the whole page in frame</Text>
          </View>
        </View>
      ) : (
        <View style={styles.previewContainer}>
          <Image source={{ uri: image }} style={styles.preview} />

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.processButton}
              onPress={handleProcess}
            >
              <Text style={styles.processButtonText}>Process Image</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.retakeButton}
              onPress={handleClear}
            >
              <Text style={styles.retakeButtonText}>Retake</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  selectContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  selectButton: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minWidth: 140,
  },
  selectIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  selectLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  tips: {
    marginTop: 40,
    padding: 20,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    width: '100%',
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 8,
  },
  tipText: {
    fontSize: 14,
    color: '#92400E',
    marginBottom: 4,
  },
  previewContainer: {
    flex: 1,
  },
  preview: {
    width: '100%',
    height: 300,
    resizeMode: 'contain',
    backgroundColor: '#000',
  },
  actionButtons: {
    padding: 20,
    gap: 12,
  },
  processButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  processButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  retakeButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  retakeButtonText: {
    color: '#4B5563',
    fontSize: 16,
    fontWeight: '600',
  },
});
