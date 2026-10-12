import 'package:shared_preferences/shared_preferences.dart';

class SessionService {
  static const String _keyAdminToken = 'ludo_admin_token';
  static const String _keyPlayerId = 'ludo_player_id';
  static const String _keySessionToken = 'ludo_session_token';
  static const String _keyDisplayName = 'ludo_display_name';
  static const String _keyLastRoomCode = 'ludo_last_room_code';
  static const String _keyPlayerColor = 'ludo_player_color';

  static SharedPreferences? _prefs;

  static Future<void> init() async {
    _prefs ??= await SharedPreferences.getInstance();
  }

  // Admin Session
  static Future<void> saveAdminToken(String token) async {
    await init();
    await _prefs!.setString(_keyAdminToken, token);
  }

  static Future<String?> getAdminToken() async {
    await init();
    return _prefs!.getString(_keyAdminToken);
  }

  static Future<void> clearAdminToken() async {
    await init();
    await _prefs!.remove(_keyAdminToken);
  }

  // Player Session
  static Future<void> savePlayerSession({
    required String playerId,
    required String sessionToken,
    required String displayName,
    required String roomCode,
    required String color,
  }) async {
    await init();
    await _prefs!.setString(_keyPlayerId, playerId);
    await _prefs!.setString(_keySessionToken, sessionToken);
    await _prefs!.setString(_keyDisplayName, displayName);
    await _prefs!.setString(_keyLastRoomCode, roomCode);
    await _prefs!.setString(_keyPlayerColor, color);
  }

  static Future<Map<String, String?>> getPlayerSession() async {
    await init();
    return {
      'playerId': _prefs!.getString(_keyPlayerId),
      'sessionToken': _prefs!.getString(_keySessionToken),
      'displayName': _prefs!.getString(_keyDisplayName),
      'roomCode': _prefs!.getString(_keyLastRoomCode),
      'color': _prefs!.getString(_keyPlayerColor),
    };
  }

  static Future<void> clearPlayerSession() async {
    await init();
    await _prefs!.remove(_keyPlayerId);
    await _prefs!.remove(_keySessionToken);
    await _prefs!.remove(_keyLastRoomCode);
    await _prefs!.remove(_keyPlayerColor);
  }
}
