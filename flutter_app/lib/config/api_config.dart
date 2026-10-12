class ApiConfig {
  // Configurable base URL
  static String _customBaseUrl = '';

  static String get defaultBaseUrl {
    return 'https://ludo-room-platform.vercel.app';
  }

  static String get baseUrl {
    if (_customBaseUrl.isNotEmpty) {
      return _customBaseUrl;
    }
    return defaultBaseUrl;
  }

  static void setBaseUrl(String url) {
    String clean = url.trim();
    if (clean.endsWith('/')) {
      clean = clean.substring(0, clean.length - 1);
    }
    _customBaseUrl = clean;
  }

  static String get apiBase => '$baseUrl/api';

  // Game URL for webview embedding
  static String getGameUrl({
    required String roomCode,
    required String playerId,
    required String sessionToken,
    required String color,
  }) {
    final encodedApi = Uri.encodeComponent(baseUrl);
    return '$baseUrl/game/index.html?roomCode=$roomCode&playerId=$playerId&sessionToken=$sessionToken&color=$color&apiUrl=$encodedApi';
  }

  // Polling intervals in milliseconds
  static const int lobbyPollingMs = 2000;
  static const int matchPollingMs = 1000;
  static const int adminPollingMs = 2500;
}
