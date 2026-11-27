import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/presentation/auth_provider.dart';
import '../domain/transfers_models.dart';
import 'transfers_provider.dart';

/// Resilient balance provider: keeps showing the last successful balance
/// through refetch failures and reloads (flaky connections, cold backend),
/// instead of flashing an error or zero. The last good value is cached per
/// entity and shown immediately while a refresh runs in the background.
class ResilientBalanceNotifier extends Notifier<AsyncValue<TransfersBalance>> {
  static final Map<String, TransfersBalance> _cache = {};

  @override
  AsyncValue<TransfersBalance> build() {
    final entity = ref.watch(activeEntityProvider);
    if (entity == null) return const AsyncLoading();
    Future(() => refresh(entity.id));
    final cached = _cache[entity.id];
    return cached != null ? AsyncData(cached) : const AsyncLoading();
  }

  Future<void> refresh(String entityId) async {
    final repo = ref.read(transfersRepositoryProvider);
    try {
      final balance = await repo.getBalance(entityId: entityId);
      _cache[entityId] = balance;
      state = AsyncData(balance);
    } catch (e, st) {
      // Never drop a known-good balance on a failed refetch — keep showing
      // the last value (stale-while-revalidate). Only surface an error when
      // no value has ever loaded.
      if (!state.hasValue) state = AsyncError<TransfersBalance>(e, st);
    }
  }
}

final resilientBalanceProvider =
    NotifierProvider<ResilientBalanceNotifier, AsyncValue<TransfersBalance>>(
  ResilientBalanceNotifier.new,
);
