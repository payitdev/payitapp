/// Compile-time app configuration, injected via `--dart-define` flags:
///
///     flutter run --dart-define=API_BASE_URL=http://localhost:3001
///
/// Supported flags:
///   `API_BASE_URL` — backend base URL. Defaults to `http://localhost:3001`
///       (dev). For staging/production use the render.yaml domains, e.g.
///       `--dart-define=API_BASE_URL=https://api.example.com`
class AppConfig {
  const AppConfig._();

  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:3001',
  );
}
