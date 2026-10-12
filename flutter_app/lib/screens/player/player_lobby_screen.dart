import 'dart:async';
import 'package:flutter/material.dart';
import '../../models/room_model.dart';
import '../../services/api_service.dart';
import '../../widgets/status_badge.dart';
import 'game_webview_screen.dart';

class PlayerLobbyScreen extends StatefulWidget {
  final RoomModel room;
  final String playerId;
  final String sessionToken;
  final String playerName;
  final String color;

  const PlayerLobbyScreen({
    super.key,
    required this.room,
    required this.playerId,
    required this.sessionToken,
    required this.playerName,
    required this.color,
  });

  @override
  State<PlayerLobbyScreen> createState() => _PlayerLobbyScreenState();
}

class _PlayerLobbyScreenState extends State<PlayerLobbyScreen> {
  late RoomModel _currentRoom;
  Timer? _pollingTimer;
  bool _isNavigatingToGame = false;

  @override
  void initState() {
    super.initState();
    _currentRoom = widget.room;
    // Check if match already started
    if (_currentRoom.isInProgress) {
      _navigateToGame();
    } else {
      _startPolling();
    }
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    super.dispose();
  }

  void _startPolling() {
    _pollingTimer = Timer.periodic(const Duration(seconds: 2), (_) {
      if (mounted) _pollRoomStatus();
    });
  }

  Future<void> _pollRoomStatus() async {
    try {
      final res = await ApiService.getRoom(_currentRoom.code);
      if (res['success'] == true && mounted) {
        final updatedRoom = res['room'] as RoomModel;
        setState(() {
          _currentRoom = updatedRoom;
        });

        // Automatically transition when admin starts match
        if (updatedRoom.isInProgress && !_isNavigatingToGame) {
          _navigateToGame();
        }
      }
    } catch (_) {
      // Ignore transient polling drops
    }
  }

  void _navigateToGame() {
    if (_isNavigatingToGame) return;
    _isNavigatingToGame = true;
    _pollingTimer?.cancel();

    Navigator.pushReplacement(
      context,
      MaterialPageRoute(
        builder: (_) => GameWebViewScreen(
          roomCode: _currentRoom.code,
          playerId: widget.playerId,
          sessionToken: widget.sessionToken,
          color: widget.color,
        ),
      ),
    );
  }

  Future<void> _handleLeaveRoom() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF14131B),
        title: const Text('Exit Lobby?', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        content: const Text(
          'Are you sure you want to exit?',
          style: TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Stay', style: TextStyle(color: Colors.white70)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEF4444)),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Exit', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirm == true && mounted) {
      await ApiService.leaveRoom(
        code: _currentRoom.code,
        playerId: widget.playerId,
        sessionToken: widget.sessionToken,
      );
      if (mounted) Navigator.pop(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isFull = _currentRoom.isFull;
    final themeColor = widget.color.toLowerCase() == 'red' ? const Color(0xFFEF4444) : const Color(0xFFEAB308);

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _handleLeaveRoom();
      },
      child: Scaffold(
        backgroundColor: const Color(0xFF09090B),
        appBar: AppBar(
          backgroundColor: const Color(0xFF09090B),
          elevation: 0,
          title: const Text('Match Lobby', style: TextStyle(fontWeight: FontWeight.bold)),
          actions: [
            IconButton(
              icon: const Icon(Icons.exit_to_app_rounded, color: Color(0xFFEF4444)),
              onPressed: _handleLeaveRoom,
              tooltip: 'Leave Room',
            ),
          ],
        ),
        body: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Hero Room Code Card
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFF334155), width: 1.5),
                ),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('ROOM CODE', style: TextStyle(color: Colors.white54, fontSize: 11, fontWeight: FontWeight.bold)),
                        StatusBadge(status: _currentRoom.status),
                      ],
                    ),
                    const SizedBox(height: 10),
                    SelectableText(
                      _currentRoom.code,
                      style: const TextStyle(
                        color: Color(0xFF38BDF8),
                        fontSize: 38,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 6,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'You are playing as ${widget.color.toUpperCase()}',
                      style: TextStyle(color: themeColor, fontWeight: FontWeight.bold, fontSize: 14),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Player slots
              const Text(
                'Players in Room',
                style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),

              _buildPlayerCard(
                name: _currentRoom.player1?.name,
                colorName: 'Red',
                color: const Color(0xFFEF4444),
                isYou: _currentRoom.player1?.id == widget.playerId,
              ),
              const SizedBox(height: 12),

              _buildPlayerCard(
                name: _currentRoom.player2?.name,
                colorName: 'Yellow',
                color: const Color(0xFFEAB308),
                isYou: _currentRoom.player2?.id == widget.playerId,
              ),
              const SizedBox(height: 32),

              // Waiting Message Card
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E1B4B),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFF6366F1).withOpacity(0.5)),
                ),
                child: Column(
                  children: [
                    const SizedBox(
                      width: 32,
                      height: 32,
                      child: CircularProgressIndicator(color: Color(0xFF818CF8), strokeWidth: 3),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      isFull
                          ? 'Ready! Waiting for Tournament Admin to Start...'
                          : 'Waiting for Opponent to Join...',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      isFull
                          ? 'Both players are connected. The tournament admin will launch the match shortly. Your screen will transition automatically.'
                          : 'Share room code "${_currentRoom.code}" with the second player.',
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.white70, fontSize: 13, height: 1.4),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPlayerCard({
    required String? name,
    required String colorName,
    required Color color,
    required bool isYou,
  }) {
    final isJoined = name != null;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isJoined ? color.withOpacity(0.6) : const Color(0xFF334155),
          width: 1.5,
        ),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 20,
            backgroundColor: color.withOpacity(0.2),
            child: Icon(
              isJoined ? Icons.person_rounded : Icons.person_outline_rounded,
              color: isJoined ? color : Colors.white24,
              size: 22,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      colorName,
                      style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                    if (isYou) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                        decoration: BoxDecoration(
                          color: const Color(0xFF6366F1),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Text('YOU', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold)),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 3),
                Text(
                  isJoined ? name : 'Waiting for player...',
                  style: TextStyle(
                    color: isJoined ? Colors.white : Colors.white30,
                    fontWeight: isJoined ? FontWeight.bold : FontWeight.normal,
                    fontSize: 15,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: isJoined ? const Color(0xFF064E3B) : const Color(0xFF0F172A),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(
              isJoined ? 'Ready' : 'Slot Open',
              style: TextStyle(
                color: isJoined ? const Color(0xFF6EE7B7) : Colors.white38,
                fontSize: 11,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
