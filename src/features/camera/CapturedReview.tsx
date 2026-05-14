/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { useCameraSession } from './use-camera-session';

export function CapturedReview() {
  const theme = useTheme();
  const styles = createStyles(theme);
  const {
    state,
    canAnalyze,
    analysisForChat,
    captureSummary,
    handleAnalyze,
    handleSendToChat,
    dispatch,
  } = useCameraSession();

  return (
    <>
      <View style={styles.notesCard}>
        <Text style={styles.notesTitle}>Perception</Text>
        <Text style={styles.notesBody}>
          Run a higher-fidelity pass on the latest captured image, then hand that summary into chat
          only when you want Gemma to reason over it.
        </Text>
        <View style={styles.controls}>
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              !canAnalyze && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => void handleAnalyze()}
            disabled={!canAnalyze}
            accessibilityRole="button"
            accessibilityLabel={state.isAnalyzing ? 'Analyzing…' : 'Analyze image'}>
            <Text style={styles.primaryButtonText}>
              {state.isAnalyzing ? 'Analyzing…' : 'Analyze image'}
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.secondaryButton,
              !analysisForChat && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleSendToChat}
            disabled={!analysisForChat}
            accessibilityRole="button"
            accessibilityLabel={
              state.selectedImage ? 'Ask captured image in chat' : 'Ask current view in chat'
            }>
            <Text style={styles.secondaryButtonText}>
              {state.selectedImage ? 'Ask captured image in chat' : 'Ask current view in chat'}
            </Text>
          </Pressable>
        </View>
        <TextInput
          style={styles.askInput}
          value={state.askPrompt}
          onChangeText={(value) => dispatch({ type: 'SET_ASK', value })}
          placeholder={
            state.selectedImage
              ? 'What do you want to know about this captured image?'
              : 'What do you want to know about the current view?'
          }
          placeholderTextColor={theme.inputPlaceholder}
          editable={!!analysisForChat}
          multiline
        />
        {state.analysisError ? <Text style={styles.errorText}>{state.analysisError}</Text> : null}
      </View>

      {state.analysis ? (
        <View style={styles.analysisCard}>
          <Text style={styles.notesTitle}>Capture insights</Text>
          <Text style={styles.analysisMeta}>
            Source: {state.analysis.source === 'apple' ? 'Apple frameworks' : 'ML Kit'}
          </Text>
          {state.analysis.detectedLanguage ? (
            <Text style={styles.analysisMeta}>
              Language: {state.analysis.detectedLanguage.tag}
              {typeof state.analysis.detectedLanguage.confidence === 'number'
                ? ` (${Math.round(state.analysis.detectedLanguage.confidence * 100)}%)`
                : ''}
            </Text>
          ) : null}
          {state.analysis.hints.length > 0 ? (
            <View style={styles.analysisSection}>
              <Text style={styles.analysisHeading}>Hints</Text>
              {state.analysis.hints.map((hint) => (
                <Text key={hint} style={styles.analysisItem}>
                  • {hint}
                </Text>
              ))}
            </View>
          ) : null}
          {state.analysis.ocrText ? (
            <View style={styles.analysisSection}>
              <Text style={styles.analysisHeading}>OCR text</Text>
              <Text style={styles.analysisBody}>{state.analysis.ocrText}</Text>
            </View>
          ) : null}
          {state.analysis.entities.length > 0 ? (
            <View style={styles.analysisSection}>
              <Text style={styles.analysisHeading}>Entities</Text>
              {state.analysis.entities.slice(0, 8).map((entity, index) => (
                <Text
                  key={`${entity.type}-${entity.text}-${index}`}
                  style={styles.analysisItem}>
                  • {entity.type}: {entity.value ?? entity.text}
                </Text>
              ))}
            </View>
          ) : null}
          {state.analysis.barcodes.length > 0 ? (
            <View style={styles.analysisSection}>
              <Text style={styles.analysisHeading}>Barcodes</Text>
              {state.analysis.barcodes.map((barcode) => (
                <Text key={`${barcode.format}-${barcode.value}`} style={styles.analysisItem}>
                  • {barcode.format}: {barcode.value}
                </Text>
              ))}
            </View>
          ) : null}
          {state.analysis.objects.length > 0 ? (
            <View style={styles.analysisSection}>
              <Text style={styles.analysisHeading}>Visual labels</Text>
              {state.analysis.objects.map((item) => (
                <Text key={item.label} style={styles.analysisItem}>
                  • {item.label}
                  {typeof item.confidence === 'number'
                    ? ` (${Math.round(item.confidence * 100)}%)`
                    : ''}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.notesCard}>
        <Text style={styles.notesTitle}>Current behavior</Text>
        <Text style={styles.notesBody}>
          Captured and imported images stay local to the device and are not uploaded anywhere.
          Perception results are generated locally and can be sent into chat as a structured
          summary when you want the assistant to reason over them.
        </Text>
        {captureSummary ? (
          <Text style={styles.captureMeta}>Latest capture: {captureSummary}</Text>
        ) : null}
        {state.captureError ? <Text style={styles.errorText}>{state.captureError}</Text> : null}
      </View>
    </>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    notesCard: {
      backgroundColor: theme.backgroundElement,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 18,
      gap: 10,
    },
    analysisCard: {
      backgroundColor: theme.backgroundElement,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.borderStrong,
      padding: 18,
      gap: 10,
    },
    notesTitle: {
      color: theme.text,
      fontSize: 18,
      fontWeight: '700',
    },
    notesBody: {
      color: theme.textSecondary,
      fontSize: 14,
      lineHeight: 21,
    },
    captureMeta: {
      color: theme.successText,
      fontSize: 13,
      fontWeight: '600',
    },
    analysisMeta: {
      color: theme.textMuted,
      fontSize: 13,
      fontWeight: '600',
    },
    analysisSection: {
      gap: 6,
    },
    analysisHeading: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '700',
    },
    analysisBody: {
      color: theme.textSecondary,
      fontSize: 14,
      lineHeight: 21,
    },
    analysisItem: {
      color: theme.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },
    errorText: {
      color: theme.warningText,
      fontSize: 13,
      fontWeight: '600',
    },
    askInput: {
      minHeight: 52,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.inputBorder,
      backgroundColor: theme.inputBackground,
      color: theme.text,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      lineHeight: 20,
      textAlignVertical: 'top',
    },
    controls: {
      flexDirection: 'row',
      gap: 12,
    },
    primaryButton: {
      flex: 1,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 999,
      backgroundColor: theme.buttonPrimary,
      paddingHorizontal: Spacing.three,
    },
    primaryButtonText: {
      color: theme.buttonText,
      fontSize: 14,
      fontWeight: '700',
    },
    secondaryButton: {
      flex: 1,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 999,
      backgroundColor: theme.backgroundElement,
      borderWidth: 1,
      borderColor: theme.borderStrong,
      paddingHorizontal: Spacing.three,
    },
    secondaryButtonText: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '700',
    },
    buttonPressed: {
      opacity: 0.84,
    },
    buttonDisabled: {
      opacity: 0.5,
      backgroundColor: theme.surfaceMuted,
      borderColor: theme.border,
    },
  });
}
