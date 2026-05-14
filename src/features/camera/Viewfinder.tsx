/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { CameraView } from 'expo-camera';
import { Image } from 'expo-image';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { CameraMode } from './CameraSession';
import { LIVE_BARCODE_TYPES, useCameraSession } from './use-camera-session';

type ViewfinderProps = {
  mode: CameraMode;
};

export function Viewfinder({ mode }: ViewfinderProps) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const {
    state,
    cameraRef,
    permission,
    isFocused,
    handlePreviewTap,
    handleFlipCamera,
    handleCapture,
    handleResetCamera,
    handleRetake,
    handlePickImage,
    handleBarcodeScanned,
    dispatch,
  } = useCameraSession();

  // Library mode replaces the live preview shell with a focused picker. The
  // user came here to pick from the photo roll; the camera is irrelevant.
  if (mode === 'library') {
    return (
      <>
        <View style={styles.cameraShell}>
          {state.selectedImage && state.selectedImage.source === 'library' ? (
            <Image
              source={state.selectedImage.uri}
              contentFit="cover"
              style={styles.cameraPreview}
            />
          ) : (
            <View style={styles.cameraPlaceholder}>
              <Text style={styles.placeholderIcon}>🖼️</Text>
              <Text style={styles.placeholderTitle}>Pick a photo</Text>
              <Text style={styles.placeholderText}>
                Choose an existing image from your library to send into chat.
              </Text>
            </View>
          )}
        </View>

        {state.selectedImage && state.selectedImage.source === 'library' ? (
          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
            onPress={handleRetake}
            accessibilityRole="button"
            accessibilityLabel="Clear image">
            <Text style={styles.primaryButtonText}>Clear image</Text>
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              state.isPickingImage && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => void handlePickImage()}
            disabled={state.isPickingImage}
            accessibilityRole="button"
            accessibilityLabel={
              state.isPickingImage ? 'Opening library' : 'Pick from photo library'
            }>
            <Text style={styles.primaryButtonText}>
              {state.isPickingImage ? 'Opening library…' : 'Pick from photo library'}
            </Text>
          </Pressable>
        )}
      </>
    );
  }

  // Photo + Scan share the live viewfinder. Difference is in the controls
  // (Photo shows the shutter; Scan hides it because LiveScanOverlay handles
  // results) and the absent library shortcut (now its own tab).
  return (
    <>
      <View style={styles.cameraShell}>
        {permission?.granted ? (
          state.selectedImage ? (
            <Image
              source={state.selectedImage.uri}
              contentFit="cover"
              style={styles.cameraPreview}
            />
          ) : (
            <View style={styles.cameraPreviewHost}>
              <CameraView
                key={state.cameraKey}
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                barcodeScannerSettings={{ barcodeTypes: LIVE_BARCODE_TYPES }}
                facing={state.facing}
                active={isFocused}
                mode="picture"
                {...(Platform.OS === 'ios' ? { autofocus: 'on' as const } : {})}
                onBarcodeScanned={mode === 'scan' ? handleBarcodeScanned : undefined}
                onCameraReady={() => {
                  dispatch({ type: 'SET_CAPTURE_ERROR', value: null });
                  dispatch({ type: 'SET_CAMERA_READY', value: true });
                }}
                onMountError={(event) => {
                  dispatch({ type: 'SET_CAMERA_READY', value: false });
                  dispatch({
                    type: 'SET_CAPTURE_ERROR',
                    value: event.message || 'OfflineAid could not start the camera.',
                  });
                }}
              />
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={handlePreviewTap}
                accessibilityRole="button"
                accessibilityLabel="Focus camera on this point"
              />
              {state.focusPulse ? (
                <View pointerEvents="none" style={styles.focusPulseOverlay} />
              ) : null}
            </View>
          )
        ) : (
          <View style={styles.cameraPlaceholder}>
            {!permission ? (
              <>
                <ActivityIndicator color={theme.accentStrong} size="small" />
                <Text style={styles.placeholderText}>Preparing camera permissions…</Text>
              </>
            ) : (
              <>
                <Text style={styles.placeholderIcon}>📷</Text>
                <Text style={styles.placeholderTitle}>Camera access is not enabled yet</Text>
                <Text style={styles.placeholderText}>
                  Once permission is granted, the live camera view will appear here.
                </Text>
              </>
            )}
          </View>
        )}
      </View>

      <View style={styles.controls}>
        <Pressable
          style={({ pressed }) => [
            styles.secondaryButton,
            (!permission?.granted ||
              state.isCapturing ||
              state.isPickingImage ||
              state.selectedImage?.source === 'library') &&
              styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleFlipCamera}
          disabled={
            !permission?.granted ||
            state.isCapturing ||
            state.isPickingImage ||
            state.selectedImage?.source === 'library'
          }
          accessibilityRole="button"
          accessibilityLabel={`Use ${state.facing === 'back' ? 'front' : 'rear'} camera`}>
          <Text style={styles.secondaryButtonText}>
            Use {state.facing === 'back' ? 'front' : 'rear'} camera
          </Text>
        </Pressable>

        {state.selectedImage ? (
          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
            onPress={handleRetake}
            accessibilityRole="button"
            accessibilityLabel={
              state.selectedImage.source === 'camera' ? 'Retake' : 'Clear image'
            }>
            <Text style={styles.primaryButtonText}>
              {state.selectedImage.source === 'camera' ? 'Retake' : 'Clear image'}
            </Text>
          </Pressable>
        ) : mode === 'photo' ? (
          <>
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                (!permission?.granted ||
                  !state.isCameraReady ||
                  state.isCapturing ||
                  state.isPickingImage) &&
                  styles.buttonDisabled,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => void handleCapture()}
              disabled={
                !permission?.granted ||
                !state.isCameraReady ||
                state.isCapturing ||
                state.isPickingImage
              }
              accessibilityRole="button"
              accessibilityLabel={state.isCapturing ? 'Capturing' : 'Capture photo'}>
              <Text style={styles.primaryButtonText}>
                {state.isCapturing ? 'Capturing…' : 'Capture photo'}
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.secondaryButton,
                (!permission?.granted || state.isCapturing || state.isPickingImage) &&
                  styles.buttonDisabled,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleResetCamera}
              disabled={!permission?.granted || state.isCapturing || state.isPickingImage}
              accessibilityRole="button"
              accessibilityLabel="Reset camera">
              <Text style={styles.secondaryButtonText}>Reset camera</Text>
            </Pressable>
          </>
        ) : null}
      </View>
    </>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    cameraShell: {
      borderRadius: 28,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.borderStrong,
      backgroundColor: theme.surfaceMuted,
      minHeight: 420,
    },
    cameraPreview: {
      width: '100%',
      minHeight: 420,
    },
    cameraPreviewHost: {
      width: '100%',
      minHeight: 420,
      position: 'relative',
    },
    focusPulseOverlay: {
      ...StyleSheet.absoluteFillObject,
      borderWidth: 3,
      borderColor: 'rgba(255, 255, 255, 0.85)',
      borderRadius: 12,
    },
    cameraPlaceholder: {
      minHeight: 420,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.four,
      gap: 12,
      backgroundColor: theme.surfaceMuted,
    },
    placeholderIcon: {
      fontSize: 40,
    },
    placeholderTitle: {
      color: theme.text,
      fontSize: 20,
      fontWeight: '700',
      textAlign: 'center',
    },
    placeholderText: {
      color: theme.textMuted,
      fontSize: 14,
      lineHeight: 21,
      textAlign: 'center',
    },
    controls: {
      flexDirection: 'row',
      gap: 12,
    },
    libraryButton: {
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 18,
      backgroundColor: theme.surfaceStrong,
      borderWidth: 1,
      borderColor: theme.borderStrong,
      paddingHorizontal: Spacing.three,
    },
    libraryButtonText: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '700',
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
