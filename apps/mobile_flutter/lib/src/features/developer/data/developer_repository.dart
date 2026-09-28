import 'dart:convert';

import 'package:flutter/foundation.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_config.dart';

class ApiKeyItem {
  final String id;
  final String name;
  final String keyPrefix;
  final String environment; // 'live' | 'test'
  final DateTime createdAt;
  final DateTime? lastUsedAt;
  final List<String> scopes;
  final String? secretKey; // Full secret — only present right after rolling

  const ApiKeyItem({
    required this.id,
    required this.name,
    required this.keyPrefix,
    required this.environment,
    required this.createdAt,
    this.lastUsedAt,
    this.scopes = const [],
    this.secretKey,
  });

  factory ApiKeyItem.fromJson(Map<String, dynamic> json) {
    List<String> parseScopes() {
      final raw = json['scopes'];
      if (raw is List) return raw.map((s) => s.toString()).toList();
      if (raw is String) {
        try {
          return (jsonDecode(raw) as List).map((s) => s.toString()).toList();
        } catch (_) {
          return const [];
        }
      }
      return const [];
    }

    DateTime? parseDate(String? value) => value != null ? DateTime.tryParse(value) : null;

    return ApiKeyItem(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? 'API Key',
      keyPrefix: json['keyPrefix'] as String? ?? '',
      environment: json['environment'] as String? ?? 'live',
      createdAt: parseDate(json['createdAt'] as String?) ?? DateTime.now(),
      lastUsedAt: parseDate(json['lastUsedAt'] as String?),
      scopes: parseScopes(),
      secretKey: json['secretKey'] as String?,
    );
  }
}

class WebhookEndpoint {
  final String id;
  final String url;
  final List<String> events;
  final bool isActive;
  final DateTime createdAt;

  const WebhookEndpoint({
    required this.id,
    required this.url,
    required this.events,
    required this.isActive,
    required this.createdAt,
  });

  factory WebhookEndpoint.fromJson(Map<String, dynamic> json) {
    final raw = json['events'];
    List<String> events;
    if (raw is List) {
      events = raw.map((e) => e.toString()).toList();
    } else if (raw is String) {
      try {
        events = (jsonDecode(raw) as List).map((e) => e.toString()).toList();
      } catch (_) {
        events = const [];
      }
    } else {
      events = const [];
    }

    return WebhookEndpoint(
      id: json['id'] as String? ?? '',
      url: json['url'] as String? ?? '',
      events: events,
      isActive: json['isActive'] as bool? ?? true,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String) ?? DateTime.now()
          : DateTime.now(),
    );
  }
}

class WebhookDelivery {
  final String id;
  final String webhookEndpointId;
  final String event;
  final String status; // 'PENDING' | 'DELIVERED' | 'FAILED' | 'RETRYING'
  final int attempts;
  final int? responseStatus;
  final DateTime createdAt;

  const WebhookDelivery({
    required this.id,
    required this.webhookEndpointId,
    required this.event,
    required this.status,
    required this.attempts,
    required this.createdAt,
    this.responseStatus,
  });

  bool get isDelivered => status == 'DELIVERED';
  bool get hasFailed => status == 'FAILED';

  factory WebhookDelivery.fromJson(Map<String, dynamic> json) {
    return WebhookDelivery(
      id: json['id'] as String? ?? '',
      webhookEndpointId: json['webhookEndpointId'] as String? ?? '',
      event: json['event'] as String? ?? '',
      status: (json['status'] as String? ?? 'PENDING').toUpperCase(),
      attempts: (json['attempts'] as num?)?.toInt() ?? 0,
      responseStatus: (json['responseStatus'] as num?)?.toInt(),
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String) ?? DateTime.now()
          : DateTime.now(),
    );
  }
}

class ApiLogItem {
  final String id;
  final String method;
  final String endpoint;
  final int statusCode;
  final int durationMs;
  final String? ipAddress;
  final DateTime createdAt;

  const ApiLogItem({
    required this.id,
    required this.method,
    required this.endpoint,
    required this.statusCode,
    required this.durationMs,
    required this.createdAt,
    this.ipAddress,
  });

