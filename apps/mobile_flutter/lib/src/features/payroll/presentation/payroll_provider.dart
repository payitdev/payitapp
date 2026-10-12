import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../auth/presentation/auth_provider.dart';
import '../data/payroll_repository.dart';

final payrollRepositoryProvider = Provider<PayrollRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return PayrollRepository(apiClient: apiClient);
});

final payrollRunsProvider = FutureProvider.family<List<PayrollRunRecord>, String>((ref, entityId) async {
  if (entityId.isEmpty) return [];
  final repo = ref.watch(payrollRepositoryProvider);
  return repo.getPayrollRuns(entityId: entityId);
});
