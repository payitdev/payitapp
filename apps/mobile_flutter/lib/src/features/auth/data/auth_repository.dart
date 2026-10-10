import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_config.dart';
import '../domain/auth_models.dart';

class AuthRepository {
  final ProximApiClient _apiClient;

  AuthRepository({ProximApiClient? apiClient}) : _apiClient = apiClient ?? ProximApiClient();

  ProximApiClient get apiClient => _apiClient;

  /// Restores existing session from stored JWT.
  Future<ProximUser?> restoreSession() async {
    final token = await _apiClient.tokenStorage.getToken();
    if (token == null || token.isEmpty) return null;

    try {
      final response = await _apiClient.get<Map<String, dynamic>>('/api/auth/session');
      final data = response.data;
      if (data != null && data['success'] == true && data['user'] != null) {
        return ProximUser.fromJson(data['user'] as Map<String, dynamic>);
      }
    } catch (e) {
      debugPrint('[AuthRepository] Session restore failed: $e');
      // Token exists but session is invalid — clear it
      await _apiClient.tokenStorage.clear();
    }
    return null;
  }

  /// Demo Login — connects to backend; falls back to offline data ONLY when
  /// DEMO_MODE=true is set at compile time.
  Future<ProximUser> loginDemo() async {
    try {
      final response = await _apiClient.post<Map<String, dynamic>>(
        '/api/auth/demo',
        data: const <String, dynamic>{},
      );
      final data = response.data;
      if (data != null && data['success'] == true && data['token'] != null) {
        final token = data['token'] as String;
        await _apiClient.tokenStorage.saveToken(token);

        var user = ProximUser.fromJson(data['user'] as Map<String, dynamic>);
        user = _ensureEntityAddresses(user);
        await _apiClient.tokenStorage.saveActiveEntityId(user.activeEntityId);
        return user;
      }
      throw const ProximException('Demo login failed. Please try again.');
    } catch (e) {
      // Only fall back to offline demo data if DEMO_MODE is explicitly enabled
      if (ApiConfig.isDemoMode) {
        debugPrint('[AuthRepository] DEMO_MODE: using offline fallback user.');
        final fallbackUser = _getDemoFallbackUser();
        await _apiClient.tokenStorage.saveActiveEntityId(fallbackUser.activeEntityId);
        return fallbackUser;
      }
      rethrow;
    }
  }

  ProximUser _ensureEntityAddresses(ProximUser user) {
    final updatedEntities = user.entities.map((entity) {
      final hasEvm = entity.evmDepositAddress != null && entity.evmDepositAddress!.isNotEmpty;
      final hasSolana = entity.solanaDepositAddress != null && entity.solanaDepositAddress!.isNotEmpty;
      final hasFiat = entity.fiatAccounts.isNotEmpty;

      if (hasEvm && hasSolana && hasFiat) return entity;

      return ProximEntity(
        id: entity.id,
        userId: entity.userId,
        kind: entity.kind,
        legalName: entity.legalName,
        businessTag: entity.businessTag,
        dueStatus: entity.dueStatus ?? 'approved',
        evmDepositAddress: hasEvm
            ? entity.evmDepositAddress
            : (entity.isBusiness
                ? '0x35D9B42c1A48F7d61c6bEb21a083EaB582E1'
                : '0x8F2149b5c2a16d84A3B2944f33bA61dEb20947B9'),
        solanaDepositAddress: hasSolana
            ? entity.solanaDepositAddress
            : (entity.isBusiness
                ? '7XqB8hN6eR3rYp9z2F3A1pL2w5K8sD9vK2'
                : '3NmP8L63Wvhqgqf4hKqM76v169T7x8rK5wT8Q17XyVz'),
        btcDepositAddress: entity.btcDepositAddress ?? 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
        nearDepositAddress: entity.nearDepositAddress ?? (entity.isBusiness ? 'acme-treasury.near' : 'alexmorgan.near'),
        fiatAccounts: hasFiat
            ? entity.fiatAccounts
            : [
                FiatAccount(
                  id: entity.isBusiness ? 'acc_biz_ngn_01' : 'acc_per_ngn_01',
                  accountNumber: entity.isBusiness ? '0124899012' : '9081234567',
                  bankName: entity.isBusiness ? 'Providus Bank' : 'SafeHaven Microfinance Bank',
                  currency: 'NGN',
                  rail: 'NUBAN_INSTANT',
                  accountHolderName: entity.legalName,
                  status: 'ACTIVE',
                ),
              ],
      );
    }).toList();

    return user.copyWith(entities: updatedEntities);
  }

  /// Telegram Mini App Auto-Authentication
  Future<ProximUser> loginTelegram(String initData) async {
    final response = await _apiClient.post<Map<String, dynamic>>(
      '/api/auth/telegram/mini-app',
      data: {'initData': initData},
    );
    final data = response.data;
    if (data != null && data['success'] == true && data['token'] != null) {
      final token = data['token'] as String;
      await _apiClient.tokenStorage.saveToken(token);

      final user = ProximUser.fromJson(data['user'] as Map<String, dynamic>);
      await _apiClient.tokenStorage.saveActiveEntityId(user.activeEntityId);
      return user;
    }
    throw const ProximException('Unable to authenticate Telegram session. Please try again.');
  }

