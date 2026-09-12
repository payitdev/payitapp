import 'package:flutter/foundation.dart';

class ApiConfig {
  ApiConfig._();

  /// Default API base URL. Can be overridden with:
  /// flutter run --dart-define=API_BASE_URL=http://localhost:3001
  /// or --dart-define=API_URL=http://localhost:3001
  static String get baseUrl {
    const fromBaseUrl = String.fromEnvironment('API_BASE_URL');
    if (fromBaseUrl.isNotEmpty) return fromBaseUrl;

    const fromApiUrl = String.fromEnvironment('API_URL');
    if (fromApiUrl.isNotEmpty) return fromApiUrl;
    
    // On web or localhost desktop:
    if (kIsWeb) return 'http://localhost:3001';
    // On Android Emulator localhost is 10.0.2.2:
    if (defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:3001';
    }
    return 'http://localhost:3001';
  }

  static const Duration connectTimeout = Duration(seconds: 15);
  static const Duration receiveTimeout = Duration(seconds: 15);
}

class ProximException implements Exception {
  final String message;
  final int? statusCode;
  final String? code;

  const ProximException(this.message, {this.statusCode, this.code});

  @override
  String toString() => message;
}
