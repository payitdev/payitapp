import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:proxim_app/src/core/network/api_client.dart';
import 'package:proxim_app/src/core/network/api_config.dart';
import 'package:proxim_app/src/features/auth/data/auth_repository.dart';
import 'package:proxim_app/src/features/developer/data/developer_repository.dart';
import 'package:proxim_app/src/features/invoices/data/invoices_repository.dart';
import 'package:proxim_app/src/features/transfers/data/transfers_repository.dart';
import 'package:proxim_app/src/features/treasury/data/treasury_repository.dart';

/// API client that serves canned responses instead of hitting the network,
/// so these tests run hermetically in CI (no backend required).
class FakeApiClient extends ProximApiClient {
  FakeApiClient();

  @override
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    return Response<T>(
      data: _canned(path, null) as T?,
      requestOptions: RequestOptions(path: path),
    );
  }

  @override
  Future<Response<T>> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    return Response<T>(
      data: _canned(path, data) as T?,
      requestOptions: RequestOptions(path: path),
    );
  }

  Map<String, dynamic> _canned(String path, dynamic body) {
    switch (path) {
      case '/api/auth/demo':
        return {
          'success': true,
          'token': 'jwt_demo',
          'user': {
            'id': 'usr_demo',
            'email': 'alex.morgan@proxim.app',
            'fullName': 'Alex Morgan',
            'activeEntityId': 'ent_biz',
            'hasPasscode': true,
            'entities': [
              {
                'id': 'ent_biz',
                'userId': 'usr_demo',
                'kind': 'BUSINESS',
                'legalName': 'Acme Global Technologies Ltd',
                'businessTag': 'ACMEBIZ',
                'dueStatus': 'approved',
                'fiatAccounts': [
                  {
                    'id': 'acc_biz_ngn',
                    'accountNumber': '0124899012',
                    'bankName': 'Providus Bank',
                    'currency': 'NGN',
                    'rail': 'NUBAN_INSTANT',
                    'accountHolderName': 'Acme Global Technologies Ltd',
                    'status': 'ACTIVE',
                  },
                ],
              },
              {
                'id': 'ent_per',
                'userId': 'usr_demo',
                'kind': 'PERSONAL',
                'legalName': 'Alex Morgan',
                'dueStatus': 'approved',
                'fiatAccounts': const [],
              },
            ],
          },
        };
      case '/api/auth/passcode/verify':
        return {'verified': (body as Map?)?['passcode'] == '123456'};
      case '/api/transfers/fx-quote':
        return {
          'quote': {
            'fromCurrency': 'USD',
            'toCurrency': 'NGN',
            'fromAmount': 100.0,
            'toAmount': 159520.0,
            'rate': 1595.20,
            'validForSeconds': 15,
            'feeAmount': 0.0,
            'rail': 'Proxim Instant OTC Clearing',
          },
        };
      case '/api/transfers/execute':
        return {
          'transfer': {
            'id': 'tx_demo_1',
            'referenceNumber': 'PX-843021',
            'recipientName': (body as Map?)?['recipientName'] ?? 'Recipient',
            'amount': (body?['amount'] as num?)?.toDouble() ?? 0.0,
            'currency': (body?['currency'] as String?) ?? 'USD',
            'status': 'CLEARED',
            'timestamp': DateTime.now().toIso8601String(),
            'rail': (body?['rail'] as String?) ?? 'US_DOMESTIC_WIRE',
          },
        };
      case '/api/reports/balance-sheet':
        return {
          'report': {
            'netOperatingSurplus': 482950.00,
            'totalCurrentAssets': 562450.00,
            'cashEquivalents': 358550.00,
            'accountsReceivable': 203900.00,
            'totalCurrentLiabilities': 79500.00,
            'accountsPayable': 36850.00,
            'accruedPayroll': 42650.00,
            'runwayMonths': 14.1,
          },
        };
      case '/api/invoices':
        return {
          'invoice': {
            'id': 'inv_demo_1',
            'invoiceNumber': 'INV-2026-095',
            'clientName': (body as Map?)?['clientName'] ?? 'Client',
            'clientEmail': (body?['clientEmail'] as String?) ?? '',
            'amount': (body?['amount'] as num?)?.toDouble() ?? 0.0,
            'currency': (body?['currency'] as String?) ?? 'USD',
            'status': 'PENDING',
            'paymentUrl': 'https://pay.proxim.app/checkout/inv_demo_1',
            'createdAt': DateTime.now().toIso8601String(),
          },
        };
      case '/api/developer/keys':
        if (body is Map && body.containsKey('environment')) {
          // rollKey (POST with environment) returns a single key
          final isProd = body['environment'] == 'production';
          return {
            'key': {
              'id': 'key_rolled',
              'name': isProd ? 'Production Rolled Key' : 'Sandbox Rolled Key',
              'keyPrefix': isProd ? 'px_live_9f2e7a' : 'px_test_3d1b8c',
              'environment': body['environment'],
              'createdAt': DateTime.now().toIso8601String(),
            },
          };
        }
        return {
          'keys': [
            {
              'id': 'key_prod',
              'name': 'Production',
              'keyPrefix': 'px_live_9f2e7a',
              'environment': 'production',
              'createdAt': DateTime.now().toIso8601String(),
            },
            {
              'id': 'key_test',
              'name': 'Sandbox',
              'keyPrefix': 'px_test_3d1b8c',
              'environment': 'test',
              'createdAt': DateTime.now().toIso8601String(),
            },
          ],
        };
      default:
        throw ProximException('Unexpected path in FakeApiClient: $path');
    }
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('AuthRepository with canned API responses', () {
    final repo = AuthRepository(apiClient: FakeApiClient());

    test('loginDemo returns valid ProximUser with business and personal entities', () async {
      final user = await repo.loginDemo();
      expect(user.email, equals('alex.morgan@proxim.app'));
      expect(user.fullName, equals('Alex Morgan'));
      expect(user.entities.length, greaterThanOrEqualTo(2));
      expect(user.activeEntity, isNotNull);
      expect(user.activeEntity!.isBusiness, isTrue);
      expect(user.activeEntity!.legalName, equals('Acme Global Technologies Ltd'));
    });

    test('verifyPasscode validates 6-digit passcode', () async {
      expect(await repo.verifyPasscode('123456'), isTrue);
      expect(await repo.verifyPasscode('999999'), isFalse);
    });
  });

  group('TransfersRepository with canned API responses', () {
    final repo = TransfersRepository(apiClient: FakeApiClient());

    test('getFxQuote parses rates and fees', () async {
      final quote = await repo.getFxQuote(
        fromCurrency: 'USD',
        toCurrency: 'NGN',
        fromAmount: 100.0,
      );
      expect(quote.fromCurrency, equals('USD'));
      expect(quote.toCurrency, equals('NGN'));
      expect(quote.rate, greaterThan(0));
      expect(quote.toAmount, greaterThan(0));
      expect(quote.rail, equals('Proxim Instant OTC Clearing'));
    });

    test('sendTransfer returns cleared receipt', () async {
      final receipt = await repo.sendTransfer(
        recipientName: 'David Miller',
        amount: 500.0,
        currency: 'USD',
        rail: 'US_DOMESTIC_WIRE',
        note: 'Q3 Vendor Settlement',
      );
      expect(receipt.status, equals('CLEARED'));
      expect(receipt.amount, equals(500.0));
      expect(receipt.recipientName, equals('David Miller'));
      expect(receipt.referenceNumber, isNotEmpty);
    });
  });

  group('TreasuryRepository with canned API responses', () {
    final repo = TreasuryRepository(apiClient: FakeApiClient());

    test('getBalanceSheet returns positive operating surplus and runway', () async {
      final data = await repo.getBalanceSheet(entityId: 'ent-1');
      expect(data.netOperatingSurplus, greaterThan(0));
      expect(data.totalCurrentAssets, greaterThan(0));
      expect(data.runwayMonths, greaterThan(0));
    });
  });

  group('InvoicesRepository & DeveloperRepository with canned API responses', () {
    test('createInvoice builds pending invoice with reference', () async {
      final repo = InvoicesRepository(apiClient: FakeApiClient());
      final invoice = await repo.createInvoice(
        clientName: 'Globex Corp',
        clientEmail: 'billing@globex.io',
        amount: 12500.0,
        currency: 'USD',
        acceptedRails: ['USDC_BASE', 'BANK_TRANSFER'],
      );
      expect(invoice.clientName, equals('Globex Corp'));
      expect(invoice.amount, equals(12500.0));
      expect(invoice.invoiceNumber, startsWith('INV-2026-'));
      expect(invoice.status, equals('PENDING'));
    });

    test('developerRepository returns production and test keys and rolls key', () async {
      final repo = DeveloperRepository(apiClient: FakeApiClient());
      final keys = await repo.getKeys('ent-1');
      expect(keys.length, equals(2));
      expect(keys.any((k) => k.environment == 'production'), isTrue);

      final rolled = await repo.rollKey('ent-1', 'production');
      expect(rolled, isNotNull);
      expect(rolled.keyPrefix, startsWith('px_live_'));
    });
  });
}
