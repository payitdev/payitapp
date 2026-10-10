import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:proxim_app/src/core/network/api_client.dart';
import 'package:proxim_app/src/core/network/api_config.dart';
import 'package:proxim_app/src/features/auth/data/auth_repository.dart';
import 'package:proxim_app/src/features/developer/data/developer_repository.dart';
import 'package:proxim_app/src/features/invoices/data/invoices_repository.dart';
import 'package:proxim_app/src/features/invoices/data/payment_requests_repository.dart';
import 'package:proxim_app/src/features/payroll/data/payroll_repository.dart';
import 'package:proxim_app/src/features/transfers/data/transfers_repository.dart';
import 'package:proxim_app/src/features/transfers/domain/transfers_models.dart';
import 'package:proxim_app/src/features/treasury/data/treasury_repository.dart';
import 'package:proxim_app/src/features/treasury/domain/treasury_models.dart';
import 'package:proxim_app/src/features/vault/data/vault_repository.dart';

/// API client that serves canned responses instead of hitting the network,
/// so these tests run hermetically in CI (no backend required).
class FakeApiClient extends ProximApiClient {
  FakeApiClient();

  /// Query parameters of the most recent GET — lets tests assert the
  /// client asked for the right depth (e.g. history limit).
  Map<String, dynamic>? lastQueryParameters;

