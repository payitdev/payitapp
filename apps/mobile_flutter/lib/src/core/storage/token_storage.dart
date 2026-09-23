import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class TokenStorage {
  static const _tokenKey = 'proxim_auth_token';
  static const _activeEntityKey = 'proxim_active_entity_id';

  final FlutterSecureStorage _storage;
  String? _cachedToken;
  String? _cachedActiveEntityId;

  TokenStorage([FlutterSecureStorage? storage])
      : _storage = storage ?? const FlutterSecureStorage();

  Future<void> saveToken(String token) async {
    _cachedToken = token;
    try {
      await _storage.write(key: _tokenKey, value: token);
    } catch (e) {
      debugPrint('[TokenStorage] Note: Error writing token to secure storage: $e');
    }
  }

  Future<String?> getToken() async {
    if (_cachedToken != null) return _cachedToken;
    try {
      _cachedToken = await _storage.read(key: _tokenKey);
    } catch (e) {
      debugPrint('[TokenStorage] Note: Error reading token: $e');
    }
    return _cachedToken;
  }

  Future<void> saveActiveEntityId(String entityId) async {
    _cachedActiveEntityId = entityId;
    try {
      await _storage.write(key: _activeEntityKey, value: entityId);
    } catch (e) {
      debugPrint('[TokenStorage] Note: Error writing entity ID: $e');
    }
  }

  Future<String?> getActiveEntityId() async {
    if (_cachedActiveEntityId != null) return _cachedActiveEntityId;
    try {
      _cachedActiveEntityId = await _storage.read(key: _activeEntityKey);
    } catch (e) {
      debugPrint('[TokenStorage] Note: Error reading entity ID: $e');
    }
    return _cachedActiveEntityId;
  }

  Future<void> clear() async {
    _cachedToken = null;
    _cachedActiveEntityId = null;
    try {
      await _storage.delete(key: _tokenKey);
      await _storage.delete(key: _activeEntityKey);
    } catch (e) {
      debugPrint('[TokenStorage] Note: Error clearing storage: $e');
    }
  }
}
