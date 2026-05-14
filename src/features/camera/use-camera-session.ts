/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type RefObject,
  type ReactNode,
} from 'react';
import { useIsFocused } from '@react-navigation/native';
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
  type BarcodeType,
  type CameraCapturedPicture,
  type PermissionResponse,
} from 'expo-camera';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Linking, Platform, type GestureResponderEvent } from 'react-native';
import { useRouter, type Router } from 'expo-router';

import {
  analyzeImage,
  buildPerceptionChatDraft,
  getPerceptionCapabilities,
  type PerceptionAnalysis,
  type PerceptionBarcode,
  type PerceptionCapabilities,
} from '@/services/perception';
import { useChatDraftStore } from '@/store';

export type CameraFacing = 'back' | 'front';
export type SelectedImage = {
  uri: string;
  width: number;
  height: number;
  formatLabel: string;
  source: 'camera' | 'library';
};

export const LIVE_SCAN_INTERVAL_MS = 1800;
export const LIVE_BARCODE_TYPES: BarcodeType[] = [
  'aztec',
  'codabar',
  'code39',
  'code93',
  'code128',
  'datamatrix',
  'ean8',
  'ean13',
  'itf14',
  'pdf417',
  'qr',
  'upc_a',
  'upc_e',
];

export interface CameraState {
  facing: CameraFacing;
  liveScanEnabled: boolean;
  isCameraReady: boolean;
  isCapturing: boolean;
  isPickingImage: boolean;
  isAnalyzing: boolean;
  isLiveSampling: boolean;
  captureError: string | null;
  analysisError: string | null;
  analysis: PerceptionAnalysis | null;
  liveScanError: string | null;
  liveTierAnalysis: PerceptionAnalysis | null;
  liveBarcodes: PerceptionBarcode[];
  askPrompt: string;
  selectedImage: SelectedImage | null;
  cameraKey: number;
  capabilities: PerceptionCapabilities | null;
  capabilitiesError: string | null;
  focusPulse: boolean;
}

export type CameraAction =
  | { type: 'SET_FACING'; value: CameraFacing }
  | { type: 'FLIP_FACING' }
  | { type: 'SET_LIVE_SCAN'; value: boolean }
  | { type: 'TOGGLE_LIVE_SCAN' }
  | { type: 'SET_CAMERA_READY'; value: boolean }
  | { type: 'SET_CAPTURING'; value: boolean }
  | { type: 'SET_PICKING'; value: boolean }
  | { type: 'SET_ANALYZING'; value: boolean }
  | { type: 'SET_LIVE_SAMPLING'; value: boolean }
  | { type: 'SET_CAPTURE_ERROR'; value: string | null }
  | { type: 'SET_ANALYSIS_ERROR'; value: string | null }
  | { type: 'SET_ANALYSIS'; value: PerceptionAnalysis | null }
  | { type: 'SET_LIVE_SCAN_ERROR'; value: string | null }
  | { type: 'SET_LIVE_TIER'; value: PerceptionAnalysis | null }
  | { type: 'SET_LIVE_BARCODES'; value: PerceptionBarcode[] }
  | { type: 'SET_ASK'; value: string }
  | { type: 'SET_SELECTED'; value: SelectedImage | null }
  | { type: 'BUMP_CAMERA_KEY' }
  | { type: 'SET_CAPABILITIES'; value: PerceptionCapabilities | null }
  | { type: 'SET_CAPABILITIES_ERROR'; value: string | null }
  | { type: 'SET_FOCUS_PULSE'; value: boolean }
  | { type: 'RESET_FOR_NEW_FRAME' }
  | { type: 'RETAKE' };

const initial: CameraState = {
  facing: 'back',
  liveScanEnabled: true,
  isCameraReady: false,
  isCapturing: false,
  isPickingImage: false,
  isAnalyzing: false,
  isLiveSampling: false,
  captureError: null,
  analysisError: null,
  analysis: null,
  liveScanError: null,
  liveTierAnalysis: null,
  liveBarcodes: [],
  askPrompt: '',
  selectedImage: null,
  cameraKey: 0,
  capabilities: null,
  capabilitiesError: null,
  focusPulse: false,
};

