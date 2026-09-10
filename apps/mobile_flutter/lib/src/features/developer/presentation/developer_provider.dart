import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../auth/presentation/auth_provider.dart';
import '../data/developer_repository.dart';

final developerRepositoryProvider = Provider<DeveloperRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return DeveloperRepository(apiClient: apiClient);
});

final apiKeysProvider = FutureProvider.autoDispose.family<List<ApiKeyItem>, String>((ref, entityId) async {
  final repo = ref.watch(developerRepositoryProvider);
  return repo.getKeys(entityId);
});
