import 'package:flutter/material.dart';
import '../../models/room_model.dart';
import '../../services/api_service.dart';
import '../../widgets/status_badge.dart';
import 'admin_lobby_screen.dart';

class AdminRoomsScreen extends StatefulWidget {
  const AdminRoomsScreen({super.key});

  @override
  State<AdminRoomsScreen> createState() => _AdminRoomsScreenState();
}

class _AdminRoomsScreenState extends State<AdminRoomsScreen> {
  List<RoomModel> _rooms = [];
  bool _isLoading = true;
  String _filter = 'ALL'; // ALL, WAITING, IN_PROGRESS, COMPLETED

  @override
  void initState() {
    super.initState();
    _fetchRooms();
  }

  Future<void> _fetchRooms() async {
    setState(() => _isLoading = true);
    try {
      final res = await ApiService.getAdminRooms();
      if (res['success'] == true && mounted) {
        setState(() {
          _rooms = res['rooms'] as List<RoomModel>;
        });
      }
    } catch (_) {
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  String _formatTime(int? millis) {
    if (millis == null || millis == 0) return '-';
    final dt = DateTime.fromMillisecondsSinceEpoch(millis);
    return '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')} ${dt.day}/${dt.month}';
  }

  @override
  Widget build(BuildContext context) {
    final filteredRooms = _rooms.where((r) {
      if (_filter == 'ALL') return true;
      return r.status == _filter;
    }).toList();

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B),
        elevation: 0,
        title: const Text('All Rooms History', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _fetchRooms,
          ),
        ],
      ),
      body: Column(
        children: [
          // Filter Tabs
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            color: const Color(0xFF1E293B).withOpacity(0.5),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _buildFilterChip('ALL', 'All Rooms'),
                  const SizedBox(width: 8),
                  _buildFilterChip('WAITING', 'Waiting'),
                  const SizedBox(width: 8),
                  _buildFilterChip('IN_PROGRESS', 'In Progress'),
                  const SizedBox(width: 8),
                  _buildFilterChip('COMPLETED', 'Completed'),
                ],
              ),
            ),
          ),

          // Rooms List
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: Color(0xFF6366F1)))
                : filteredRooms.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: const [
                            Icon(Icons.inbox_outlined, size: 48, color: Colors.white24),
                            SizedBox(height: 12),
                            Text('No rooms found', style: TextStyle(color: Colors.white54)),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _fetchRooms,
                        color: const Color(0xFF6366F1),
                        child: ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: filteredRooms.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 12),
                          itemBuilder: (ctx, idx) {
                            final room = filteredRooms[idx];
                            return _buildRoomTile(room);
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String value, String label) {
    final isSelected = _filter == value;
    return ChoiceChip(
      label: Text(label),
      selected: isSelected,
      selectedColor: const Color(0xFF6366F1),
      backgroundColor: const Color(0xFF1E293B),
      labelStyle: TextStyle(
        color: isSelected ? Colors.white : Colors.white70,
        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
        fontSize: 12,
      ),
      onSelected: (_) => setState(() => _filter = value),
    );
  }

  Widget _buildRoomTile(RoomModel room) {
    final p1Name = room.player1?.name ?? 'Empty';
    final p2Name = room.player2?.name ?? 'Empty';

    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => AdminLobbyScreen(roomCode: room.code)),
        ).then((_) => _fetchRooms());
      },
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFF1E293B),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFF334155), width: 1),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Text(
                      room.code,
                      style: const TextStyle(
                        color: Color(0xFF38BDF8),
                        fontWeight: FontWeight.w900,
                        fontSize: 18,
                        letterSpacing: 2,
                      ),
                    ),
                    const SizedBox(width: 8),
                    StatusBadge(status: room.status),
                  ],
                ),
                Text(
                  _formatTime(room.createdAt),
                  style: const TextStyle(color: Colors.white38, fontSize: 11),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: Row(
                    children: [
                      const CircleAvatar(
                        radius: 5,
                        backgroundColor: Color(0xFFEF4444),
                      ),
                      const SizedBox(width: 6),
                      Flexible(
                        child: Text(
                          p1Name,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: room.player1 != null ? Colors.white : Colors.white30,
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 8),
                  child: Text('VS', style: TextStyle(color: Colors.white38, fontSize: 11, fontWeight: FontWeight.bold)),
                ),
                Expanded(
                  child: Row(
                    children: [
                      const CircleAvatar(
                        radius: 5,
                        backgroundColor: Color(0xFFEAB308),
                      ),
                      const SizedBox(width: 6),
                      Flexible(
                        child: Text(
                          p2Name,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: room.player2 != null ? Colors.white : Colors.white30,
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (room.isCompleted && room.winnerName != null) ...[
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: const Color(0xFF064E3B),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.emoji_events_rounded, color: Color(0xFFFBBF24), size: 16),
                    const SizedBox(width: 6),
                    Text(
                      'Winner: ${room.winnerName}',
                      style: const TextStyle(color: Color(0xFF6EE7B7), fontSize: 12, fontWeight: FontWeight.bold),
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
}
