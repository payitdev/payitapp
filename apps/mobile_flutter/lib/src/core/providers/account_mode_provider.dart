import 'package:flutter_riverpod/flutter_riverpod.dart';

enum AccountMode { personal, business }

class AccountModeNotifier extends Notifier<AccountMode> {
  @override
  AccountMode build() => AccountMode.business;

  void setMode(AccountMode mode) => state = mode;
}

final accountModeProvider =
    NotifierProvider<AccountModeNotifier, AccountMode>(AccountModeNotifier.new);
