import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  AccessibilityRole,
  ActivityIndicator,
} from 'react-native';
import { useAccessibility } from '../contexts/AccessibilityContext';

interface AccessibleButtonProps {
  onPress: () => void;
  label: string;
  accessibilityHint?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityRole?: AccessibilityRole;
}

export function AccessibleButton({
  onPress,
  label,
  accessibilityHint,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  icon,
  style,
  textStyle,
  accessibilityRole = 'button',
}: AccessibleButtonProps) {
  const { colors, scaledFont } = useAccessibility();

  const getButtonStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      // Minimum touch target for accessibility
      minHeight: 44,
      minWidth: 44,
    };

    // Size variations
    switch (size) {
      case 'small':
        baseStyle.paddingHorizontal = 12;
        baseStyle.paddingVertical = 8;
        break;
      case 'large':
        baseStyle.paddingHorizontal = 24;
        baseStyle.paddingVertical = 16;
        break;
      default:
        baseStyle.paddingHorizontal = 16;
        baseStyle.paddingVertical = 12;
    }

    // Variant styles
    switch (variant) {
      case 'primary':
        baseStyle.backgroundColor = disabled ? '#C7D2FE' : colors.primary;
        break;
      case 'secondary':
        baseStyle.backgroundColor = disabled ? '#F3F4F6' : colors.primaryLight;
        break;
      case 'outline':
        baseStyle.backgroundColor = 'transparent';
        baseStyle.borderWidth = 2;
        baseStyle.borderColor = disabled ? '#D1D5DB' : colors.primary;
        break;
      case 'ghost':
        baseStyle.backgroundColor = 'transparent';
        break;
    }

    return baseStyle;
  };

  const getTextStyle = (): TextStyle => {
    const baseTextSize = size === 'small' ? 14 : size === 'large' ? 18 : 16;

    const textStyles: TextStyle = {
      fontSize: scaledFont(baseTextSize),
      fontWeight: '600',
    };

    // Text color based on variant
    switch (variant) {
      case 'primary':
        textStyles.color = '#FFFFFF';
        break;
      case 'secondary':
      case 'outline':
      case 'ghost':
        textStyles.color = disabled ? '#9CA3AF' : colors.primary;
        break;
    }

    return textStyles;
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[getButtonStyle(), style]}
      accessible={true}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityRole={accessibilityRole}
      accessibilityState={{
        disabled: disabled || loading,
        busy: loading,
      }}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? '#FFFFFF' : colors.primary}
          size="small"
        />
      ) : (
        <>
          {icon && <>{icon}</>}
          <Text style={[getTextStyle(), icon ? styles.textWithIcon : undefined, textStyle]}>
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  textWithIcon: {
    marginLeft: 8,
  },
});

export default AccessibleButton;
