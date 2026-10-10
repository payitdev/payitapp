import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../auth/presentation/auth_provider.dart';
import '../data/invoices_repository.dart';
import '../data/payment_requests_repository.dart';

final invoicesRepositoryProvider = Provider<InvoicesRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return InvoicesRepository(apiClient: apiClient);
});

final invoicesListProvider = FutureProvider.family<List<ProximInvoice>, String>((ref, entityId) async {
  if (entityId.isEmpty) return [];
  final repo = ref.watch(invoicesRepositoryProvider);
  return repo.getInvoices(entityId: entityId);
});

final publicInvoiceProvider = FutureProvider.family<ProximInvoice, String>((ref, invoiceId) async {
  final repo = ref.watch(invoicesRepositoryProvider);
  return repo.getPublicInvoice(invoiceId);
});

final paymentRequestsRepositoryProvider = Provider<PaymentRequestsRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return PaymentRequestsRepository(apiClient: apiClient);
});

final paymentRequestsProvider = FutureProvider.family<PaymentRequestsData, String>((ref, entityId) async {
  if (entityId.isEmpty) {
    return const PaymentRequestsData(trustedInbound: [], strangerInbound: [], outbound: []);
  }
  final repo = ref.watch(paymentRequestsRepositoryProvider);
  return repo.getPaymentRequests(entityId: entityId);
});
