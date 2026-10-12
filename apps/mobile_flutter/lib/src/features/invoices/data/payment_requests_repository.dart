import '../../../core/network/api_client.dart';
import '../../../core/network/api_config.dart';

class PaymentRequestItem {
  final String id;
  final double amount;
  final String currency;
  final String narration;
  final String status;
  final DateTime createdAt;
  final String requesterName;
  final String requesterUsername;
  final String requesterEntityId;
  final bool isMutualContact;

  const PaymentRequestItem({
    required this.id,
    required this.amount,
    required this.currency,
    required this.narration,
    required this.status,
    required this.createdAt,
    required this.requesterName,
    required this.requesterUsername,
    required this.requesterEntityId,
    required this.isMutualContact,
  });

  factory PaymentRequestItem.fromJson(Map<String, dynamic> json) {
    final requester = json['requester'] is Map<String, dynamic> ? json['requester'] as Map<String, dynamic> : null;
    final amt = json['amount'];
    return PaymentRequestItem(
      id: json['id'] as String? ?? '',
      amount: amt is num ? amt.toDouble() : (double.tryParse(amt?.toString() ?? '0') ?? 0.0),
      currency: json['currency'] as String? ?? 'USD',
      narration: json['narration'] as String? ?? 'Payment Request',
      status: (json['status'] as String? ?? 'PENDING').toUpperCase(),
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String) ?? DateTime.now()
          : DateTime.now(),
      requesterName: requester?['legalName'] as String? ?? json['requesterUsername'] as String? ?? 'Proxim User',
      requesterUsername: requester?['username'] as String? ?? json['requesterUsername'] as String? ?? 'user',
      requesterEntityId: requester?['entityId'] as String? ?? json['requesterEntityId'] as String? ?? '',
      isMutualContact: json['isMutualContact'] as bool? ?? false,
    );
  }
}

class PaymentRequestsData {
  final List<PaymentRequestItem> trustedInbound;
  final List<PaymentRequestItem> strangerInbound;
  final List<PaymentRequestItem> outbound;

  const PaymentRequestsData({
    required this.trustedInbound,
    required this.strangerInbound,
    required this.outbound,
  });

  List<PaymentRequestItem> get allInbound => [...trustedInbound, ...strangerInbound];
}

class PaymentRequestsRepository {
  final ProximApiClient _apiClient;

  PaymentRequestsRepository({ProximApiClient? apiClient})
      : _apiClient = apiClient ?? ProximApiClient();

  /// Fetch inbound and outbound payment requests
  Future<PaymentRequestsData> getPaymentRequests({required String entityId}) async {
    try {
      final response = await _apiClient.get<Map<String, dynamic>>(
        '/api/payments/requests',
        queryParameters: {'entityId': entityId},
      );
      final data = response.data;
      if (data != null) {
        final inbound = data['inbound'] as Map<String, dynamic>?;
        final trustedList = inbound?['trusted'] as List? ?? [];
        final strangersList = inbound?['strangers'] as List? ?? [];
        final outboundList = data['outbound'] as List? ?? [];

        return PaymentRequestsData(
          trustedInbound: trustedList
              .map((r) => PaymentRequestItem.fromJson(r as Map<String, dynamic>))
              .toList(),
          strangerInbound: strangersList
              .map((r) => PaymentRequestItem.fromJson(r as Map<String, dynamic>))
              .toList(),
          outbound: outboundList
              .map((r) => PaymentRequestItem.fromJson(r as Map<String, dynamic>))
              .toList(),
        );
      }
      return const PaymentRequestsData(trustedInbound: [], strangerInbound: [], outbound: []);
    } catch (e) {
      if (ApiConfig.isDemoMode) {
        return PaymentRequestsData(
          trustedInbound: [
            PaymentRequestItem(
              id: 'pr_demo_1',
              amount: 250.0,
              currency: 'USD',
              narration: 'Team Lunch Split',
              status: 'PENDING',
              createdAt: DateTime.now().subtract(const Duration(hours: 2)),
              requesterName: 'Sarah Jenkins',
              requesterUsername: 'sarahj',
              requesterEntityId: 'ent_sarah',
              isMutualContact: true,
            ),
          ],
          strangerInbound: [],
          outbound: [
            PaymentRequestItem(
              id: 'pr_demo_2',
              amount: 1200.0,
              currency: 'USD',
              narration: 'Consulting Retainer',
              status: 'PENDING',
              createdAt: DateTime.now().subtract(const Duration(days: 1)),
              requesterName: 'Self',
              requesterUsername: 'me',
              requesterEntityId: entityId,
              isMutualContact: true,
            ),
          ],
        );
      }
      rethrow;
    }
  }

  /// Create a payment request
  Future<void> createRequest({
    required String entityId,
    required String payerUsernameOrId,
    required double amount,
    String currency = 'USD',
    String? narration,
  }) async {
    await _apiClient.post<Map<String, dynamic>>(
      '/api/payments/request',
      data: {
        'entityId': entityId,
        'payerUsernameOrId': payerUsernameOrId,
        'amount': amount,
        'currency': currency,
        'narration': narration,
      },
    );
  }

  /// Fulfill / Pay a payment request
  Future<void> fulfillRequest({
    required String entityId,
    required String requestId,
  }) async {
    await _apiClient.post<Map<String, dynamic>>(
      '/api/payments/fulfill',
      data: {
        'entityId': entityId,
        'requestId': requestId,
      },
    );
  }

  /// Decline a payment request
  Future<void> declineRequest({
    required String entityId,
    required String requestId,
  }) async {
    await _apiClient.post<Map<String, dynamic>>(
      '/api/payments/decline',
      data: {
        'entityId': entityId,
        'requestId': requestId,
      },
    );
  }
}
