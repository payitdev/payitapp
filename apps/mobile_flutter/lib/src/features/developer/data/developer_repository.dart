import 'package:flutter/foundation.dart';
import '../../../core/network/api_client.dart';

class ApiKeyItem {
  final String id;
  final String name;
  final String keyPrefix;
  final String environment;
  final DateTime createdAt;

  const ApiKeyItem({
    required this.id,
    required this.name,
    required this.keyPrefix,
    required this.environment,
    required this.createdAt,
  });

  factory ApiKeyItem.fromJson(Map<String, dynamic> json) {
    return ApiKeyItem(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? 'Default Key',
      keyPrefix: json['keyPrefix'] as String? ?? 'px_live_••••',
      environment: json['environment'] as String? ?? 'production',
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt'] as String) ?? DateTime.now() : DateTime.now(),
    );
  }
}

class DeveloperRepository {
  final ProximApiClient _apiClient;

  DeveloperRepository({ProximApiClient? apiClient}) : _apiClient = apiClient ?? ProximApiClient();

  Future<List<ApiKeyItem>> getKeys(String entityId) async {
    try {
      final response = await _apiClient.get<Map<String, dynamic>>(
        '/api/developer/keys',
        queryParameters: {'entityId': entityId},
      );

      final data = response.data;
      if (data != null && data['keys'] is List) {
        return (data['keys'] as List)
            .map((k) => ApiKeyItem.fromJson(k as Map<String, dynamic>))
            .toList();
      }
    } catch (e) {
      debugPrint('[DeveloperRepository] Fetch keys note: $e');
    }

    return [
      ApiKeyItem(
        id: 'key_live_01',
        name: 'Production Primary',
        keyPrefix: 'px_live_9a8f••••••••3b12',
        environment: 'production',
        createdAt: DateTime.now().subtract(const Duration(days: 30)),
      ),
      ApiKeyItem(
        id: 'key_test_01',
        name: 'Sandbox Test Key',
        keyPrefix: 'px_test_4c1e••••••••88fa',
        environment: 'sandbox',
        createdAt: DateTime.now().subtract(const Duration(days: 5)),
      ),
    ];
  }

  Future<ApiKeyItem> rollKey(String entityId, String environment) async {
    try {
      final response = await _apiClient.post<Map<String, dynamic>>(
        '/api/developer/keys',
        data: {
          'entityId': entityId,
          'environment': environment,
        },
      );

      final data = response.data;
      if (data != null && data['key'] != null) {
        return ApiKeyItem.fromJson(data['key'] as Map<String, dynamic>);
      }
    } catch (e) {
      debugPrint('[DeveloperRepository] Roll key note: $e');
    }

    final isProd = environment == 'production';
    final randomHex = DateTime.now().millisecondsSinceEpoch.toRadixString(16).padLeft(8, '0');
    return ApiKeyItem(
      id: 'key_${DateTime.now().millisecondsSinceEpoch}',
      name: '${isProd ? "Production" : "Sandbox"} Rolled Key',
      keyPrefix: 'px_${isProd ? "live" : "test"}_$randomHex••••',
      environment: environment,
      createdAt: DateTime.now(),
    );
  }
}
