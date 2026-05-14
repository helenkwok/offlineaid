import ExpoModulesCore
import Foundation
import NaturalLanguage
import Speech
import Vision

public final class OfflineAidPerceptionModule: Module {
  public func definition() -> ModuleDefinition {
    Name("OfflineAidPerception")

    AsyncFunction("getCapabilitiesAsync") { () throws -> [String: Any] in
      let recognizer = SFSpeechRecognizer()
      let canTranscribe = recognizer?.isAvailable ?? false

      return [
        "canAnalyzeImage": true,
        "canTranscribeAudio": canTranscribe,
        "canDetectLanguage": true,
        "canExtractEntities": true,
        "imageSource": "apple",
        "supportedBarcodeFormats": [
          "aztec", "codabar", "code39", "code93", "code128", "data-matrix",
          "ean8", "ean13", "itf", "pdf417", "qr", "upc-a", "upc-e",
        ],
      ]
    }

    AsyncFunction("analyzeImageAsync") { (imagePath: String) throws -> [String: Any] in
      let fileURL = URL(fileURLWithPath: imagePath)
      guard FileManager.default.fileExists(atPath: fileURL.path) else {
        throw PerceptionModuleError(message: "Image file is missing at \(imagePath)")
      }

      let requestHandler = VNImageRequestHandler(url: fileURL)

      let textRequest = VNRecognizeTextRequest()
      textRequest.recognitionLevel = .accurate
      textRequest.usesLanguageCorrection = true

      let barcodeRequest = VNDetectBarcodesRequest()
      let classificationRequest = VNClassifyImageRequest()

      try requestHandler.perform([textRequest, barcodeRequest, classificationRequest])

      let ocrLines = (textRequest.results as? [VNRecognizedTextObservation] ?? [])
        .compactMap { $0.topCandidates(1).first?.string.trimmingCharacters(in: .whitespacesAndNewlines) }
        .filter { !$0.isEmpty }
      let ocrText = ocrLines.joined(separator: "\n")

      let detectedLanguage = detectLanguage(for: ocrText)
      let entities = extractEntities(from: ocrText)
      let barcodes = (barcodeRequest.results as? [VNBarcodeObservation] ?? []).compactMap { observation in
        guard let value = observation.payloadStringValue?.trimmingCharacters(in: .whitespacesAndNewlines),
              !value.isEmpty else {
          return nil
        }
        return [
          "format": observation.symbology.rawValue,
          "value": value,
        ]
      }
      let objects = (classificationRequest.results as? [VNClassificationObservation] ?? [])
        .filter { $0.confidence >= 0.35 }
        .prefix(5)
        .map { observation in
          [
            "label": observation.identifier,
            "confidence": Double(observation.confidence),
          ]
        }

      var result: [String: Any] = [
        "ocrText": ocrText,
        "ocrLines": ocrLines,
        "entities": entities,
        "barcodes": barcodes,
        "objects": objects,
        "source": "apple",
      ]

      if let detectedLanguage {
        result["detectedLanguage"] = detectedLanguage
      }

      return result
    }

    AsyncFunction("transcribeAudioAsync") { (audioPath: String, localeTag: String?) async throws -> String in
      let fileURL = URL(fileURLWithPath: audioPath)
      guard FileManager.default.fileExists(atPath: fileURL.path) else {
        throw PerceptionModuleError(message: "Audio file is missing at \(audioPath)")
      }

      let authorizationStatus = await requestSpeechAuthorizationIfNeeded()
      guard authorizationStatus == .authorized else {
        throw PerceptionModuleError(
          message: "Speech recognition permission is required for Audio Scribe on iOS."
        )
      }

      let recognizer = if let localeTag, !localeTag.isEmpty {
        SFSpeechRecognizer(locale: Locale(identifier: localeTag))
      } else {
        SFSpeechRecognizer()
      }

      guard let recognizer else {
        throw PerceptionModuleError(message: "Apple speech transcription is not available for this locale.")
      }
      guard recognizer.isAvailable else {
        throw PerceptionModuleError(message: "Apple speech transcription is not available right now on this device.")
      }

      let request = SFSpeechURLRecognitionRequest(url: fileURL)
      request.requiresOnDeviceRecognition = true
      request.shouldReportPartialResults = false
      if #available(iOS 16.0, *) {
        request.addsPunctuation = true
      }

      return try await withCheckedThrowingContinuation { continuation in
        var didResume = false
        let task = recognizer.recognitionTask(with: request) { result, error in
          if didResume {
            return
          }

          if let error {
            didResume = true
            continuation.resume(throwing: PerceptionModuleError(message: error.localizedDescription))
            return
          }

          guard let result, result.isFinal else {
            return
          }

          didResume = true
          let transcript = result.bestTranscription.formattedString.trimmingCharacters(in: .whitespacesAndNewlines)
          continuation.resume(returning: transcript)
        }

        Task {
          try? await Task.sleep(for: .seconds(45))
          if didResume {
            return
          }
          didResume = true
          task.cancel()
          continuation.resume(throwing: PerceptionModuleError(message: "Apple speech transcription timed out. Try a shorter clip."))
        }
      }
    }
  }

  private func detectLanguage(for text: String) -> [String: Any]? {
    guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
      return nil
    }

    let recognizer = NLLanguageRecognizer()
    recognizer.processString(text)
    guard let language = recognizer.dominantLanguage else {
      return nil
    }

    let confidence = recognizer.languageHypotheses(withMaximum: 1)[language] ?? 0
    return [
      "tag": language.rawValue,
      "confidence": confidence,
    ]
  }

  private func extractEntities(from text: String) -> [[String: Any]] {
    guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
      return []
    }

    var entities: [[String: Any]] = []
    let nsText = text as NSString
    let fullRange = NSRange(location: 0, length: nsText.length)

    let tagger = NLTagger(tagSchemes: [.nameType])
    tagger.string = text
    tagger.enumerateTags(
      in: text.startIndex..<text.endIndex,
      unit: .word,
      scheme: .nameType,
      options: [.joinNames, .omitPunctuation, .omitWhitespace]
    ) { tag, tokenRange in
      guard let tag else {
        return true
      }

      let type: String?
      switch tag {
      case .personalName:
        type = "person"
      case .placeName:
        type = "place"
      case .organizationName:
        type = "organization"
      default:
        type = nil
      }

      guard let type else {
        return true
      }

      let token = String(text[tokenRange]).trimmingCharacters(in: .whitespacesAndNewlines)
      guard !token.isEmpty else {
        return true
      }

      let range = NSRange(tokenRange, in: text)
      entities.append([
        "type": type,
        "text": token,
        "start": range.location,
        "end": range.location + range.length,
      ])
      return true
    }

    if let detector = try? NSDataDetector(
      types: NSTextCheckingResult.CheckingType.link.rawValue
        | NSTextCheckingResult.CheckingType.phoneNumber.rawValue
        | NSTextCheckingResult.CheckingType.date.rawValue
        | NSTextCheckingResult.CheckingType.address.rawValue
    ) {
      detector.enumerateMatches(in: text, options: [], range: fullRange) { match, _, _ in
        guard let match else {
          return
        }

        let excerpt = nsText.substring(with: match.range).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !excerpt.isEmpty else {
          return
        }

        switch match.resultType {
        case .link:
          var entity: [String: Any] = [
            "type": "url",
            "text": excerpt,
            "start": match.range.location,
            "end": match.range.location + match.range.length,
          ]
          if let value = match.url?.absoluteString {
            entity["value"] = value
          }
          entities.append(entity)
        case .phoneNumber:
          var entity: [String: Any] = [
            "type": "phone",
            "text": excerpt,
            "start": match.range.location,
            "end": match.range.location + match.range.length,
          ]
          if let value = match.phoneNumber {
            entity["value"] = value
          }
          entities.append(entity)
        case .date:
          var entity: [String: Any] = [
            "type": "datetime",
            "text": excerpt,
            "start": match.range.location,
            "end": match.range.location + match.range.length,
          ]
          if let value = match.date?.ISO8601Format() {
            entity["value"] = value
          }
          entities.append(entity)
        case .address:
          entities.append([
            "type": "address",
            "text": excerpt,
            "start": match.range.location,
            "end": match.range.location + match.range.length,
          ])
        default:
          break
        }
      }
    }

    var seen = Set<String>()
    return entities.filter { entity in
      guard let type = entity["type"] as? String, let text = entity["text"] as? String else {
        return false
      }
      let key = "\(type):\(text.lowercased())"
      if seen.contains(key) {
        return false
      }
      seen.insert(key)
      return true
    }
  }

  private func requestSpeechAuthorizationIfNeeded() async -> SFSpeechRecognizerAuthorizationStatus {
    let status = SFSpeechRecognizer.authorizationStatus()
    if status != .notDetermined {
      return status
    }

    return await withCheckedContinuation { continuation in
      SFSpeechRecognizer.requestAuthorization { nextStatus in
        continuation.resume(returning: nextStatus)
      }
    }
  }
}

private struct PerceptionModuleError: LocalizedError {
  let message: String

  var errorDescription: String? {
    message
  }
}
