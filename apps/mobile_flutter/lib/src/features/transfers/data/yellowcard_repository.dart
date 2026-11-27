import '../../../core/network/api_client.dart';
import '../../../core/network/api_config.dart';

class YellowCardRepository {
  YellowCardRepository({ProximApiClient? apiClient})
    : _apiClient = apiClient ?? ProximApiClient();

  final ProximApiClient _apiClient;

  Future<List<Map<String, dynamic>>> getChannels({
    String country = 'NG',
    String? rampType,
  }) async {
    final response = await _apiClient.get<Map<String, dynamic>>(
      '/api/yellowcard/channels',
      queryParameters: {'country': country, 'rampType': ?rampType},
    );
    final channels = response.data?['channels'];
    if (channels is! List) return const [];
    return channels
        .whereType<Map>()
        .map((channel) => Map<String, dynamic>.from(channel))
        .toList();
  }

  Future<List<Map<String, dynamic>>> getNetworks({
    required String channelId,
    String country = 'NG',
  }) async {
    final response = await _apiClient.get<Map<String, dynamic>>(
      '/api/yellowcard/networks',
      queryParameters: {'country': country, 'channelId': channelId},
    );
    final networks = response.data?['networks'];
    if (networks is! List) return const [];
    return networks
        .whereType<Map>()
        .map((network) => Map<String, dynamic>.from(network))
        .toList();
  }

  Future<Map<String, dynamic>> createCollection({
    required String entityId,
    required String channelId,
    required double localAmount,
    required Map<String, dynamic> recipient,
    required Map<String, dynamic> source,
  }) async {
    final response = await _apiClient.post<Map<String, dynamic>>(
      '/api/yellowcard/collections',
      data: {
        'entityId': entityId,
        'country': 'NG',
        'currency': 'NGN',
        'channelId': channelId,
        'localAmount': localAmount,
        'recipient': recipient,
        'source': source,
      },
    );
    return _paymentFrom(response.data, 'collection');
  }

  Future<void> acceptCollection(String paymentId) async {
    await _apiClient.post<Map<String, dynamic>>(
      '/api/yellowcard/collections/$paymentId/accept',
    );
  }

  Future<Map<String, dynamic>> createSend({
    required String entityId,
    required String channelId,
    required String networkId,
    required double localAmount,
    required Map<String, dynamic> sender,
    required Map<String, dynamic> destination,
  }) async {
    final response = await _apiClient.post<Map<String, dynamic>>(
      '/api/yellowcard/sends',
      data: {
        'entityId': entityId,
        'country': 'NG',
        'currency': 'NGN',
        'channelId': channelId,
        'networkId': networkId,
        'localAmount': localAmount,
        'source': {'accountType': 'bank'},
        'sender': sender,
        'destination': destination,
        'reason': 'other',
      },
    );
    return _paymentFrom(response.data, 'payout');
  }

  Future<void> acceptSend(String paymentId) async {
    await _apiClient.post<Map<String, dynamic>>(
      '/api/yellowcard/sends/$paymentId/accept',
    );
  }

  Map<String, dynamic> _paymentFrom(Map<String, dynamic>? data, String kind) {
    if (data == null || data['payment'] is! Map) {
      throw ProximException(
        'We could not prepare your Yellow Card $kind. Please try again.',
      );
    }
    return Map<String, dynamic>.from(data['payment'] as Map);
  }
}
