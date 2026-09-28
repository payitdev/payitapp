import 'package:flutter/foundation.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_config.dart';

/// KYC status for an entity, from GET /api/kyc/status.
/// [status] mirrors the entity's `dueStatus`: 'approved' | 'pending' |
/// 'rejected' | 'under_review' | null (not started).
class KycStatus {
  final String? status;
  final int tier;

  const KycStatus({this.status, this.tier = 0});

  bool get isApproved => status == 'approved';

  bool get isPending =>
      status == 'pending' || status == 'under_review' || status == 'identity_verified' || status == 'aml_cleared';

  factory KycStatus.fromJson(Map<String, dynamic> json) {
    return KycStatus(
      status: json['kycStatus'] as String? ?? json['dueStatus'] as String?,
      tier: (json['kycTier'] as num?)?.toInt() ?? (json['dueTier'] as num?)?.toInt() ?? 0,
    );
  }

  /// Demo fallback — entity simply hasn't started verification.
  static const KycStatus demo = KycStatus(status: null, tier: 0);
}

class KycRepository {
  final ProximApiClient _apiClient;

  KycRepository({ProximApiClient? apiClient}) : _apiClient = apiClient ?? ProximApiClient();

  Future<KycStatus> getStatus({required String entityId, required String userId}) async {
    try {
      final response = await _apiClient.get<Map<String, dynamic>>(
        '/api/kyc/status',
        queryParameters: {'entityId': entityId, 'userId': userId},
      );

      final data = response.data;
      if (data == null) {
        throw const ProximException('Unable to load verification status. Please try again.');
      }
      return KycStatus.fromJson(data);
    } catch (e) {
      if (ApiConfig.isDemoMode) {
        debugPrint('[KycRepository] Demo mode: using demo KYC status.');
        return KycStatus.demo;
      }
      rethrow;
    }
  }
}
