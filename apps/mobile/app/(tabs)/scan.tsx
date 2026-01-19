import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { uploadStudentImage, processOCR } from '../../src/lib/api';
import { getCurrentUser, getStudentProfile } from '../../src/lib/supabase';
import { useGamification } from '../../src/contexts/GamificationContext';
import { Analytics } from '../../src/lib/analytics';

export default function ScanScreen() {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  // Gamification hooks
  const { recordScan, studentId } = useGamification();

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
      setResult(null);
    }
  }

  async function handleProcess() {
    if (!image) return;

    setLoading(true);
    setResult(null);

    try {
      const user = await getCurrentUser();
      if (!user) throw new Error('Not logged in');

      const student = await getStudentProfile(user.id);

      // Upload image
      const imagePath = await uploadStudentImage(student.id, image, 'scan');

      // Process with OCR
      const ocrResult = await processOCR(student.id, imagePath);

      setResult(ocrResult.raw_text);

      // Award XP for completing a scan
      await recordScan();

      // Track analytics event
      if (studentId) {
        Analytics.scanCompleted(studentId, true);
      }
    } catch (error) {
      console.error('Error processing image:', error);
      Alert.alert('Error', 'Failed to process image. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setImage(null);
    setResult(null);
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

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4F46E5" />
              <Text style={styles.loadingText}>Analyzing image...</Text>
            </View>
          ) : result ? (
            <View style={styles.resultContainer}>
              <Text style={styles.resultTitle}>Extracted Text:</Text>
              <Text style={styles.resultText}>{result}</Text>
              <TouchableOpacity
                style={styles.askButton}
                onPress={() => {
                  // TODO: Navigate to chat with extracted text
                  Alert.alert(
                    'Coming Soon',
                    'This will open the chat with your scanned content!'
                  );
                }}
              >
                <Text style={styles.askButtonText}>Ask About This</Text>
              </TouchableOpacity>
            </View>
          ) : (
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
          )}
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
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  resultContainer: {
    flex: 1,
    padding: 20,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  resultText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  askButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  askButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
