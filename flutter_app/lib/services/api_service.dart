import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';
import '../models/room_model.dart';
import 'session_service.dart';

class ApiService {
  // Admin Login
  static Future<Map<String, dynamic>> adminLogin(String password) async {
    final response = await http.post(
      Uri.parse('${ApiConfig.apiBase}/admin/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'password': password}),
    );

    final data = jsonDecode(response.body);
    if (response.statusCode == 200 && data['success'] == true) {
      await SessionService.saveAdminToken(data['token']);
      return {'success': true, 'token': data['token']};
    } else {
      return {'success': false, 'error': data['error'] ?? 'Login failed'};
    }
  }

  // Create Room (Admin only, free, no coins)
  static Future<Map<String, dynamic>> createRoom() async {
    final token = await SessionService.getAdminToken();
    final idempotencyKey = 'req_${DateTime.now().millisecondsSinceEpoch}';

    final response = await http.post(
      Uri.parse('${ApiConfig.apiBase}/rooms'),
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': token ?? '',
      },
      body: jsonEncode({'idempotencyKey': idempotencyKey}),
    );

    final data = jsonDecode(response.body);
    if ((response.statusCode == 200 || response.statusCode == 201) && data['success'] == true) {
      final room = RoomModel.fromJson(Map<String, dynamic>.from(data['room']));
      return {'success': true, 'room': room};
    } else {
      return {'success': false, 'error': data['error'] ?? 'Failed to create room'};
    }
  }

  // Get Room Details by Code
  static Future<Map<String, dynamic>> getRoom(String code) async {
    final response = await http.get(
      Uri.parse('${ApiConfig.apiBase}/rooms/$code'),
      headers: {'Content-Type': 'application/json'},
    );

    final data = jsonDecode(response.body);
    if (response.statusCode == 200 && data['success'] == true) {
      final room = RoomModel.fromJson(Map<String, dynamic>.from(data['room']));
      return {'success': true, 'room': room};
    } else {
      return {'success': false, 'error': data['error'] ?? 'Room not found'};
    }
  }

  // Admin Starts Match
  static Future<Map<String, dynamic>> startMatch(String code) async {
    final token = await SessionService.getAdminToken();

    final response = await http.post(
      Uri.parse('${ApiConfig.apiBase}/rooms/$code/start'),
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': token ?? '',
      },
    );

    final data = jsonDecode(response.body);
    if (response.statusCode == 200 && data['success'] == true) {
      return {'success': true, 'room': data['room']};
    } else {
      return {'success': false, 'error': data['error'] ?? 'Failed to start match'};
    }
  }

  // Admin Gets All Rooms & Stats
  static Future<Map<String, dynamic>> getAdminRooms() async {
    final token = await SessionService.getAdminToken();

    final response = await http.get(
      Uri.parse('${ApiConfig.apiBase}/admin/rooms'),
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': token ?? '',
      },
    );

    final data = jsonDecode(response.body);
    if (response.statusCode == 200 && data['success'] == true) {
      final stats = DashboardStats.fromJson(Map<String, dynamic>.from(data['stats'] ?? {}));
      final roomsList = (data['rooms'] as List? ?? [])
          .map((r) => RoomModel.fromJson(Map<String, dynamic>.from(r)))
          .toList();
      return {'success': true, 'stats': stats, 'rooms': roomsList};
    } else {
      return {'success': false, 'error': data['error'] ?? 'Failed to fetch rooms'};
    }
  }

  // Admin Gets Verified Results
  static Future<Map<String, dynamic>> getAdminResults() async {
    final token = await SessionService.getAdminToken();

    final response = await http.get(
      Uri.parse('${ApiConfig.apiBase}/admin/results'),
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': token ?? '',
      },
    );

    final data = jsonDecode(response.body);
    if (response.statusCode == 200 && data['success'] == true) {
      final resultsList = (data['results'] as List? ?? [])
          .map((r) => VerifiedResult.fromJson(Map<String, dynamic>.from(r)))
          .toList();
      return {'success': true, 'results': resultsList};
    } else {
      return {'success': false, 'error': data['error'] ?? 'Failed to fetch results'};
    }
  }

  // Admin Cancels an Abandoned Room
  static Future<Map<String, dynamic>> cancelRoom(String code) async {
    final token = await SessionService.getAdminToken();

    final response = await http.post(
      Uri.parse('${ApiConfig.apiBase}/admin/rooms/$code/cancel'),
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': token ?? '',
      },
    );

    final data = jsonDecode(response.body);
    if (response.statusCode == 200 && data['success'] == true) {
      return {'success': true};
    } else {
      return {'success': false, 'error': data['error'] ?? 'Failed to cancel room'};
    }
  }

  // Player Joins Room
  static Future<Map<String, dynamic>> joinRoom({
    required String code,
    required String displayName,
    String? existingPlayerId,
    String? existingSessionToken,
  }) async {
    final payload = <String, dynamic>{
      'displayName': displayName,
    };
    if (existingPlayerId != null && existingSessionToken != null) {
      payload['existingPlayerId'] = existingPlayerId;
      payload['existingSessionToken'] = existingSessionToken;
    }

    final response = await http.post(
      Uri.parse('${ApiConfig.apiBase}/rooms/$code/join'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(payload),
    );

    final data = jsonDecode(response.body);
    if (response.statusCode == 200 && data['success'] == true) {
      final playerId = data['playerId'];
      final sessionToken = data['sessionToken'];
      final color = data['color'] ?? 'red';
      final room = RoomModel.fromJson(Map<String, dynamic>.from(data['room']));

      await SessionService.savePlayerSession(
        playerId: playerId,
        sessionToken: sessionToken,
        displayName: displayName,
        roomCode: code,
        color: color,
      );

      return {
        'success': true,
        'playerId': playerId,
        'sessionToken': sessionToken,
        'color': color,
        'room': room,
      };
    } else {
      return {'success': false, 'error': data['error'] ?? 'Failed to join room'};
    }
  }

  // Player Leaves Room
  static Future<Map<String, dynamic>> leaveRoom({
    required String code,
    required String playerId,
    required String sessionToken,
  }) async {
    final response = await http.post(
      Uri.parse('${ApiConfig.apiBase}/rooms/$code/leave'),
      headers: {
        'Content-Type': 'application/json',
        'x-session-token': sessionToken,
        'x-player-id': playerId,
      },
    );

    final data = jsonDecode(response.body);
    await SessionService.clearPlayerSession();
    return {'success': response.statusCode == 200 && data['success'] == true};
  }

  // Get Authoritative Game State
  static Future<Map<String, dynamic>> getRoomState(String code) async {
    final response = await http.get(
      Uri.parse('${ApiConfig.apiBase}/rooms/$code/state'),
      headers: {'Content-Type': 'application/json'},
    );

    final data = jsonDecode(response.body);
    if (response.statusCode == 200 && data['success'] == true) {
      return {
        'success': true,
        'room': data['room'] != null ? RoomModel.fromJson(Map<String, dynamic>.from(data['room'])) : null,
        'gameState': data['gameState'],
      };
    } else {
      return {'success': false, 'error': data['error'] ?? 'Failed to fetch state'};
    }
  }
}
