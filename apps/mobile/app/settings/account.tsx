import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import {
  getUserProfile,
  requestAccountDeletion,
  cancelDeletionRequest,
  hasPendingDeletion,
  signOut,
  getLinkedParent,
  getLinkedChildren,
} from '../../src/lib/accountService';

interface AccountInfo {
  accountType: string;
  email: string;
  hasDeletionPending: boolean;
  deletionScheduledFor?: Date;
  linkedParent?: { display_name?: string } | null;
  linkedChildren: Array<{ id: string; display_name?: string }>;
}

export default function AccountSettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [accountInfo, setAccountInfo] = useState<AccountInfo>({
    accountType: 'student',
    email: '',
    hasDeletionPending: false,
    linkedChildren: [],
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadAccountInfo();
  }, []);

  async function loadAccountInfo() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const profile = await getUserProfile();
      const deletionStatus = await hasPendingDeletion();
      const linkedParent = await getLinkedParent();
      const linkedChildren = await getLinkedChildren();

      setAccountInfo({
        accountType: profile?.account_type || 'student',
        email: user?.email || '',
        hasDeletionPending: deletionStatus.pending,
        deletionScheduledFor: deletionStatus.scheduledFor,
        linkedParent,
        linkedChildren,
      });
    } catch (error) {
      console.error('Error loading account info:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText.toLowerCase() !== 'delete') {
      Alert.alert('Error', 'Please type "DELETE" to confirm');
      return;
    }

    setDeleting(true);
    try {
      const result = await requestAccountDeletion();

      if (result.success) {
        setShowDeleteModal(false);
        Alert.alert(
          'Account Deletion Scheduled',
          `Your account will be permanently deleted on ${result.scheduledFor?.toLocaleDateString()}. You have ${result.gracePeriodDays} days to cancel this request.`,
          [
            {
              text: 'OK',
              onPress: () => {
                loadAccountInfo();
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to request deletion');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to request deletion');
    } finally {
      setDeleting(false);
      setDeleteConfirmText('');
    }
  }

  async function handleCancelDeletion() {
    Alert.alert(
      'Cancel Deletion',
      'Are you sure you want to cancel your account deletion request?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel Deletion',
          onPress: async () => {
            const result = await cancelDeletionRequest();
            if (result.success) {
              Alert.alert('Success', 'Account deletion request cancelled');
              loadAccountInfo();
            } else {
              Alert.alert('Error', result.error || 'Failed to cancel deletion');
            }
          },
        },
      ]
    );
  }

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
        },
      },
    ]);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Account Settings</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Account Type */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>

          <View style={styles.infoItem}>
            <Text style={styles.infoIcon}>👤</Text>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Account Type</Text>
              <Text style={styles.infoValue}>
                {accountInfo.accountType.charAt(0).toUpperCase() + accountInfo.accountType.slice(1)}
              </Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <Text style={styles.infoIcon}>📧</Text>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{accountInfo.email}</Text>
            </View>
          </View>
        </View>

        {/* Linked Accounts */}
        {(accountInfo.linkedParent || accountInfo.linkedChildren.length > 0) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Linked Accounts</Text>

            {accountInfo.linkedParent && (
              <View style={styles.infoItem}>
                <Text style={styles.infoIcon}>👨‍👩‍👧</Text>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Parent</Text>
                  <Text style={styles.infoValue}>
                    {accountInfo.linkedParent.display_name || 'Linked Parent'}
                  </Text>
                </View>
              </View>
            )}

            {accountInfo.linkedChildren.map(child => (
              <View key={child.id} style={styles.infoItem}>
                <Text style={styles.infoIcon}>🧒</Text>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Child</Text>
                  <Text style={styles.infoValue}>
                    {child.display_name || 'Linked Child'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Pending Deletion */}
        {accountInfo.hasDeletionPending && (
          <View style={styles.deletionWarning}>
            <Text style={styles.deletionWarningIcon}>⚠️</Text>
            <View style={styles.deletionWarningContent}>
              <Text style={styles.deletionWarningTitle}>Account Deletion Pending</Text>
              <Text style={styles.deletionWarningText}>
                Your account will be permanently deleted on{' '}
                {accountInfo.deletionScheduledFor?.toLocaleDateString()}.
              </Text>
              <TouchableOpacity
                style={styles.cancelDeletionButton}
                onPress={handleCancelDeletion}
              >
                <Text style={styles.cancelDeletionText}>Cancel Deletion</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={styles.sectionTitleDanger}>Danger Zone</Text>

          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <Text style={styles.signOutIcon}>🚪</Text>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>

          {!accountInfo.hasDeletionPending && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => setShowDeleteModal(true)}
            >
              <Text style={styles.deleteIcon}>🗑️</Text>
              <Text style={styles.deleteText}>Delete Account</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalIcon}>⚠️</Text>
            <Text style={styles.modalTitle}>Delete Your Account?</Text>
            <Text style={styles.modalText}>
              This will permanently delete all your data including:
            </Text>
            <View style={styles.modalList}>
              <Text style={styles.modalListItem}>• Your profile and settings</Text>
              <Text style={styles.modalListItem}>• All chat history</Text>
              <Text style={styles.modalListItem}>• XP, badges, and achievements</Text>
              <Text style={styles.modalListItem}>• Uploaded images and files</Text>
            </View>
            <Text style={styles.modalNote}>
              You have 30 days to cancel this request before data is permanently removed.
            </Text>

            <Text style={styles.confirmLabel}>Type DELETE to confirm</Text>
            <TextInput
              style={styles.confirmInput}
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              placeholder="DELETE"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="characters"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText('');
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalDeleteButton,
                  deleteConfirmText.toLowerCase() !== 'delete' && styles.modalDeleteButtonDisabled,
                ]}
                onPress={handleDeleteAccount}
                disabled={deleteConfirmText.toLowerCase() !== 'delete' || deleting}
              >
                <Text style={styles.modalDeleteText}>
                  {deleting ? 'Processing...' : 'Delete Account'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  backButtonIcon: {
    fontSize: 24,
    color: '#4F46E5',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  placeholder: {
    width: 40,
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 16,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
    paddingHorizontal: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionTitleDanger: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
    marginBottom: 8,
    paddingHorizontal: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  infoIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
  },
  deletionWarning: {
    flexDirection: 'row',
    backgroundColor: '#FEF2F2',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  deletionWarningIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  deletionWarningContent: {
    flex: 1,
  },
  deletionWarningTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DC2626',
    marginBottom: 4,
  },
  deletionWarningText: {
    fontSize: 14,
    color: '#991B1B',
    marginBottom: 12,
  },
  cancelDeletionButton: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DC2626',
    alignSelf: 'flex-start',
  },
  cancelDeletionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  signOutIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  signOutText: {
    fontSize: 16,
    color: '#1F2937',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FEF2F2',
  },
  deleteIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  deleteText: {
    fontSize: 16,
    color: '#DC2626',
    fontWeight: '500',
  },
  bottomPadding: {
    height: 32,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalIcon: {
    fontSize: 48,
    textAlign: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalList: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  modalListItem: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  modalNote: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  confirmLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  confirmInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  modalDeleteButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#DC2626',
    alignItems: 'center',
  },
  modalDeleteButtonDisabled: {
    backgroundColor: '#FECACA',
  },
  modalDeleteText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
