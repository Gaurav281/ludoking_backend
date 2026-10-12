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
    // Poll room status every 2 seconds
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
    if (_room == null || !_room!.isFull || _isStartingMatch) return;

    setState(() => _isStartingMatch = true);
    try {
      final res = await ApiService.startMatch(widget.roomCode);
      if (res['success'] == true && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: Color(0xFF10B981),
            content: Text('Match started successfully! Players are now playing.'),
          ),
        );
        _fetchRoom();
      } else if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: const Color(0xFFEF4444),
            content: Text(res['error'] ?? 'Failed to start match'),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: const Color(0xFFEF4444),
            content: Text('Network error: ${e.toString()}'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isStartingMatch = false);
    }
  }

  Future<void> _handleCancelRoom() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        title: const Text('Cancel Room?', style: TextStyle(color: Colors.white)),
        content: const Text(
          'Are you sure you want to cancel this room? Players will no longer be able to join.',
          style: TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('No, Keep Room', style: TextStyle(color: Colors.white60)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEF4444)),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Yes, Cancel', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirm == true && mounted) {
      final res = await ApiService.cancelRoom(widget.roomCode);
      if (res['success'] == true && mounted) {
        Navigator.pop(context);
      }
    }
  }

  void _copyRoomCode() {
    Clipboard.setData(ClipboardData(text: widget.roomCode));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor: const Color(0xFF6366F1),
        content: Text('Room code "${widget.roomCode}" copied to clipboard!'),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  void _shareRoom() {
    Clipboard.setData(ClipboardData(
      text: 'Join my Ludo Tournament room on the app! Room Code: ${widget.roomCode}',
    ));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        backgroundColor: Color(0xFF6366F1),
        content: Text('Room invitation copied to clipboard!'),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isFull = _room?.isFull ?? false;
    final isWaiting = _room?.isWaiting ?? true;
    final isInProgress = _room?.isInProgress ?? false;
    final isCompleted = _room?.isCompleted ?? false;

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B),
        elevation: 0,
        title: const Text('Room Lobby (Admin)', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          if (isWaiting)
            IconButton(
              icon: const Icon(Icons.cancel_outlined, color: Color(0xFFEF4444)),
              onPressed: _handleCancelRoom,
              tooltip: 'Cancel Room',
            ),
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => _fetchRoom(),
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF6366F1)))
          : SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (_errorMessage != null) ...[
                    Container(
                      margin: const EdgeInsets.only(bottom: 16),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFF450A0A),
                        borderRadius: BorderRadius.circular(10),
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
                    padding: const EdgeInsets.all(24),
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
                        const SizedBox(height: 14),
                        SelectableText(
                          widget.roomCode,
                          style: const TextStyle(
                            color: Color(0xFF38BDF8),
                            fontSize: 42,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 6,
                          ),
                        ),
                        const SizedBox(height: 16),
                        Row(
                          children: [
                            Expanded(
                              child: OutlinedButton.icon(
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: Colors.white,
                                  side: const BorderSide(color: Color(0xFF6366F1)),
                                  padding: const EdgeInsets.symmetric(vertical: 12),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                ),
                                onPressed: _copyRoomCode,
                                icon: const Icon(Icons.copy_rounded, size: 18),
                                label: const Text('Copy Code'),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: ElevatedButton.icon(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF6366F1),
                                  foregroundColor: Colors.white,
                                  padding: const EdgeInsets.symmetric(vertical: 12),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                ),
                                onPressed: _shareRoom,
                                icon: const Icon(Icons.share_rounded, size: 18),
                                label: const Text('Share Room'),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Player Slots Header
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Player Slots',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: isFull ? const Color(0xFF064E3B) : const Color(0xFF78350F),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          isFull ? '2 / 2 Players Ready' : '${(_room?.player1 != null ? 1 : 0) + (_room?.player2 != null ? 1 : 0)} / 2 Joined',
                          style: TextStyle(
                            color: isFull ? const Color(0xFF6EE7B7) : const Color(0xFFFDE68A),
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),

                  // Player 1 Card (Red)
                  _buildPlayerSlotCard(
                    slotNumber: 1,
                    colorName: 'Red',
                    themeColor: const Color(0xFFEF4444),
                    player: _room?.player1,
                  ),
                  const SizedBox(height: 12),

                  // Player 2 Card (Yellow)
                  _buildPlayerSlotCard(
                    slotNumber: 2,
                    colorName: 'Yellow',
                    themeColor: const Color(0xFFEAB308),
                    player: _room?.player2,
                  ),
                  const SizedBox(height: 28),

                  // Start Match / Match Status Action Section
                  if (isWaiting) ...[
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: isFull ? const Color(0xFF10B981) : const Color(0xFF334155),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        elevation: isFull ? 4 : 0,
                      ),
                      onPressed: isFull && !_isStartingMatch ? _handleStartMatch : null,
                      child: _isStartingMatch
                          ? const SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                            )
                          : Text(
                              isFull ? 'Start Match Now' : 'Waiting for 2 Players to Join...',
                              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                            ),
                    ),
                    const SizedBox(height: 10),
                    Center(
                      child: Text(
                        isFull
                          ? 'Both players connected. Tap to launch the authoritative match!'
                          : 'Share the room code above with Player 1 and Player 2',
                        style: const TextStyle(color: Colors.white54, fontSize: 12),
                      ),
                    ),
                  ] else if (isInProgress) ...[
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1E1B4B),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFF6366F1)),
                      ),
                      child: Row(
                        children: const [
                          Icon(Icons.sports_esports_rounded, color: Color(0xFF818CF8), size: 28),
                          SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Match is Currently Active',
                                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                                ),
                                SizedBox(height: 4),
                                Text(
                                  'Players are rolling and moving on their devices. Verified result will appear here automatically upon completion.',
                                  style: TextStyle(color: Colors.white70, fontSize: 12),
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
                        color: const Color(0xFF064E3B),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFF10B981)),
                      ),
                      child: Column(
                        children: [
                          const Icon(Icons.emoji_events_rounded, color: Color(0xFFFBBF24), size: 40),
                          const SizedBox(height: 8),
                          const Text(
                            'Match Completed & Verified!',
                            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 17),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'Winner: ${_room?.winnerName ?? 'Player'} (${(_room?.winnerColor ?? '').toUpperCase()})',
                            style: const TextStyle(color: Color(0xFFFDE68A), fontWeight: FontWeight.w700, fontSize: 15),
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
  }) {
    final isOccupied = player != null;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isOccupied ? themeColor.withOpacity(0.5) : const Color(0xFF334155),
          width: 1.5,
        ),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 22,
            backgroundColor: themeColor.withOpacity(0.2),
            child: Icon(
              isOccupied ? Icons.person_rounded : Icons.person_outline_rounded,
              color: isOccupied ? themeColor : Colors.white30,
              size: 24,
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
                        color: themeColor.withOpacity(0.2),
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
                  isOccupied ? player.name : 'Waiting for player to join...',
                  style: TextStyle(
                    color: isOccupied ? Colors.white : Colors.white38,
                    fontWeight: isOccupied ? FontWeight.bold : FontWeight.normal,
                    fontSize: 15,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: isOccupied ? const Color(0xFF064E3B) : const Color(0xFF1E293B),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: isOccupied ? const Color(0xFF10B981) : Colors.white24,
              ),
            ),
            child: Text(
              isOccupied ? 'Ready' : 'Open Slot',
              style: TextStyle(
                color: isOccupied ? const Color(0xFF6EE7B7) : Colors.white38,
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
