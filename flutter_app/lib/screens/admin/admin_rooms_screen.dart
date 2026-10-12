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
  String _filter = 'ALL';

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
    if (millis == null || millis == 0) return '';
    final dt = DateTime.fromMillisecondsSinceEpoch(millis);
    return '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    const neonPurple = Color(0xFFA855F7);
    const cardBg = Color(0xFF14131B);
    const borderPurple = Color(0xFF2E2A44);

    final filteredRooms = _rooms.where((r) {
      if (_filter == 'ALL') return true;
      return r.status == _filter;
    }).toList();

    return Scaffold(
      backgroundColor: const Color(0xFF09090B),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20, color: Colors.white70),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('All Rooms', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: Colors.white70),
            onPressed: _fetchRooms,
          ),
        ],
      ),
      body: Column(
        children: [
          // Filter Tabs
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            color: const Color(0xFF09090B),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _buildFilterChip('ALL', 'All'),
                  const SizedBox(width: 8),
                  _buildFilterChip('WAITING', 'Waiting'),
                  const SizedBox(width: 8),
                  _buildFilterChip('IN_PROGRESS', 'Playing'),
                  const SizedBox(width: 8),
                  _buildFilterChip('COMPLETED', 'Finished'),
                ],
              ),
            ),
          ),

          // Rooms List
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: neonPurple))
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
                        color: neonPurple,
                        child: ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: filteredRooms.length,
                          separatorBuilder: (context, index) => const SizedBox(height: 12),
                          itemBuilder: (ctx, idx) {
                            final room = filteredRooms[idx];
                            return _buildRoomTile(room, cardBg, borderPurple);
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
      selectedColor: const Color(0xFF7C3AED),
      backgroundColor: const Color(0xFF14131B),
      side: BorderSide(color: isSelected ? const Color(0xFFA855F7) : const Color(0xFF2E2A44)),
      labelStyle: TextStyle(
        color: isSelected ? Colors.white : Colors.white70,
        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
        fontSize: 12,
      ),
      onSelected: (_) => setState(() => _filter = value),
    );
  }

  Widget _buildRoomTile(RoomModel room, Color cardBg, Color borderPurple) {
    final p1Name = room.player1?.name ?? 'Waiting...';
    final p2Name = room.player2?.name ?? 'Waiting...';

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
          color: cardBg,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: borderPurple),
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
                        color: Color(0xFFA855F7),
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
                      const CircleAvatar(radius: 5, backgroundColor: Color(0xFFEF4444)),
                      const SizedBox(width: 6),
                      Flexible(
                        child: Text(
                          p1Name,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: room.player1 != null ? Colors.white : Colors.white30,
                            fontSize: 13,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Row(
                    children: [
                      const CircleAvatar(radius: 5, backgroundColor: Color(0xFFF59E0B)),
                      const SizedBox(width: 6),
                      Flexible(
                        child: Text(
                          p2Name,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: room.player2 != null ? Colors.white : Colors.white30,
                            fontSize: 13,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right_rounded, color: Colors.white38, size: 20),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
