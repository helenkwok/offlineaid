package expo.modules.offlineaidperception

import android.net.Uri
import android.speech.SpeechRecognizer
import android.util.Patterns
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.nl.languageid.LanguageIdentification
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.label.ImageLabeling
import com.google.mlkit.vision.label.defaults.ImageLabelerOptions
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.util.regex.Matcher
import java.util.regex.Pattern

class OfflineAidPerceptionModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("OfflineAidPerception")

    AsyncFunction("getCapabilitiesAsync") {
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val speechAvailable = SpeechRecognizer.isRecognitionAvailable(context)
      val supportedFormats = listOf(
        "aztec", "codabar", "code39", "code93", "code128", "data-matrix",
        "ean8", "ean13", "itf", "pdf417", "qr", "upc-a", "upc-e",
      )

      mapOf(
        "canAnalyzeImage" to true,
        "canTranscribeAudio" to speechAvailable,
        "canDetectLanguage" to true,
        "canExtractEntities" to true,
        "imageSource" to "mlkit",
        "supportedBarcodeFormats" to supportedFormats,
      )
    }

    AsyncFunction("analyzeImageAsync") { imagePath: String ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val file = File(imagePath)
      if (!file.exists()) {
        throw IllegalStateException("Image file is missing at $imagePath")
      }

      val image = InputImage.fromFilePath(context, Uri.fromFile(file))
      val textRecognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
      val barcodeScanner = BarcodeScanning.getClient(
        BarcodeScannerOptions.Builder()
          .setBarcodeFormats(
            Barcode.FORMAT_AZTEC,
            Barcode.FORMAT_CODABAR,
            Barcode.FORMAT_CODE_39,
            Barcode.FORMAT_CODE_93,
            Barcode.FORMAT_CODE_128,
            Barcode.FORMAT_DATA_MATRIX,
            Barcode.FORMAT_EAN_8,
            Barcode.FORMAT_EAN_13,
            Barcode.FORMAT_ITF,
            Barcode.FORMAT_PDF417,
            Barcode.FORMAT_QR_CODE,
            Barcode.FORMAT_UPC_A,
            Barcode.FORMAT_UPC_E
          )
          .build()
      )
      val imageLabeler = ImageLabeling.getClient(ImageLabelerOptions.DEFAULT_OPTIONS)
      val languageIdentifier = LanguageIdentification.getClient()

      try {
        val textResult = Tasks.await(textRecognizer.process(image))
        val ocrText = textResult.text.trim()
        val languageTag = if (ocrText.isNotEmpty()) {
          val tag = Tasks.await(languageIdentifier.identifyLanguage(ocrText))
          if (tag == "und") null else tag
        } else {
          null
        }

        val barcodes = Tasks.await(barcodeScanner.process(image))
        val labels = Tasks.await(imageLabeler.process(image))
        val entities = extractEntities(ocrText)

        mapOf(
          "ocrText" to ocrText,
          "ocrLines" to textResult.textBlocks
            .flatMap { block -> block.lines }
            .mapNotNull { line ->
              val text = line.text.trim()
              if (text.isEmpty()) null else text
            },
          "detectedLanguage" to languageTag?.let { mapOf("tag" to it) },
          "entities" to entities,
          "barcodes" to barcodes.mapNotNull(::toBarcodeMap),
          "objects" to labels
            .filter { it.confidence >= 0.35f }
            .take(5)
            .map { label ->
              mapOf(
                "label" to label.text,
                "confidence" to label.confidence.toDouble()
              )
            },
          "source" to "mlkit"
        )
      } finally {
        textRecognizer.close()
        barcodeScanner.close()
        imageLabeler.close()
        languageIdentifier.close()
      }
    }

    AsyncFunction("transcribeAudioAsync") { _: String, _: String? ->
      ""
    }
  }

  private fun extractEntities(text: String): List<Map<String, Any>> {
    if (text.isBlank()) {
      return emptyList()
    }

    val entities = mutableListOf<Map<String, Any>>()
    Patterns.WEB_URL.matcher(text).collectMatches("url", entities)
    Patterns.EMAIL_ADDRESS.matcher(text).collectMatches("email", entities)
    Patterns.PHONE.matcher(text).collectMatches("phone", entities)
    DATE_PATTERN.matcher(text).collectMatches("datetime", entities)
    MONEY_PATTERN.matcher(text).collectMatches("money", entities)

    return entities.distinctBy { item -> "${item["type"]}:${item["text"]}" }
  }

  private fun Matcher.collectMatches(type: String, output: MutableList<Map<String, Any>>) {
    while (find()) {
      val excerpt = group()?.trim().orEmpty()
      if (excerpt.isEmpty()) {
        continue
      }
      output += buildMap {
        put("type", type)
        put("text", excerpt)
        put("start", start())
        put("end", end())
      }
    }
  }

  private fun toBarcodeMap(barcode: Barcode): Map<String, Any>? {
    val value = barcode.rawValue?.trim()
    if (value.isNullOrEmpty()) {
      return null
    }

    return mapOf(
      "format" to barcodeFormatName(barcode.format),
      "value" to value
    )
  }

  private fun barcodeFormatName(format: Int): String {
    return when (format) {
      Barcode.FORMAT_AZTEC -> "aztec"
      Barcode.FORMAT_CODABAR -> "codabar"
      Barcode.FORMAT_CODE_39 -> "code39"
      Barcode.FORMAT_CODE_93 -> "code93"
      Barcode.FORMAT_CODE_128 -> "code128"
      Barcode.FORMAT_DATA_MATRIX -> "data-matrix"
      Barcode.FORMAT_EAN_8 -> "ean8"
      Barcode.FORMAT_EAN_13 -> "ean13"
      Barcode.FORMAT_ITF -> "itf"
      Barcode.FORMAT_PDF417 -> "pdf417"
      Barcode.FORMAT_QR_CODE -> "qr"
      Barcode.FORMAT_UPC_A -> "upc-a"
      Barcode.FORMAT_UPC_E -> "upc-e"
      else -> "unknown"
    }
  }

  companion object {
    private val DATE_PATTERN: Pattern = Pattern.compile(
      """\b(?:\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?|\d{4}[/-]\d{1,2}[/-]\d{1,2}|\d{1,2}:\d{2}(?:\s?[APMapm]{2})?)\b"""
    )
    private val MONEY_PATTERN: Pattern = Pattern.compile(
      """(?:[$€£¥]\s?\d[\d,]*(?:\.\d{2})?|\b\d[\d,]*(?:\.\d{2})?\s?(?:USD|EUR|GBP|AUD|HKD|JPY|CNY)\b)""",
      Pattern.CASE_INSENSITIVE
    )
  }
}
