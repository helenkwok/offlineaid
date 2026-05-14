require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name             = "OfflineAidPerception"
  s.version          = package["version"]
  s.summary          = package["description"]
  s.description      = package["description"]
  s.license          = package["license"] || "Proprietary"
  s.author           = package["author"] || "OfflineAid"
  s.homepage         = "https://developer.apple.com/documentation/vision"
  s.platforms        = {
    :ios => "15.1"
  }
  s.swift_version    = "5.9"
  s.source           = { :path => "." }
  s.static_framework = true

  s.dependency "ExpoModulesCore"

  s.source_files = "ios/**/*.{h,m,mm,swift}"
  s.frameworks = ["Foundation", "NaturalLanguage", "Speech", "Vision"]
  s.pod_target_xcconfig = {
    "DEFINES_MODULE" => "YES",
    "SWIFT_COMPILATION_MODE" => "wholemodule"
  }

  install_modules_dependencies(s)
end
