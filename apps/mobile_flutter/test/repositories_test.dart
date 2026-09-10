import 'package:flutter_test/flutter_test.dart';
import 'package:proxim_app/src/features/auth/data/auth_repository.dart';
import 'package:proxim_app/src/features/developer/data/developer_repository.dart';
import 'package:proxim_app/src/features/invoices/data/invoices_repository.dart';
import 'package:proxim_app/src/features/transfers/data/transfers_repository.dart';
import 'package:proxim_app/src/features/treasury/data/treasury_repository.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('AuthRepository Fallback & Session', () {
    final repo = AuthRepository();

    test('loginDemo returns valid ProximUser with business and individual entities', () async {
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

  group('TransfersRepository Quotes & Transfers', () {
    final repo = TransfersRepository();

    test('getFxQuote calculates realistic rates and fees', () async {
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

    test('sendTransfer generates valid receipt without crypto jargon', () async {
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

  group('TreasuryRepository Balance Sheet', () {
    final repo = TreasuryRepository();

    test('getBalanceSheet returns positive operating surplus and runway', () async {
      final data = await repo.getBalanceSheet(entityId: 'ent-1');
      expect(data.netOperatingSurplus, greaterThan(0));
      expect(data.totalCurrentAssets, greaterThan(0));
      expect(data.runwayMonths, greaterThan(0));
    });
  });

  group('InvoicesRepository & DeveloperRepository', () {
    test('createInvoice builds pending invoice with reference', () async {
      final repo = InvoicesRepository();
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
      final repo = DeveloperRepository();
      final keys = await repo.getKeys('ent-1');
      expect(keys.length, equals(2));
      expect(keys.any((k) => k.environment == 'production'), isTrue);

      final rolled = await repo.rollKey('ent-1', 'production');
      expect(rolled, isNotNull);
      expect(rolled.keyPrefix, startsWith('px_live_'));
    });
  });
}