function reducer(state: CameraState, action: CameraAction): CameraState {
  switch (action.type) {
    case 'SET_FACING':
      return { ...state, facing: action.value };
    case 'FLIP_FACING':
      return { ...state, facing: state.facing === 'back' ? 'front' : 'back' };
    case 'SET_LIVE_SCAN':
      return { ...state, liveScanEnabled: action.value };
    case 'TOGGLE_LIVE_SCAN':
      return { ...state, liveScanEnabled: !state.liveScanEnabled };
    case 'SET_CAMERA_READY':
      return { ...state, isCameraReady: action.value };
    case 'SET_CAPTURING':
      return { ...state, isCapturing: action.value };
    case 'SET_PICKING':
      return { ...state, isPickingImage: action.value };
    case 'SET_ANALYZING':
      return { ...state, isAnalyzing: action.value };
    case 'SET_LIVE_SAMPLING':
      return { ...state, isLiveSampling: action.value };
    case 'SET_CAPTURE_ERROR':
      return { ...state, captureError: action.value };
    case 'SET_ANALYSIS_ERROR':
      return { ...state, analysisError: action.value };
    case 'SET_ANALYSIS':
      return { ...state, analysis: action.value };
    case 'SET_LIVE_SCAN_ERROR':
      return { ...state, liveScanError: action.value };
    case 'SET_LIVE_TIER':
      return { ...state, liveTierAnalysis: action.value };
    case 'SET_LIVE_BARCODES':
      return { ...state, liveBarcodes: action.value };
    case 'SET_ASK':
      return { ...state, askPrompt: action.value };
    case 'SET_SELECTED':
      return { ...state, selectedImage: action.value };
    case 'BUMP_CAMERA_KEY':
      return { ...state, cameraKey: state.cameraKey + 1 };
    case 'SET_CAPABILITIES':
      return { ...state, capabilities: action.value };
    case 'SET_CAPABILITIES_ERROR':
      return { ...state, capabilitiesError: action.value };
    case 'SET_FOCUS_PULSE':
      return { ...state, focusPulse: action.value };
    case 'RESET_FOR_NEW_FRAME':
      return {
        ...state,
        captureError: null,
        analysis: null,
        analysisError: null,
        liveTierAnalysis: null,
        liveBarcodes: [],
        liveScanError: null,
        askPrompt: '',
      };
    case 'RETAKE':
      return {
        ...state,
        selectedImage: null,
        captureError: null,
        analysis: null,
        analysisError: null,
        liveTierAnalysis: null,
        liveBarcodes: [],
        liveScanError: null,
        askPrompt: '',
        isCameraReady: false,
        cameraKey: state.cameraKey + 1,
      };
    default:
      return state;
  }
}

