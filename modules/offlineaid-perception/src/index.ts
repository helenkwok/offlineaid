export type PerceptionCapabilities = {
  canAnalyzeImage: boolean;
  canTranscribeAudio: boolean;
  canDetectLanguage: boolean;
  canExtractEntities: boolean;
  imageSource: 'mlkit' | 'apple';
  supportedBarcodeFormats: string[];
};