  @override
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    lastQueryParameters = queryParameters;
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
    if (path.startsWith('/api/invoices/public/')) {
      final id = path.split('/').last;
      return {
        'success': true,
        'invoice': {
          'id': id,
          'tag': 'INV-2026-095',
          'totalAmount': 12500.0,
          'currency': 'USDC',
          'clientName': 'Acme Corp Inc',
          'clientEmail': 'billing@acmecorp.com',
          'merchantName': 'Proxim Business Treasury',
          'merchantEvmAddress': '0x71CB29F',
          'status': 'PENDING',
          'paymentUrl': 'https://pay.proxim.finance/checkout/$id',
        },
      };
    }
    if (path.startsWith('/api/approvals/') && path.endsWith('/sign')) {
      final action = (body as Map?)?['action'];
      return {
        'success': true,
        'approval': {
          'id': 'ap_pending_1',
          'title': 'AWS Cloud & Nodes',
          'amount': 24500.0,
          'currency': 'USDC',
          'description': 'Q3 infrastructure deployment',
          'status': action == 'reject' ? 'REJECTED' : 'APPROVED',
          'requiredSignatures': 2,
          'signedCount': action == 'reject' ? 1 : 2,
          'createdAt': '2026-10-05T10:14:00.000Z',
          'updatedAt': '2026-10-06T09:00:00.000Z',
          'signers': [
            {
              'id': 'sig_1',
              'label': 'CEO Key',
              'keyNote': 'Key #1',
              'status': 'SIGNED',
              'signedAt': '2026-10-05T10:14:00.000Z',
            },
            {
              'id': 'sig_2',
              'label': 'CFO Key',
              'keyNote': 'Key #2',
              'status': action == 'reject' ? 'REJECTED' : 'SIGNED',
              'signedAt': '2026-10-06T09:00:00.000Z',
            },
          ],
        },
      };
    }
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
        // Live nested statement shape from GET /api/reports/balance-sheet.
        return {
          'success': true,
          'report': {
            'reportRef': 'BS-ACME-XYZ',
            'generatedAt': '2026-10-06T08:00:00.000Z',
            'period': {
              'key': 'this_month',
              'label': 'This Month',
              'startDate': '2026-10-01',
              'endDate': '2026-10-06',
            },
            'business': {
              'legalName': 'Acme Global Technologies Ltd',
              'businessTag': 'ACME',
              'currency': 'USD',
            },
            'revenueAndReceivables': {
              'totalBilled': 200000.0,
              'totalCollected': 182450.0,
              'totalOutstanding': 17550.0,
              'totalOverdue': 0.0,
              'invoicesCount': {'billed': 8, 'paid': 7, 'pending': 1, 'overdue': 0},
            },
            'payrollAndPersonnel': {
              'totalDisbursed': 110000.0,
              'totalPending': 42650.0,
              'totalRuns': 2,
            },
            'operatingExpenses': {
              'vendorPayouts': 36200.0,
              'platformFees': 2050.0,
              'totalOpex': 148250.0,
            },
            'taxProvision': {
              'vatEstimate': 13683.75,
              'whtEstimate': 9122.5,
              'totalTaxEstimate': 22806.25,
            },
            'performance': {
              'grossRevenue': 182450.0,
              'totalExpenses': 148250.0,
              'netOperatingIncome': 11393.75,
              'profitMarginPercent': 6.2,
            },
            'balanceSheet': {
              'assets': {
                'currentAssets': {
                  'liquidCash': 284500.0,
                  'accountsReceivable': 17550.0,
                  'total': 302050.0,
                },
                'nonCurrentAssets': {
                  'vaultHoldings': 74050.0,
                  'tokenizedAssets': 0.0,
                  'total': 74050.0,
                },
                'totalAssets': 376100.0,
              },
              'liabilities': {
                'currentLiabilities': {
                  'pendingPayroll': 42650.0,
                  'taxPayable': 22806.25,
                  'total': 65456.25,
                },
                'totalLiabilities': 65456.25,
              },
              'equity': {
                'retainedEarnings': 11393.75,
                'totalOwnerEquity': 310643.75,
              },
              'equationBalanced': true,
            },
          },
        };
      case '/api/approvals/pending':
        return {
          'success': true,
          'entityId': 'ent-1',
          'approvals': [_pendingApprovalJson()],
        };
      case '/api/approvals':
        if (body is Map) {
          // POST /api/approvals — createApproval echoes the request.
          final signers = (body['signers'] as List? ?? []);
          return {
            'success': true,
            'approval': {
              'id': 'ap_created',
              'title': body['title'],
              'amount': (body['amount'] as num?)?.toDouble() ?? 0.0,
              'currency': body['currency'],
              'description': body['description'],
              'status': 'PENDING',
              'requiredSignatures': body['requiredSignatures'],
              'signedCount': 0,
              'createdAt': '2026-10-06T08:00:00.000Z',
              'updatedAt': '2026-10-06T08:00:00.000Z',
              'signers': [
                for (final signer in signers)
                  {
                    'id': 'sig_${(signer as Map)['label']}',
                    'label': signer['label'],
                    'keyNote': signer['keyNote'],
                    'status': 'PENDING',
                    'signedAt': null,
                  },
              ],
            },
          };
        }
        // GET /api/approvals — every status.
        return {
          'success': true,
          'entityId': 'ent-1',
          'approvals': [
            _pendingApprovalJson(),
            {
              'id': 'ap_done_1',
              'title': 'Q3 Payroll Disbursement',
              'amount': 38200.0,
              'currency': 'USDC',
              'description': 'September payroll cycle',
              'status': 'APPROVED',
              'requiredSignatures': 2,
              'signedCount': 2,
              'createdAt': '2026-09-15T08:45:00.000Z',
              'updatedAt': '2026-09-15T09:30:00.000Z',
              'signers': [
                {
                  'id': 'sig_3',
                  'label': 'CEO Key',
                  'keyNote': 'Key #1',
                  'status': 'SIGNED',
                  'signedAt': '2026-09-15T08:45:00.000Z',
                },
                {
                  'id': 'sig_4',
                  'label': 'CFO Key',
                  'keyNote': 'Key #2',
                  'status': 'SIGNED',
                  'signedAt': '2026-09-15T09:30:00.000Z',
                },
              ],
            },
          ],
        };
      case '/api/transfers/history':
        return {
          'success': true,
          'transactions': [
            {
              'id': 'tx_iso',
              'type': 'INBOUND',
              'title': 'Received from Stripe',
              'subtitle': 'Payment received · Completed',
              'amount': 5000.0,
              'symbol': '\$',
              'currency': 'USD',
              // Intentionally unparseable localized string — createdAt must win.
              'date': 'not a real date',
              'time': '02:24 PM',
              'mode': 'fiat',
              'senderAccount': 'External Sender',
              'recipientAccount': 'Proxim Balance',
              'reference': 'tx_iso',
              'createdAt': '2026-10-01T14:24:00.000Z',
            },
            {
              'id': 'tx_legacy',
              'type': 'OUTBOUND',
              'title': 'Sent to Vendor',
              'subtitle': 'Payment sent · Completed',
              'amount': 1200.0,
              'symbol': '\$',
              'currency': 'USD',
              'date': '10/2/2026',
              'time': '11:02 AM',
              'mode': 'fiat',
              'senderAccount': 'Proxim Balance',
              'recipientAccount': 'External Account',
              'reference': 'tx_legacy',
            },
          ],
        };
      case '/api/savings/summary':
        return {
          'success': true,
          'currency': 'USD',
          'savingsPool': 1250.75,
          'roundUpEnabled': true,
          'activeAdapters': ['kamino', 'near_intent_1click_earn'],
          'goals': <dynamic>[],
        };
      case '/api/kamino/yield-options':
        return {
          'success': true,
          'options': [
            {
              'id': 'kamino-usdc-solana',
              'provider': 'kamino',
              'name': 'Kamino Solana High-Yield Earn Vault',
              'chain': 'Solana',
              'asset': 'USDC',
              'grossApy': 8.5,
              'userNetApy': 6.5,
              'apyByDuration': {'30': 0.065, '60': 0.065, '90': 0.065, '365': 0.07},
              'verified': true,
            },
            {
              'id': 'near-earn-usdc',
              'provider': 'near_intent',
              'name': 'NEAR Intent Earn USDC',
              'chain': 'multi-chain',
              'asset': 'USDC',
              'grossApy': 9.1,
              'userNetApy': 8.8,
              'apyByDuration': {'30': 0.088, '60': 0.088, '90': 0.088, '365': 0.088},
              'verified': true,
            },
          ],
          'recommended': 'near-earn-usdc',
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
      case '/api/payments/requests':
        return {
          'success': true,
          'inbound': {
            'trusted': [
              {
                'id': 'pr_1',
                'amount': 350.0,
                'currency': 'USD',
                'narration': 'Cloud hosting share',
                'status': 'PENDING',
                'createdAt': '2026-10-06T10:00:00.000Z',
                'requester': {'legalName': 'Alice Guo', 'username': 'alice'},
                'isMutualContact': true,
              },
            ],
            'strangers': <dynamic>[],
          },
          'outbound': [
            {
              'id': 'pr_2',
              'amount': 1200.0,
              'currency': 'USD',
              'narration': 'Design Retainer',
              'status': 'PENDING',
              'createdAt': '2026-10-05T08:00:00.000Z',
              'requester': {'legalName': 'Self', 'username': 'me'},
              'isMutualContact': true,
            },
          ],
        };
      case '/api/payments/request':
      case '/api/payments/fulfill':
      case '/api/payments/decline':
        return {'success': true};
      case '/api/payroll':
        return {
          'success': true,
          'runs': [
            {
              'id': 'run_1',
              'title': 'Sprint 24 Payroll',
              'totalAmount': 135000.0,
              'currency': 'NGN',
              'status': 'COMPLETED',
              'employeeCount': 2,
              'createdAt': '2026-10-04T12:00:00.000Z',
              'items': [
                {'recipientName': 'Chidi', 'recipientAccountOrPhone': '123', 'amount': 70000.0},
                {'recipientName': 'Amaka', 'recipientAccountOrPhone': '456', 'amount': 65000.0},
              ],
            },
          ],
        };
      case '/api/payroll/run':
        return {
          'success': true,
          'payrollRun': {
            'id': 'run_new',
            'title': 'New Payroll',
            'totalAmount': 100000.0,
            'currency': 'NGN',
            'status': 'COMPLETED',
            'employeeCount': 1,
            'createdAt': '2026-10-06T12:00:00.000Z',
            'items': [
              {'recipientName': 'Chidi', 'recipientAccountOrPhone': '123', 'amount': 100000.0},
            ],
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

/// One PENDING approval with signer detail, as returned by
/// GET /api/approvals/pending and GET /api/approvals.
Map<String, dynamic> _pendingApprovalJson() => {
      'id': 'ap_pending_1',
      'title': 'AWS Cloud & Nodes',
      'amount': 24500.0,
      'currency': 'USDC',
      'description': 'Q3 infrastructure deployment',
      'status': 'PENDING',
      'requiredSignatures': 2,
      'signedCount': 1,
      'createdAt': '2026-10-05T10:14:00.000Z',
      'updatedAt': '2026-10-05T10:14:00.000Z',
      'signers': [
        {
          'id': 'sig_1',
          'label': 'CEO Key',
          'keyNote': 'Key #1',
          'status': 'SIGNED',
          'signedAt': '2026-10-05T10:14:00.000Z',
        },
        {
          'id': 'sig_2',
          'label': 'CFO Key',
          'keyNote': 'Key #2',
          'status': 'PENDING',
          'signedAt': null,
        },
      ],
    };

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
    test('getBalanceSheet parses the live nested statement shape', () async {
      final repo = TreasuryRepository(apiClient: FakeApiClient());
      final data = await repo.getBalanceSheet(entityId: 'ent-1');
      expect(data.netOperatingSurplus, equals(11393.75));
      expect(data.totalInflows, equals(182450.0));
      expect(data.totalOutflows, equals(148250.0));
      expect(data.profitMarginPercent, equals(6.2));
      expect(data.totalCurrentAssets, equals(302050.0));
      expect(data.cashEquivalents, equals(284500.0));
      expect(data.accountsReceivable, equals(17550.0));
      expect(data.vaultHoldings, equals(74050.0));
      expect(data.totalCurrentLiabilities, equals(65456.25));
      expect(data.accruedPayroll, equals(42650.0));
      expect(data.taxPayable, equals(22806.25));
      expect(data.totalOwnerEquity, equals(310643.75));
      expect(data.totalBilled, equals(200000.0));
      expect(data.totalOutstanding, equals(17550.0));
      expect(data.periodLabel, equals('This Month'));
      expect(data.businessName, equals('Acme Global Technologies Ltd'));
    });

    test('getHistory requests a deep limit and parses ISO createdAt', () async {
      final fakeClient = FakeApiClient();
      final repo = TreasuryRepository(apiClient: fakeClient);
      final history = await repo.getHistory(entityId: 'ent-1');
      expect(fakeClient.lastQueryParameters?['limit'], equals(200));
      expect(history.length, equals(2));

      // ISO createdAt is authoritative even when the localized date
      // string is unparseable.
      expect(history[0].parsedDate, DateTime.parse('2026-10-01T14:24:00.000Z'));

      // Older payloads without createdAt still fall back to the
      // en-US localized date string.
      expect(history[1].parsedDate, isNotNull);
      expect(history[1].parsedDate!.month, equals(10));
      expect(history[1].parsedDate!.day, equals(2));
    });

    test('getApprovals parses status, signers and signedAt', () async {
      final fakeClient = FakeApiClient();
      final repo = TreasuryRepository(apiClient: fakeClient);
      // The fake serves every status; the status filter is asserted on
      // the outgoing query instead.
      final approvals = await repo.getApprovals(entityId: 'ent-1', status: 'PENDING');
      expect(fakeClient.lastQueryParameters?['status'], equals('PENDING'));
      expect(approvals.length, equals(2));

      final approval = approvals.first;
      expect(approval.status, equals('PENDING'));
      expect(approval.signedCount, equals(1));
      expect(approval.requiredSignatures, equals(2));
      expect(approval.createdAt, DateTime.parse('2026-10-05T10:14:00.000Z'));
      expect(approval.signers.length, equals(2));
      expect(approval.signers.first.label, equals('CEO Key'));
      expect(approval.signers.first.keyNote, equals('Key #1'));
      expect(approval.signers.first.isSigned, isTrue);
      expect(approval.signers.first.signedAt, isNotNull);
      expect(approval.signers[1].label, equals('CFO Key'));
      expect(approval.signers[1].isPending, isTrue);

      final settled = approvals[1];
      expect(settled.status, equals('APPROVED'));
      expect(settled.signers.every((s) => s.isSigned), isTrue);
    });

    test('getPendingApprovals returns the pending queue', () async {
      final repo = TreasuryRepository(apiClient: FakeApiClient());
      final approvals = await repo.getPendingApprovals(entityId: 'ent-1');
      expect(approvals.length, equals(1));
      expect(approvals.first.isPending, isTrue);
    });

    test('createApproval posts signer slots and returns the created approval', () async {
      final repo = TreasuryRepository(apiClient: FakeApiClient());
      final created = await repo.createApproval(
        entityId: 'ent-1',
        title: 'Q3 Payroll Disbursement',
        amount: 38200.0,
        description: 'September payroll cycle',
        signers: [
          (label: 'CEO Key', keyNote: 'Key #1'),
          (label: 'CFO Key', keyNote: null),
        ],
      );
      expect(created.id, equals('ap_created'));
      expect(created.title, equals('Q3 Payroll Disbursement'));
      expect(created.amount, equals(38200.0));
      expect(created.status, equals('PENDING'));
      expect(created.signers.length, equals(2));
      expect(created.signers.first.keyNote, equals('Key #1'));
      expect(created.signers[1].keyNote, isNull);
    });

    test('signApproval flips the approval to APPROVED at threshold', () async {
      final repo = TreasuryRepository(apiClient: FakeApiClient());
      final updated = await repo.signApproval('ap_pending_1', 'sig_2');
      expect(updated.status, equals('APPROVED'));
      expect(updated.signedCount, equals(2));
      expect(updated.signers[1].isSigned, isTrue);
    });

    test('signApproval with reject flips the approval to REJECTED', () async {
      final repo = TreasuryRepository(apiClient: FakeApiClient());
      final updated = await repo.signApproval('ap_pending_1', 'sig_2', reject: true);
      expect(updated.status, equals('REJECTED'));
      expect(updated.signers[1].isRejected, isTrue);
    });
  });

  group('VaultRepository with canned API responses', () {
    test('getSummary reads the live savingsPool figure', () async {
      final repo = VaultRepository(apiClient: FakeApiClient());
      final summary = await repo.getSummary();
      expect(summary.totalBalance, equals(1250.75));
      expect(summary.strategies, isEmpty);
    });

    test('getYieldOptions parses live APY routes with per-duration rates', () async {
      final repo = VaultRepository(apiClient: FakeApiClient());
      final options = await repo.getYieldOptions();
      expect(options.length, equals(2));

      final best = options.reduce((a, b) => a.userNetApy >= b.userNetApy ? a : b);
      expect(best.id, equals('near-earn-usdc'));
      expect(best.userNetApy, equals(8.8));
      expect(best.apyByDuration[365], equals(0.088));

      final kamino = options.firstWhere((o) => o.provider == 'kamino');
      expect(kamino.grossApy, equals(8.5));
      expect(kamino.apyByDuration[30], equals(0.065));
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
      final rolled = await repo.rollKey('ent-1', 'production');
      expect(rolled, isNotNull);
      expect(rolled.keyPrefix, startsWith('px_live_'));
    });

    test('getPublicInvoice parses merchant and total amount', () async {
      final repo = InvoicesRepository(apiClient: FakeApiClient());
      final invoice = await repo.getPublicInvoice('inv-test-1');
      expect(invoice.id, equals('inv-test-1'));
      expect(invoice.amount, equals(12500.0));
      expect(invoice.merchantName, equals('Proxim Business Treasury'));
      expect(invoice.status, equals('PENDING'));
    });
  });

  group('PaymentRequestsRepository with canned API responses', () {
    test('getPaymentRequests parses inbound and outbound requests', () async {
      final repo = PaymentRequestsRepository(apiClient: FakeApiClient());
      final data = await repo.getPaymentRequests(entityId: 'ent-1');
      expect(data.trustedInbound.length, equals(1));
      expect(data.trustedInbound.first.requesterName, equals('Alice Guo'));
      expect(data.trustedInbound.first.amount, equals(350.0));
      expect(data.trustedInbound.first.isMutualContact, isTrue);

      expect(data.outbound.length, equals(1));
      expect(data.outbound.first.amount, equals(1200.0));
    });

    test('fulfillRequest and declineRequest complete successfully', () async {
      final repo = PaymentRequestsRepository(apiClient: FakeApiClient());
      await expectLater(
        repo.fulfillRequest(entityId: 'ent-1', requestId: 'pr_1'),
        completes,
      );
      await expectLater(
        repo.declineRequest(entityId: 'ent-1', requestId: 'pr_1'),
        completes,
      );
    });
  });

  group('PayrollRepository with canned API responses', () {
    test('getPayrollRuns parses runs and item recipients', () async {
      final repo = PayrollRepository(apiClient: FakeApiClient());
      final runs = await repo.getPayrollRuns(entityId: 'ent-1');
      expect(runs.length, equals(1));
      expect(runs.first.title, equals('Sprint 24 Payroll'));
      expect(runs.first.totalAmount, equals(135000.0));
      expect(runs.first.recipients.length, equals(2));
      expect(runs.first.recipients.first.name, equals('Chidi'));
    });

    test('executePayroll dispatches batch and returns run record', () async {
      final repo = PayrollRepository(apiClient: FakeApiClient());
      final run = await repo.executePayroll(
        entityId: 'ent-1',
        title: 'New Payroll',
        currency: 'NGN',
        recipients: [
          const PayrollRecipient(name: 'Chidi', accountOrPhone: '123', amount: 100000.0),
        ],
      );
      expect(run.id, equals('run_new'));
      expect(run.status, equals('COMPLETED'));
      expect(run.totalAmount, equals(100000.0));
    });
  });

  group('Transfer models parse live backend shapes', () {
    test('TransfersBalance.fromJson accepts the live endpoint shape', () {
      // GET /api/transfers/balance returns: {success, balance: "0", currency: "USDC"}
      final balance = TransfersBalance.fromJson({
        'success': true,
        'balance': '48250.75',
        'currency': 'USDC',
      });
      expect(balance.totalUsd, equals(48250.75));
      expect(balance.byCurrency['USDC'], equals(48250.75));
    });

    test('TransfersBalance.fromJson accepts numeric balance and balances map', () {
      final balance = TransfersBalance.fromJson({
        'success': true,
        'balance': 100,
        'currency': 'USD',
        'balances': {'USD': 100, 'NGN': 150000},
      });
      expect(balance.totalUsd, equals(100));
      expect(balance.byCurrency['NGN'], equals(150000));
    });

    test('TransferHistoryItem recognizes INBOUND/OUTBOUND directions', () {
      final inbound = TransferHistoryItem.fromJson({
        'id': 't1',
        'type': 'INBOUND',
        'title': 'Received from Stripe',
        'subtitle': '10/5/2026, 2:00 PM',
        'amount': 45000,
        'currency': 'USDC',
      });
      expect(inbound.isReceived, isTrue);
      expect(inbound.isSent, isFalse);

      final outbound = TransferHistoryItem.fromJson({
        'id': 't2',
        'type': 'OUTBOUND',
        'title': 'Batch Payroll • Eng Sprint',
        'subtitle': '10/4/2026, 9:00 AM',
        'amount': 18450,
        'currency': 'USDC',
      });
      expect(outbound.isSent, isTrue);
      expect(outbound.isReceived, isFalse);
    });

    test('TreasuryTransaction prefers ISO createdAt over the localized date string', () {
      final tx = TreasuryTransaction.fromJson({
        'id': 't1',
        'type': 'INBOUND',
        'title': 'Received from Stripe',
        'subtitle': '',
        'amount': 5000,
        'currency': 'USD',
        // Localized string is garbage — createdAt must win.
        'date': 'not a real date',
        'time': '02:24 PM',
        'mode': 'fiat',
        'senderAccount': '',
        'recipientAccount': '',
        'reference': 't1',
        'createdAt': '2026-10-05T09:30:00.000Z',
      });
      expect(tx.createdAt, DateTime.parse('2026-10-05T09:30:00.000Z'));
      expect(tx.parsedDate, DateTime.parse('2026-10-05T09:30:00.000Z'));
    });

    test('TreasuryTransaction falls back to the en-US date without createdAt', () {
      final tx = TreasuryTransaction.fromJson({
        'id': 't2',
        'type': 'OUTBOUND',
        'title': 'Sent to Vendor',
        'subtitle': '',
        'amount': 1200,
        'currency': 'USD',
        'date': '10/2/2026',
        'time': '11:02 AM',
        'mode': 'fiat',
        'senderAccount': '',
        'recipientAccount': '',
        'reference': 't2',
      });
      expect(tx.createdAt, isNull);
      expect(tx.parsedDate, isNotNull);
      expect(tx.parsedDate!.month, equals(10));
      expect(tx.parsedDate!.day, equals(2));
    });

    test('PendingApproval tolerates payloads without the newer fields', () {
      final approval = PendingApproval.fromJson({
        'id': 'ap_legacy',
        'title': 'Legacy approval',
        'amount': 1000,
        'currency': 'USDC',
        'signedCount': 0,
        'requiredSignatures': 1,
      });
      expect(approval.status, equals('PENDING'));
      expect(approval.createdAt, isNull);
      expect(approval.updatedAt, isNull);
      expect(approval.signers, isEmpty);
    });
  });
}
