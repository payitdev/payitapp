// TODO(Phase 3): ApiClient on dio.
//
// Planned shape:
// - Base URL from AppConfig.apiBaseUrl.
// - Interceptor attaching `Authorization: Bearer <jwt>` from token storage
//   (flutter_secure_storage on Android; localStorage fallback on web —
//   flagged for security review for Telegram Mini App).
// - Interceptor attaching `Idempotency-Key` (ULID) to every POST — the
//   backend enforces idempotency on POSTs.
// - Error mapper to a typed ApiFailure (401 -> re-login redirect via the
//   router; 409/422 -> message surfaces in UI).
// - Dio must only be used from repository classes (src/features/*/data),
//   never directly from widgets.
//
// No dio calls are implemented in Phase 1.