  factory ApiLogItem.fromJson(Map<String, dynamic> json) {
    return ApiLogItem(
      id: json['id'] as String? ?? '',
      method: json['method'] as String? ?? 'GET',
      endpoint: json['endpoint'] as String? ?? '',
      statusCode: (json['statusCode'] as num?)?.toInt() ?? 0,
      durationMs: (json['durationMs'] as num?)?.toInt() ?? 0,
      ipAddress: json['ipAddress'] as String?,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String) ?? DateTime.now()
          : DateTime.now(),
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
      return [];
    } catch (e) {
      if (ApiConfig.isDemoMode) {
        debugPrint('[DeveloperRepository] Demo mode: using demo keys.');
        return _demoKeys();
      }
      rethrow;
    }
  }

  Future<ApiKeyItem> rollKey(String entityId, String environment, {String? name}) async {
    try {
      final response = await _apiClient.post<Map<String, dynamic>>(
        '/api/developer/keys',
        data: {
          'entityId': entityId,
          'environment': environment,
          'name': ?name,
        },
      );

      final data = response.data;
      final keyData = data?['apiKey'] ?? data?['key'];
      if (keyData != null) {
        return ApiKeyItem.fromJson(keyData as Map<String, dynamic>);
      }
      throw const ProximException('Key generation failed. Please try again.');
    } catch (e) {
      if (ApiConfig.isDemoMode) {
        final isLive = environment == 'live';
        final randomHex = DateTime.now().millisecondsSinceEpoch.toRadixString(16).padLeft(8, '0');
        return ApiKeyItem(
          id: 'key_${DateTime.now().millisecondsSinceEpoch}',
          name: name ?? '${isLive ? "Production" : "Sandbox"} Rolled Key',
          keyPrefix: 'px_${isLive ? "live" : "test"}_sk_${randomHex}12',
          environment: environment,
          createdAt: DateTime.now(),
        );
      }
      rethrow;
    }
  }

  Future<List<WebhookEndpoint>> getWebhooks(String entityId) async {
    try {
      final response = await _apiClient.get<Map<String, dynamic>>(
        '/api/developer/webhooks',
        queryParameters: {'entityId': entityId},
      );

      final data = response.data;
      if (data != null && data['endpoints'] is List) {
        return (data['endpoints'] as List)
            .map((e) => WebhookEndpoint.fromJson(e as Map<String, dynamic>))
            .toList();
      }
      return [];
    } catch (e) {
      if (ApiConfig.isDemoMode) {
        debugPrint('[DeveloperRepository] Demo mode: no webhook endpoints.');
        return const [];
      }
      rethrow;
    }
  }

  Future<List<WebhookDelivery>> getWebhookDeliveries(String entityId) async {
    try {
      final response = await _apiClient.get<Map<String, dynamic>>(
        '/api/developer/webhooks/deliveries',
        queryParameters: {'entityId': entityId},
      );

      final data = response.data;
      if (data != null && data['deliveries'] is List) {
        return (data['deliveries'] as List)
            .map((d) => WebhookDelivery.fromJson(d as Map<String, dynamic>))
            .toList();
      }
      return [];
    } catch (e) {
      if (ApiConfig.isDemoMode) {
        debugPrint('[DeveloperRepository] Demo mode: no webhook deliveries.');
        return const [];
      }
      rethrow;
    }
  }

  Future<List<ApiLogItem>> getApiLogs(String entityId) async {
    try {
      final response = await _apiClient.get<Map<String, dynamic>>(
        '/api/developer/logs',
        queryParameters: {'entityId': entityId},
      );

      final data = response.data;
      if (data != null && data['logs'] is List) {
        return (data['logs'] as List)
            .map((l) => ApiLogItem.fromJson(l as Map<String, dynamic>))
            .toList();
      }
      return [];
    } catch (e) {
      if (ApiConfig.isDemoMode) {
        debugPrint('[DeveloperRepository] Demo mode: no API logs.');
        return const [];
      }
      rethrow;
    }
  }

  static List<ApiKeyItem> _demoKeys() => [
        ApiKeyItem(
          id: 'key_live_01',
          name: 'Production Primary',
          keyPrefix: 'px_live_sk_9a8f3b12',
          environment: 'live',
          createdAt: DateTime.now().subtract(const Duration(days: 30)),
          scopes: const ['invoices:all', 'payouts:all'],
        ),
        ApiKeyItem(
          id: 'key_test_01',
          name: 'Sandbox Test Key',
          keyPrefix: 'px_test_sk_4c1e88fa',
          environment: 'test',
          createdAt: DateTime.now().subtract(const Duration(days: 5)),
          scopes: const ['invoices:all'],
        ),
      ];
}
