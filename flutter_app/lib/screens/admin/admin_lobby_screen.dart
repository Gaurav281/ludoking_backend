import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../models/room_model.dart';
import '../../services/api_service.dart';
import '../../widgets/status_badge.dart';

class AdminLobbyScreen extends StatefulWidget {
  final String roomCode;

  const AdminLobbyScreen({super.key, required this.roomCode});

  @override
  State<AdminLobbyScreen> createState() => _AdminLobbyScreenState();
}

class _AdminLobbyScreenState extends State<AdminLobbyScreen> {
  RoomModel? _room;
  bool _isLoading = true;
  bool _isStartingMatch = false;
  String? _errorMessage;
  Timer? _pollingTimer;

  @override
  void initState() {
    super.initState();
    _fetchRoom();
    _pollingTimer = Timer.periodic(const Duration(seconds: 2), (_) {
      if (mounted) _fetchRoom(silent: true);
    });
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    super.dispose();
  }

  Future<void> _fetchRoom({bool silent = false}) async {
    if (!silent) setState(() => _isLoading = true);
    try {
      final res = await ApiService.getRoom(widget.roomCode);
      if (res['success'] == true && mounted) {
        setState(() {
          _room = res['room'] as RoomModel;
          _errorMessage = null;
        });
      } else if (mounted && !silent) {
        setState(() => _errorMessage = res['error']);
      }
    } catch (e) {
      if (mounted && !silent) {
        setState(() => _errorMessage = 'Network error: ${e.toString()}');
      }
    } finally {
      if (mounted && !silent) setState(() => _isLoading = false);
    }
  }

