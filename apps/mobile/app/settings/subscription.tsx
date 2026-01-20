import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

interface Plan {
  id: string;
  name: string;
  price: string;
  period: string;
  features: string[];
  popular?: boolean;
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    features: [
      '5 AI questions per day',
      'Basic homework help',
      'Limited subject coverage',
    ],
  },
  {
    id: 'basic',
    name: 'Basic',
    price: '$4.99',
    period: 'month',
    features: [
      '50 AI questions per day',
      'Full homework help',
      'All K-12 subjects',
      'Photo scanning',
    ],
    popular: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$9.99',
    period: 'month',
    features: [
      'Unlimited AI questions',
      'Priority support',
      'All K-12 subjects',
      'Photo scanning',
      'Progress tracking',
      'Parent dashboard',
    ],
  },
  {
    id: 'family',
    name: 'Family',
    price: '$14.99',
    period: 'month',
    features: [
      'Up to 5 children',
      'Unlimited AI questions',
      'All Pro features',
      'Family dashboard',
      'Shared progress reports',
    ],
  },
];

export default function SubscriptionScreen() {
  const [currentPlan] = useState('free');
  const [loading, setLoading] = useState(false);

  async function handleSelectPlan(plan: Plan) {
    if (plan.id === currentPlan) {
      Alert.alert('Current Plan', 'You are already on this plan.');
      return;
    }

    if (plan.id === 'free') {
      Alert.alert(
        'Downgrade',
        'Are you sure you want to downgrade to the free plan?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Downgrade',
            style: 'destructive',
            onPress: () => {
              Alert.alert('Success', 'Plan changed to Free');
            },
          },
        ]
      );
      return;
    }

    setLoading(true);
    // TODO: Implement actual payment flow with Stripe/RevenueCat
    setTimeout(() => {
      setLoading(false);
      Alert.alert(
        'Coming Soon',
        'Subscription payments will be available soon. For now, enjoy the free plan!',
        [{ text: 'OK' }]
      );
    }, 500);
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Choose Your Plan</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>
          Unlock more features and help your child learn better
        </Text>

        {/* Plans */}
        {PLANS.map((plan) => (
          <TouchableOpacity
            key={plan.id}
            style={[
              styles.planCard,
              plan.popular && styles.planCardPopular,
              currentPlan === plan.id && styles.planCardCurrent,
            ]}
            onPress={() => handleSelectPlan(plan)}
            disabled={loading}
          >
            {plan.popular && (
              <View style={styles.popularBadge}>
                <Text style={styles.popularBadgeText}>Most Popular</Text>
              </View>
            )}

            <View style={styles.planHeader}>
              <Text style={[styles.planName, plan.popular && styles.planNamePopular]}>
                {plan.name}
              </Text>
              <View style={styles.priceContainer}>
                <Text style={[styles.planPrice, plan.popular && styles.planPricePopular]}>
                  {plan.price}
                </Text>
                <Text style={styles.planPeriod}>/{plan.period}</Text>
              </View>
            </View>

            <View style={styles.featuresContainer}>
              {plan.features.map((feature, index) => (
                <View key={index} style={styles.featureRow}>
                  <Text style={styles.featureCheck}>✓</Text>
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>

            <View
              style={[
                styles.selectButton,
                currentPlan === plan.id && styles.selectButtonCurrent,
                plan.popular && styles.selectButtonPopular,
              ]}
            >
              <Text
                style={[
                  styles.selectButtonText,
                  currentPlan === plan.id && styles.selectButtonTextCurrent,
                  plan.popular && styles.selectButtonTextPopular,
                ]}
              >
                {currentPlan === plan.id ? 'Current Plan' : 'Select Plan'}
              </Text>
            </View>
          </TouchableOpacity>
        ))}

        {/* Restore Purchase */}
        <TouchableOpacity style={styles.restoreButton}>
          <Text style={styles.restoreText}>Restore Purchases</Text>
        </TouchableOpacity>

        {/* Terms */}
        <Text style={styles.terms}>
          Subscriptions auto-renew unless cancelled at least 24 hours before the end of the current period.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
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
  scrollView: {
    flex: 1,
    padding: 16,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  planCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  planCardPopular: {
    borderColor: '#4F46E5',
  },
  planCardCurrent: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    alignSelf: 'center',
    backgroundColor: '#4F46E5',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  planName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  planNamePopular: {
    color: '#4F46E5',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  planPrice: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
  },
  planPricePopular: {
    color: '#4F46E5',
  },
  planPeriod: {
    fontSize: 14,
    color: '#6B7280',
  },
  featuresContainer: {
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureCheck: {
    fontSize: 16,
    color: '#10B981',
    marginRight: 8,
    fontWeight: '600',
  },
  featureText: {
    fontSize: 14,
    color: '#4B5563',
  },
  selectButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  selectButtonPopular: {
    backgroundColor: '#4F46E5',
  },
  selectButtonCurrent: {
    backgroundColor: '#D1FAE5',
  },
  selectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563',
  },
  selectButtonTextPopular: {
    color: '#fff',
  },
  selectButtonTextCurrent: {
    color: '#059669',
  },
  restoreButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  restoreText: {
    fontSize: 14,
    color: '#4F46E5',
    fontWeight: '500',
  },
  terms: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 32,
  },
});
