import 'package:flutter/foundation.dart';

class ApiConfig {
  ApiConfig._();

  /// Default API base URL. Can be overridden with:
  /// flutter run --dart-define=API_URL=https://api.proxim.app
  static String get baseUrl {
    const fromEnv = String.fromEnvironment('API_URL');
    if (fromEnv.isNotEmpty) return fromEnv;
    
    // On web or localhost desktop:
    if (kIsWeb) return 'http://localhost:3000';
    // On Android Emulator localhost is 10.0.2.2:
    if (defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:3000';
    }
    return 'http://localhost:3000';
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
