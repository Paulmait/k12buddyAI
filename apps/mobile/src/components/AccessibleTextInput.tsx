import React, { forwardRef } from 'react';
import {
  TextInput,
  TextInputProps,
  View,
  Text,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { useAccessibility } from '../contexts/AccessibilityContext';

interface AccessibleTextInputProps extends Omit<TextInputProps, 'style'> {
  label: string;
  accessibilityHint?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  containerStyle?: ViewStyle;
}

export const AccessibleTextInput = forwardRef<TextInput, AccessibleTextInputProps>(
  (
    {
      label,
      accessibilityHint,
      error,
      helperText,
      required = false,
      containerStyle,
      ...props
    },
    ref
  ) => {
    const { colors, scaledFont } = useAccessibility();

    const inputId = `input-${label.toLowerCase().replace(/\s+/g, '-')}`;

    return (
      <View style={[styles.container, containerStyle]}>
        <Text
          style={[
            styles.label,
            { fontSize: scaledFont(14), color: colors.text },
          ]}
          nativeID={`${inputId}-label`}
        >
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>

        <TextInput
          ref={ref}
          style={[
            styles.input,
            {
              fontSize: scaledFont(16),
              color: colors.text,
              borderColor: error ? colors.error : colors.border,
              backgroundColor: colors.surface,
            },
            error ? styles.inputError : undefined,
          ]}
          placeholderTextColor={colors.textSecondary}
          accessible={true}
          accessibilityLabel={`${label}${error ? `, Error: ${error}` : ''}`}
          accessibilityHint={accessibilityHint || `Enter ${label.toLowerCase()}`}
          accessibilityState={{
            disabled: props.editable === false,
          }}
          // Ensure minimum touch target
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          {...props}
        />

        {error && (
          <Text
            style={[
              styles.errorText,
              { fontSize: scaledFont(12), color: colors.error },
            ]}
            nativeID={`${inputId}-error`}
            accessibilityRole="alert"
          >
            {error}
          </Text>
        )}

        {helperText && !error && (
          <Text
            style={[
              styles.helperText,
              { fontSize: scaledFont(12), color: colors.textSecondary },
            ]}
            nativeID={`${inputId}-helper`}
          >
            {helperText}
          </Text>
        )}
      </View>
    );
  }
);

AccessibleTextInput.displayName = 'AccessibleTextInput';

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontWeight: '500',
    marginBottom: 6,
  },
  required: {
    color: '#DC2626',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 48, // Accessibility minimum
  },
  inputError: {
    borderWidth: 2,
  },
  errorText: {
    marginTop: 4,
    fontWeight: '500',
  },
  helperText: {
    marginTop: 4,
  },
});

export default AccessibleTextInput;