  /// Privy login — verifies a Privy session and mints a Proxim JWT.
  ///
  /// Backend contract (POST /api/auth/privy/login):
  /// - Header `Authorization: Bearer <privy access token>` (verified server-side)
  /// - Body `{ privyUserId }` — must match the verified token's user.
  /// The backend creates the user + entities on first login (sign-up is
  /// implicit), and responds with `{ success, token, user }`.
  Future<ProximUser> loginPrivy({
    required String privyUserId,
    required String accessToken,
    String? walletAddress,
  }) async {
    final response = await _apiClient.post<Map<String, dynamic>>(
      '/api/auth/privy/login',
      data: {
        'privyUserId': privyUserId,
        'walletAddress': ?walletAddress,
      },
      options: Options(
        headers: {'Authorization': 'Bearer $accessToken'},
      ),
    );
    final data = response.data;
    if (data != null && data['success'] == true && data['token'] != null) {
      await _saveSession(data);
      return ProximUser.fromJson(data['user'] as Map<String, dynamic>);
    }
    throw const ProximException('Authentication failed. Please try again.');
  }

  Future<void> _saveSession(Map<String, dynamic> data) async {
    final token = data['token'] as String;
    await _apiClient.tokenStorage.saveToken(token);

    final user = ProximUser.fromJson(data['user'] as Map<String, dynamic>);
    await _apiClient.tokenStorage.saveActiveEntityId(user.activeEntityId);
  }

  /// Verify 6-digit passcode — real API call; no hardcoded bypass.
  Future<bool> verifyPasscode(String passcode) async {
    try {
      final response = await _apiClient.post<Map<String, dynamic>>(
        '/api/auth/passcode/verify',
        data: {'passcode': passcode},
      );
      return response.data?['verified'] == true;
    } catch (e) {
      if (ApiConfig.isDemoMode) {
        // In demo mode only, accept the standard demo PIN
        return passcode == '123456' || passcode == '000000';
      }
      rethrow;
    }
  }

  /// Switch the active entity on the backend and update local storage.
  Future<void> switchActiveEntity(String entityId) async {
    try {
      await _apiClient.post<Map<String, dynamic>>(
        '/api/entities/switch-context',
        data: {'targetEntityId': entityId},
      );
    } catch (e) {
      // Best-effort — local state still switches even if the call fails
      debugPrint('[AuthRepository] Entity switch call note: $e');
    }
    await _apiClient.tokenStorage.saveActiveEntityId(entityId);
  }

  /// Check current session validity (call on app resume for Telegram JWTs).
  Future<bool> checkSession() async {
    try {
      final response = await _apiClient.get<Map<String, dynamic>>('/api/auth/session');
      return response.data?['success'] == true;
    } catch (_) {
      return false;
    }
  }

  /// Sign out and clear stored session.
  Future<void> logout() async {
    await _apiClient.tokenStorage.clear();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Demo / Offline fallback — only used when DEMO_MODE=true
  // ─────────────────────────────────────────────────────────────────────────
  static ProximUser _getDemoFallbackUser() {
    return const ProximUser(
      id: 'usr_demo_proxim_01',
      email: 'alex.morgan@proxim.app',
      fullName: 'Alex Morgan',
      activeEntityId: 'ent_demo_business_01',
      hasPasscode: true,
      entities: [
        ProximEntity(
          id: 'ent_demo_business_01',
          userId: 'usr_demo_proxim_01',
          kind: 'BUSINESS',
          legalName: 'Acme Global Technologies Ltd',
          businessTag: 'ACMEBIZ',
          dueStatus: 'approved',
          evmDepositAddress: '0x35D9...82E1',
          solanaDepositAddress: '7XqB...9vK2',
          fiatAccounts: [
            FiatAccount(
              id: 'acc_biz_ngn_01',
              accountNumber: '0124899012',
              bankName: 'Providus Bank',
              currency: 'NGN',
              rail: 'NUBAN_INSTANT',
              accountHolderName: 'Acme Global Technologies Ltd',
              status: 'ACTIVE',
            ),
          ],
        ),
        ProximEntity(
          id: 'ent_demo_personal_01',
          userId: 'usr_demo_proxim_01',
          kind: 'PERSONAL',
          legalName: 'Alex Morgan',
          dueStatus: 'approved',
          evmDepositAddress: '0x8F21...47B9',
          solanaDepositAddress: '3NmP...5wT8',
          fiatAccounts: [
            FiatAccount(
              id: 'acc_per_ngn_01',
              accountNumber: '9081234567',
              bankName: 'SafeHaven Microfinance Bank',
              currency: 'NGN',
              rail: 'NUBAN_INSTANT',
              accountHolderName: 'Alex Morgan',
              status: 'ACTIVE',
            ),
          ],
        ),
      ],
    );
  }
}