function mergeBarcodes(
  primary: PerceptionBarcode[],
  secondary: PerceptionBarcode[]
): PerceptionBarcode[] {
  const seen = new Set<string>();
  const merged: PerceptionBarcode[] = [];
  for (const barcode of [...primary, ...secondary]) {
    const key = `${barcode.format}:${barcode.value}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(barcode);
  }
  return merged.slice(0, 6);
}

export function buildLiveCuesSnapshot(
  liveTier: PerceptionAnalysis | null,
  liveBarcodes: PerceptionBarcode[]
): PerceptionAnalysis | null {
  if (!liveTier && liveBarcodes.length === 0) {
    return null;
  }
  const mergedBarcodes = mergeBarcodes(liveBarcodes, liveTier?.barcodes ?? []);
  return {
    barcodes: mergedBarcodes,
    detectedLanguage: liveTier?.detectedLanguage ?? null,
    entities: liveTier?.entities ?? [],
    hints:
      liveTier?.hints.length
        ? liveTier.hints
        : mergedBarcodes.length > 0
          ? [`Found ${mergedBarcodes.length} live barcode${mergedBarcodes.length === 1 ? '' : 's'} in view.`]
          : [],
    objects: liveTier?.objects ?? [],
    ocrLines: liveTier?.ocrLines ?? [],
    ocrText: liveTier?.ocrText ?? '',
    source: liveTier?.source ?? (Platform.OS === 'ios' ? 'apple' : 'mlkit'),
  };
}

export function toSelectedImage(
  image: CameraCapturedPicture | ImagePicker.ImagePickerAsset
): SelectedImage {
  const fileName = 'fileName' in image ? image.fileName : undefined;
  const mimeType = 'mimeType' in image ? image.mimeType : undefined;
  const formatSource =
    'format' in image && image.format
      ? image.format
      : fileName?.split('.').pop()?.toLowerCase() || mimeType?.split('/')[1] || 'image';

  return {
    uri: image.uri,
    width: image.width,
    height: image.height,
    formatLabel: formatSource.toUpperCase(),
    source: 'format' in image ? 'camera' : 'library',
  };
}

interface CameraSessionValue {
  state: CameraState;
  dispatch: React.Dispatch<CameraAction>;
  cameraRef: RefObject<CameraView | null>;
  permission: PermissionResponse | null;
  requestPermission: () => Promise<PermissionResponse>;
  mediaPermission: ImagePicker.MediaLibraryPermissionResponse | null;
  requestMediaPermission: () => Promise<ImagePicker.MediaLibraryPermissionResponse>;
  isFocused: boolean;
  liveSnapshot: PerceptionAnalysis | null;
  analysisForChat: PerceptionAnalysis | null;
  canAnalyze: boolean;
  captureSummary: string | null;
  handleRequestPermission: () => void;
  handleFlipCamera: () => void;
  handlePreviewTap: (event: GestureResponderEvent) => void;
  handleResetCamera: () => void;
  handleRetake: () => void;
  handleCapture: () => Promise<void>;
  handlePickImage: () => Promise<void>;
  handleAnalyze: () => Promise<void>;
  handleBarcodeScanned: (result: BarcodeScanningResult) => void;
  handleSendToChat: () => void;
  handleToggleLiveScan: () => void;
}

const CameraSessionContext = createContext<CameraSessionValue | null>(null);

interface ProviderProps {
  children: ReactNode;
}

export function CameraSessionProvider({ children }: ProviderProps) {
  const [state, dispatch] = useReducer(reducer, initial);
  const cameraRef = useRef<CameraView | null>(null);
  const liveScanBusyRef = useRef(false);
  const isFocused = useIsFocused();
  const router: Router = useRouter();
  const setPendingDraft = useChatDraftStore((s) => s.setPendingDraft);
  const [permission, requestPermission] = useCameraPermissions();
  const [mediaPermission, requestMediaPermission] = ImagePicker.useMediaLibraryPermissions();

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const caps = await getPerceptionCapabilities();
        if (!cancelled) {
          dispatch({ type: 'SET_CAPABILITIES', value: caps });
          dispatch({ type: 'SET_CAPABILITIES_ERROR', value: null });
        }
      } catch (error) {
        if (!cancelled) {
          dispatch({ type: 'SET_CAPABILITIES', value: null });
          dispatch({
            type: 'SET_CAPABILITIES_ERROR',
            value:
              error instanceof Error
                ? error.message
                : 'Could not read perception capabilities.',
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRequestPermission = useCallback(() => {
    if (!permission) {
      return;
    }
    if (permission.canAskAgain) {
      void requestPermission();
      return;
    }
    void Linking.openSettings();
  }, [permission, requestPermission]);

  const handleFlipCamera = useCallback(() => {
    dispatch({ type: 'SET_CAPTURE_ERROR', value: null });
    dispatch({ type: 'FLIP_FACING' });
    dispatch({ type: 'BUMP_CAMERA_KEY' });
    dispatch({ type: 'SET_CAMERA_READY', value: false });
  }, []);

  const handlePreviewTap = useCallback(
    (_event: GestureResponderEvent) => {
      if (state.selectedImage || !cameraRef.current) {
        return;
      }
      void cameraRef.current.resumePreview?.().catch(() => {});
      dispatch({ type: 'SET_FOCUS_PULSE', value: true });
      setTimeout(() => dispatch({ type: 'SET_FOCUS_PULSE', value: false }), 900);
    },
    [state.selectedImage]
  );

  const handleResetCamera = useCallback(() => {
    dispatch({ type: 'SET_CAPTURE_ERROR', value: null });
    dispatch({ type: 'SET_CAMERA_READY', value: false });
    dispatch({ type: 'BUMP_CAMERA_KEY' });
  }, []);

  const handleRetake = useCallback(() => {
    dispatch({ type: 'RETAKE' });
  }, []);

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || !state.isCameraReady || state.isCapturing) {
      return;
    }
    dispatch({ type: 'RESET_FOR_NEW_FRAME' });
    dispatch({ type: 'SET_CAPTURING', value: true });
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        skipProcessing: false,
      });
      dispatch({ type: 'SET_SELECTED', value: toSelectedImage(photo) });
    } catch (error) {
      dispatch({
        type: 'SET_CAPTURE_ERROR',
        value:
          error instanceof Error
            ? error.message
            : 'OfflineAid could not capture a photo just now.',
      });
    } finally {
      dispatch({ type: 'SET_CAPTURING', value: false });
    }
  }, [state.isCameraReady, state.isCapturing]);

  const handlePickImage = useCallback(async () => {
    dispatch({ type: 'RESET_FOR_NEW_FRAME' });
    dispatch({ type: 'SET_PICKING', value: true });
    try {
      let permissionResult = mediaPermission;
      if (!permissionResult?.granted) {
        permissionResult = await requestMediaPermission();
      }
      if (!permissionResult.granted) {
        dispatch({
          type: 'SET_CAPTURE_ERROR',
          value: permissionResult.canAskAgain
            ? 'Photo library permission is required to import an image.'
            : 'Photo library access is turned off for OfflineAid. Open system settings to enable it again.',
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
        selectionLimit: 1,
      });

      if (result.canceled) {
        return;
      }

      dispatch({ type: 'SET_SELECTED', value: toSelectedImage(result.assets[0]) });
      dispatch({ type: 'SET_CAMERA_READY', value: false });
    } catch (error) {
      dispatch({
        type: 'SET_CAPTURE_ERROR',
        value:
          error instanceof Error
            ? error.message
            : 'OfflineAid could not import an image just now.',
      });
    } finally {
      dispatch({ type: 'SET_PICKING', value: false });
    }
  }, [mediaPermission, requestMediaPermission]);

  const handleAnalyze = useCallback(async () => {
    if (!state.selectedImage || state.isAnalyzing) {
      return;
    }
    if (Platform.OS === 'web') {
      dispatch({
        type: 'SET_ANALYSIS_ERROR',
        value: 'Image analysis is only available in the native OfflineAid app.',
      });
      return;
    }
    dispatch({ type: 'SET_ANALYZING', value: true });
    dispatch({ type: 'SET_ANALYSIS_ERROR', value: null });
    try {
      const nextAnalysis = await analyzeImage(state.selectedImage.uri, { tier: 'deep' });
      dispatch({ type: 'SET_ANALYSIS', value: nextAnalysis });
    } catch (error) {
      dispatch({
        type: 'SET_ANALYSIS_ERROR',
        value:
          error instanceof Error
            ? error.message
            : 'OfflineAid could not analyze that image just now.',
      });
    } finally {
      dispatch({ type: 'SET_ANALYZING', value: false });
    }
  }, [state.isAnalyzing, state.selectedImage]);

  const handleBarcodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (!state.liveScanEnabled || state.selectedImage) {
        return;
      }
      const value = result.data?.trim();
      const format = result.type?.trim();
      if (!value || !format) {
        return;
      }
      dispatch({
        type: 'SET_LIVE_BARCODES',
        value: mergeBarcodes([{ format, value }], state.liveBarcodes),
      });
    },
    [state.liveScanEnabled, state.selectedImage, state.liveBarcodes]
  );

  const liveSnapshot = state.selectedImage
    ? null
    : buildLiveCuesSnapshot(state.liveTierAnalysis, state.liveBarcodes);
  const analysisForChat = state.selectedImage ? state.analysis : liveSnapshot;

  const handleSendToChat = useCallback(() => {
    if (!analysisForChat) {
      return;
    }
    setPendingDraft(buildPerceptionChatDraft(analysisForChat, state.askPrompt));
    router.push('/');
  }, [analysisForChat, state.askPrompt, router, setPendingDraft]);

  const handleToggleLiveScan = useCallback(() => {
    dispatch({ type: 'TOGGLE_LIVE_SCAN' });
    dispatch({ type: 'SET_LIVE_SCAN_ERROR', value: null });
  }, []);

  useEffect(() => {
    if (
      Platform.OS === 'web' ||
      !state.liveScanEnabled ||
      !isFocused ||
      !permission?.granted ||
      !state.isCameraReady ||
      state.selectedImage !== null
    ) {
      dispatch({ type: 'SET_LIVE_SAMPLING', value: false });
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const scheduleNext = (delayMs: number) => {
      if (cancelled) {
        return;
      }
      timer = setTimeout(() => {
        void sampleFrame();
      }, delayMs);
    };

    const sampleFrame = async () => {
      if (
        cancelled ||
        !cameraRef.current ||
        liveScanBusyRef.current ||
        state.isCapturing ||
        state.isPickingImage ||
        state.selectedImage !== null
      ) {
        scheduleNext(LIVE_SCAN_INTERVAL_MS);
        return;
      }

      liveScanBusyRef.current = true;
      dispatch({ type: 'SET_LIVE_SAMPLING', value: true });
      dispatch({ type: 'SET_LIVE_SCAN_ERROR', value: null });

      let frameUri: string | null = null;
      try {
        const frame = await cameraRef.current.takePictureAsync({
          quality: 0.25,
          shutterSound: false,
          skipProcessing: true,
        });
        frameUri = frame.uri;
        const nextAnalysis = await analyzeImage(frame.uri, { tier: 'live' });
        if (!cancelled) {
          dispatch({ type: 'SET_LIVE_TIER', value: nextAnalysis });
          if (nextAnalysis.barcodes.length > 0) {
            dispatch({
              type: 'SET_LIVE_BARCODES',
              value: mergeBarcodes(nextAnalysis.barcodes, state.liveBarcodes),
            });
          }
        }
      } catch (error) {
        if (!cancelled) {
          dispatch({
            type: 'SET_LIVE_SCAN_ERROR',
            value:
              error instanceof Error
                ? error.message
                : 'OfflineAid could not sample the current camera view.',
          });
        }
      } finally {
        if (frameUri) {
          try {
            const tempFile = new File(frameUri);
            if (tempFile.exists) {
              tempFile.delete();
            }
          } catch {
            // Best-effort temp cleanup only.
          }
        }
        liveScanBusyRef.current = false;
        if (!cancelled) {
          dispatch({ type: 'SET_LIVE_SAMPLING', value: false });
          scheduleNext(LIVE_SCAN_INTERVAL_MS);
        }
      }
    };

    scheduleNext(350);

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
      liveScanBusyRef.current = false;
    };
  }, [
    state.isCameraReady,
    state.isCapturing,
    isFocused,
    state.isPickingImage,
    state.liveScanEnabled,
    permission?.granted,
    state.selectedImage,
    state.liveBarcodes,
  ]);

  const captureSummary = useMemo(
    () =>
      state.selectedImage !== null
        ? `${state.selectedImage.width} × ${state.selectedImage.height} • ${state.selectedImage.formatLabel} • ${state.selectedImage.source === 'camera' ? 'Camera' : 'Library'}`
        : null,
    [state.selectedImage]
  );

  const canAnalyze =
    state.selectedImage !== null &&
    !state.isAnalyzing &&
    !state.isCapturing &&
    !state.isPickingImage;

  const value: CameraSessionValue = {
    state,
    dispatch,
    cameraRef,
    permission,
    requestPermission,
    mediaPermission,
    requestMediaPermission,
    isFocused,
    liveSnapshot,
    analysisForChat,
    canAnalyze,
    captureSummary,
    handleRequestPermission,
    handleFlipCamera,
    handlePreviewTap,
    handleResetCamera,
    handleRetake,
    handleCapture,
    handlePickImage,
    handleAnalyze,
    handleBarcodeScanned,
    handleSendToChat,
    handleToggleLiveScan,
  };

  return createElement(CameraSessionContext.Provider, { value }, children);
}

export function useCameraSession(): CameraSessionValue {
  const value = useContext(CameraSessionContext);
  if (!value) {
    throw new Error('useCameraSession must be used inside <CameraSessionProvider>');
  }
  return value;
}
