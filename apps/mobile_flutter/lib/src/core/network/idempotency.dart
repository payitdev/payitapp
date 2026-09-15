import 'dart:math';

/// Generates RFC-4122 v4 UUID strings for use as idempotency keys on POST/PUT requests.
/// The backend enforces idempotency via the `Idempotency-Key` header.
class IdempotencyKey {
  IdempotencyKey._();

  static final Random _rng = Random.secure();

  /// Returns a new random UUID v4 string, e.g. `550e8400-e29b-41d4-a716-446655440000`
  static String generate() {
    final bytes = List<int>.generate(16, (_) => _rng.nextInt(256));
    // Set version 4 bits
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    // Set variant bits
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    String hex(int byte) => byte.toRadixString(16).padLeft(2, '0');

    return '${hex(bytes[0])}${hex(bytes[1])}${hex(bytes[2])}${hex(bytes[3])}'
        '-${hex(bytes[4])}${hex(bytes[5])}'
        '-${hex(bytes[6])}${hex(bytes[7])}'
        '-${hex(bytes[8])}${hex(bytes[9])}'
        '-${hex(bytes[10])}${hex(bytes[11])}${hex(bytes[12])}${hex(bytes[13])}${hex(bytes[14])}${hex(bytes[15])}';
  }
}
