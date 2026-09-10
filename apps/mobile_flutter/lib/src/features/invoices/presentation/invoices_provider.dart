import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../auth/presentation/auth_provider.dart';
import '../data/invoices_repository.dart';

final invoicesRepositoryProvider = Provider<InvoicesRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return InvoicesRepository(apiClient: apiClient);
});
