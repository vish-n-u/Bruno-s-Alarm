Pod::Spec.new do |s|
  s.name           = 'BrunoAlarmKit'
  s.version        = '1.0.0'
  s.summary        = "Bruno's Alarm: real iPhone alarms through Apple's AlarmKit (iOS 26+)."
  s.description    = s.summary
  s.author         = ''
  s.homepage       = 'https://brunos-alarm.vercel.app'
  s.license        = { :type => 'Proprietary' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.swift_version  = '5.9'

  s.dependency 'ExpoModulesCore'
  # AlarmKit only exists on iOS 26+, so it's weak-linked: the app still launches on older
  # iPhones, and the module reports isSupported() == false there.
  s.weak_frameworks = 'AlarmKit'

  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.{h,m,swift}'
end