  Future<void> _handleStartMatch() async {
    if (_room == null || !_room!.isFull) return;

    setState(() {
      _isStartingMatch = true;
      _errorMessage = null;
    });

    try {
      final res = await ApiService.startMatch(widget.roomCode);
      if (res['success'] == true && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: Color(0xFF7C3AED),
            content: Text('Match started! Both players can now roll.'),
          ),
        );
        _fetchRoom();
      } else if (mounted) {
        setState(() => _errorMessage = res['error'] ?? 'Failed to start match');
      }
    } catch (e) {
      if (mounted) {
        setState(() => _errorMessage = 'Error: ${e.toString()}');
      }
    } finally {
      if (mounted) setState(() => _isStartingMatch = false);
    }
  }

  Future<void> _handleCancelRoom() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF14131B),
        title: const Text('Cancel Room?', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        content: const Text(
          'Are you sure you want to cancel this room?',
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
            child: const Text('Cancel Room', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirm == true && mounted) {
      try {
        final res = await ApiService.cancelRoom(widget.roomCode);
        if (res['success'] == true && mounted) {
          Navigator.pop(context);
        } else if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              backgroundColor: const Color(0xFFEF4444),
              content: Text(res['error'] ?? 'Cancel failed'),
            ),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              backgroundColor: const Color(0xFFEF4444),
              content: Text('Error: ${e.toString()}'),
            ),
          );
        }
      }
    }
  }

  void _copyRoomCode() {
    Clipboard.setData(ClipboardData(text: widget.roomCode));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor: const Color(0xFF7C3AED),
        content: Text('Room code ${widget.roomCode} copied'),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isFull = _room?.isFull ?? false;
    final isWaiting = _room?.isWaiting ?? true;
    final isInProgress = _room?.isInProgress ?? false;
    final isCompleted = _room?.isCompleted ?? false;

    const primaryPurple = Color(0xFF7C3AED);
    const neonPurple = Color(0xFFA855F7);
    const cardBg = Color(0xFF14131B);
    const borderPurple = Color(0xFF2E2A44);

    return Scaffold(
      backgroundColor: const Color(0xFF09090B),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20, color: Colors.white70),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('Room Lobby', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        actions: [
          if (isWaiting)
            IconButton(
              icon: const Icon(Icons.cancel_outlined, color: Color(0xFFEF4444)),
              onPressed: _handleCancelRoom,
              tooltip: 'Cancel Room',
            ),
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: Colors.white70),
            onPressed: () => _fetchRoom(),
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: neonPurple))
          : SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (_errorMessage != null) ...[
                    Container(
                      margin: const EdgeInsets.only(bottom: 16),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEF4444).withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFEF4444)),
                      ),
                      child: Text(
                        _errorMessage!,
                        style: const TextStyle(color: Color(0xFFFCA5A5), fontSize: 13),
                      ),
                    ),
                  ],

                  // Room Code Hero Box
                  Container(
                    padding: const EdgeInsets.all(22),
                    decoration: BoxDecoration(
                      color: cardBg,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: borderPurple),
                    ),
                    child: Column(
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text(
                              'ROOM CODE',
                              style: TextStyle(
                                color: Colors.white54,
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 1.2,
                              ),
                            ),
                            if (_room != null) StatusBadge(status: _room!.status),
                          ],
                        ),
                        const SizedBox(height: 12),
                        SelectableText(
                          widget.roomCode,
                          style: const TextStyle(
                            color: neonPurple,
                            fontSize: 38,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 6,
                          ),
                        ),
                        const SizedBox(height: 16),
                        OutlinedButton.icon(
                          style: OutlinedButton.styleFrom(
                            foregroundColor: Colors.white,
                            side: const BorderSide(color: borderPurple),
                            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          onPressed: _copyRoomCode,
                          icon: const Icon(Icons.copy_rounded, size: 18, color: neonPurple),
                          label: const Text('Copy Room Code'),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Player Slots Header
                  const Text(
                    'Players',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                  ),
                  const SizedBox(height: 12),

                  // Player 1 Card (Red)
                  _buildPlayerSlotCard(
                    slotNumber: 1,
                    colorName: 'Red',
                    themeColor: const Color(0xFFEF4444),
                    player: _room?.player1,
                    cardBg: cardBg,
                    borderPurple: borderPurple,
                  ),
                  const SizedBox(height: 12),

                  // Player 2 Card (Yellow)
                  _buildPlayerSlotCard(
                    slotNumber: 2,
                    colorName: 'Yellow',
                    themeColor: const Color(0xFFF59E0B),
                    player: _room?.player2,
                    cardBg: cardBg,
                    borderPurple: borderPurple,
                  ),
                  const SizedBox(height: 28),

                  // Status Action
                  if (isWaiting) ...[
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: isFull ? primaryPurple : const Color(0xFF27272A),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        elevation: isFull ? 4 : 0,
                      ),
                      onPressed: (_isStartingMatch || !isFull) ? null : _handleStartMatch,
                      child: _isStartingMatch
                          ? const SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                            )
                          : Text(
                              isFull ? 'Start Match' : 'Waiting for Players...',
                              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                            ),
                    ),
                  ] else if (isInProgress) ...[
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: cardBg,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: primaryPurple),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.sports_esports_rounded, color: neonPurple, size: 28),
                          SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Match in Progress',
                                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                                ),
                                SizedBox(height: 2),
                                Text(
                                  'Verified results will be recorded upon completion.',
                                  style: TextStyle(color: Colors.white60, fontSize: 12),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ] else if (isCompleted) ...[
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: cardBg,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFF10B981)),
                      ),
                      child: Column(
                        children: [
                          const Icon(Icons.emoji_events_rounded, color: Color(0xFFF59E0B), size: 36),
                          const SizedBox(height: 8),
                          const Text(
                            'Match Verified!',
                            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 17),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Winner: ${_room?.winnerName ?? 'Player'} (${(_room?.winnerColor ?? '').toUpperCase()})',
                            style: const TextStyle(color: Color(0xFFFDE68A), fontWeight: FontWeight.bold, fontSize: 15),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
    );
  }

  Widget _buildPlayerSlotCard({
    required int slotNumber,
    required String colorName,
    required Color themeColor,
    required PlayerSlot? player,
    required Color cardBg,
    required Color borderPurple,
  }) {
    final isOccupied = player != null;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isOccupied ? themeColor.withValues(alpha: 0.5) : borderPurple,
          width: 1.5,
        ),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 20,
            backgroundColor: themeColor.withValues(alpha: 0.2),
            child: Icon(
              isOccupied ? Icons.person_rounded : Icons.person_outline_rounded,
              color: isOccupied ? themeColor : Colors.white30,
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
                      'Player $slotNumber',
                      style: const TextStyle(color: Colors.white54, fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                      decoration: BoxDecoration(
                        color: themeColor.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        colorName,
                        style: TextStyle(color: themeColor, fontSize: 10, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  isOccupied ? player.name : 'Waiting to join...',
                  style: TextStyle(
                    color: isOccupied ? Colors.white : Colors.white30,
                    fontSize: 16,
                    fontWeight: isOccupied ? FontWeight.bold : FontWeight.normal,
                  ),
                ),
              ],
            ),
          ),
          if (isOccupied)
            const Icon(Icons.check_circle_rounded, color: Color(0xFF10B981), size: 20),
        ],
      ),
    );
  }
}
