import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../storage/token_storage.dart';
import 'api_config.dart';

class ProximApiClient {
  final Dio _dio;
  final TokenStorage _tokenStorage;

  ProximApiClient({Dio? dio, TokenStorage? tokenStorage})
      : _tokenStorage = tokenStorage ?? TokenStorage(),
        _dio = dio ??
            Dio(
              BaseOptions(
                baseUrl: ApiConfig.baseUrl,
                connectTimeout: ApiConfig.connectTimeout,
                receiveTimeout: ApiConfig.receiveTimeout,
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                },
              ),
            ) {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _tokenStorage.getToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          final activeEntityId = await _tokenStorage.getActiveEntityId();
          if (activeEntityId != null && activeEntityId.isNotEmpty) {
            options.headers['x-entity-id'] = activeEntityId;
          }
          return handler.next(options);
        },
        onError: (DioException error, handler) {
          final friendlyMessage = _mapErrorMessage(error);
          return handler.next(
            error.copyWith(
              error: ProximException(
                friendlyMessage,
                statusCode: error.response?.statusCode,
                code: error.response?.data is Map ? error.response?.data['code']?.toString() : null,
              ),
            ),
          );
        },
      ),
    );

    if (kDebugMode) {
      _dio.interceptors.add(
        LogInterceptor(
          requestBody: true,
          responseBody: false,
          logPrint: (obj) => debugPrint('[API] $obj'),
        ),
      );
    }
  }

  TokenStorage get tokenStorage => _tokenStorage;
  Dio get dio => _dio;

  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await _dio.get<T>(path, queryParameters: queryParameters, options: options);
    } on DioException catch (e) {
      throw _unwrapError(e);
    }
  }

  Future<Response<T>> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await _dio.post<T>(path, data: data, queryParameters: queryParameters, options: options);
    } on DioException catch (e) {
      throw _unwrapError(e);
    }
  }

  Future<Response<T>> put<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await _dio.put<T>(path, data: data, queryParameters: queryParameters, options: options);
    } on DioException catch (e) {
      throw _unwrapError(e);
    }
  }

  Future<Response<T>> delete<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await _dio.delete<T>(path, data: data, queryParameters: queryParameters, options: options);
    } on DioException catch (e) {
      throw _unwrapError(e);
    }
  }

  Exception _unwrapError(DioException e) {
    if (e.error is ProximException) {
      return e.error as ProximException;
    }
    return ProximException(_mapErrorMessage(e), statusCode: e.response?.statusCode);
  }

  static String _mapErrorMessage(DioException error) {
    if (error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.receiveTimeout ||
        error.type == DioExceptionType.sendTimeout) {
      return 'Connection timed out. Please check your network and try again.';
    }

    if (error.type == DioExceptionType.connectionError) {
      return 'Unable to reach the settlement network. Please check your internet connection.';
    }

    final response = error.response;
    if (response != null && response.data is Map<String, dynamic>) {
      final map = response.data as Map<String, dynamic>;
      if (map['error'] is String) return map['error'] as String;
      if (map['message'] is String) return map['message'] as String;
    }

    switch (response?.statusCode) {
      case 400:
        return 'Invalid request details. Please check your inputs.';
      case 401:
        return 'Your session has expired. Please sign in again.';
      case 403:
        return 'You do not have permission to perform this action.';
      case 404:
        return 'The requested resource was not found.';
      case 409:
        return 'This transaction or identity is already registered.';
      case 500:
      case 502:
      case 503:
        return 'Settlement service is momentarily unavailable. Please try again shortly.';
      default:
        return 'We couldn\'t complete your request. Please try again.';
    }
  }
}
