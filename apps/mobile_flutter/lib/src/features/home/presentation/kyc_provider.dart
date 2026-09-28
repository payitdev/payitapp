import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../auth/presentation/auth_provider.dart';
import '../data/kyc_repository.dart';

final kycRepositoryProvider = Provider<KycRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return KycRepository(apiClient: apiClient);
});

/// KYC status for the active entity. Null when no entity is active yet.
final kycStatusProvider = FutureProvider.autoDispose<KycStatus?>((ref) async {
  final entity = ref.watch(activeEntityProvider);
  final user = ref.watch(currentUserProvider);
  if (entity == null || user == null) return null;

  final repo = ref.watch(kycRepositoryProvider);
  return repo.getStatus(entityId: entity.id, userId: user.id);
});
