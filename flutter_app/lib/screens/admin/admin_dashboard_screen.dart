import 'dart:async';
import 'package:flutter/material.dart';
import '../../models/room_model.dart';
import '../../services/api_service.dart';
import '../../services/session_service.dart';
import '../../widgets/settings_dialog.dart';
import 'admin_lobby_screen.dart';
import 'admin_rooms_screen.dart';
import 'admin_results_screen.dart';
import 'admin_login_screen.dart';

class AdminDashboardScreen extends StatefulWidget {
  const AdminDashboardScreen({super.key});

  @override
  State<AdminDashboardScreen> createState() => _AdminDashboardScreenState();
}

class _AdminDashboardScreenState extends State<AdminDashboardScreen> {
  DashboardStats _stats = DashboardStats.empty();
  bool _isLoading = true;
  bool _isCreatingRoom = false;
  Timer? _pollingTimer;

  @override
  void initState() {
    super.initState();
    _fetchStats();
    // Poll admin dashboard every 3 seconds
    _pollingTimer = Timer.periodic(const Duration(seconds: 3), (_) {
      if (mounted) _fetchStats(silent: true);
    });
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    super.dispose();
  }

  Future<void> _fetchStats({bool silent = false}) async {
    if (!silent) setState(() => _isLoading = true);
    try {
      final res = await ApiService.getAdminRooms();
      if (res['success'] == true && mounted) {
        setState(() {
          _stats = res['stats'] as DashboardStats;
        });
      }
    } catch (_) {
      // Silently ignore transient network glitches during polling
    } finally {
      if (mounted && !silent) setState(() => _isLoading = false);
    }
  }

  Future<void> _handleCreateRoom() async {
    if (_isCreatingRoom) return; // Prevent duplicate rapid taps

    setState(() => _isCreatingRoom = true);
    try {
      final res = await ApiService.createRoom();
      if (res['success'] == true && mounted) {
        final room = res['room'] as RoomModel;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: const Color(0xFF10B981),
            content: Text('Room ${room.code} created for free!'),
          ),
        );
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => AdminLobbyScreen(roomCode: room.code),
          ),
        );
      } else if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: const Color(0xFFEF4444),
            content: Text(res['error'] ?? 'Room creation failed'),
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
      if (mounted) setState(() => _isCreatingRoom = false);
    }
  }

  Future<void> _handleLogout() async {
    await SessionService.clearAdminToken();
    if (mounted) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const AdminLoginScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B),
        elevation: 0,
        title: const Text(
          'Admin Dashboard',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => _fetchStats(),
            tooltip: 'Refresh',
          ),
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            onPressed: () => SettingsDialog.show(context),
            tooltip: 'Settings',
          ),
          IconButton(
            icon: const Icon(Icons.logout_rounded),
            onPressed: _handleLogout,
            tooltip: 'Logout',
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF6366F1)))
          : RefreshIndicator(
              onRefresh: () => _fetchStats(),
              color: const Color(0xFF6366F1),
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Free Room Creation Promo Card
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF4F46E5), Color(0xFF7C3AED)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(18),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF6366F1).withOpacity(0.3),
                            blurRadius: 15,
                            offset: const Offset(0, 6),
                          )
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: Colors.white.withOpacity(0.2),
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: const Text(
                                  '100% FREE • NO COINS',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          const Text(
                            'Host Ludo Tournament',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 22,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 6),
                          const Text(
                            'Create a room, share the 6-character room code with 2 players, and get automatically verified results without screenshots.',
                            style: TextStyle(color: Colors.white70, fontSize: 13, height: 1.4),
                          ),
                          const SizedBox(height: 18),
                          ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.white,
                              foregroundColor: const Color(0xFF4F46E5),
                              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              elevation: 2,
                            ),
                            onPressed: _isCreatingRoom ? null : _handleCreateRoom,
                            icon: _isCreatingRoom
                                ? const SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: Color(0xFF4F46E5),
                                    ),
                                  )
                                : const Icon(Icons.add_circle_outline_rounded, size: 22),
                            label: Text(
                              _isCreatingRoom ? 'Generating Room...' : 'Create Room',
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Stats Grid
                    const Text(
                      'Match Overview',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 12),
                    GridView.count(
                      crossAxisCount: 2,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      crossAxisSpacing: 14,
                      mainAxisSpacing: 14,
                      childAspectRatio: 1.5,
                      children: [
                        _buildStatCard(
                          title: 'Total Rooms',
                          value: '${_stats.total}',
                          icon: Icons.meeting_room_outlined,
                          color: const Color(0xFF6366F1),
                        ),
                        _buildStatCard(
                          title: 'Waiting Rooms',
                          value: '${_stats.waiting}',
                          icon: Icons.hourglass_top_rounded,
                          color: const Color(0xFFF59E0B),
                        ),
                        _buildStatCard(
                          title: 'Active Matches',
                          value: '${_stats.inProgress}',
                          icon: Icons.play_circle_outline_rounded,
                          color: const Color(0xFF38BDF8),
                        ),
                        _buildStatCard(
                          title: 'Completed',
                          value: '${_stats.completed}',
                          icon: Icons.check_circle_outline_rounded,
                          color: const Color(0xFF10B981),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),

                    // Quick Navigation Links
                    const Text(
                      'Management',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 12),
                    ListTile(
                      tileColor: const Color(0xFF1E293B),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                        side: const BorderSide(color: Color(0xFF334155)),
                      ),
                      leading: const CircleAvatar(
                        backgroundColor: Color(0xFF312E81),
                        child: Icon(Icons.history_rounded, color: Color(0xFF818CF8)),
                      ),
                      title: const Text(
                        'All Rooms History',
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                      ),
                      subtitle: const Text(
                        'Inspect active, waiting, and historical rooms',
                        style: TextStyle(color: Colors.white60, fontSize: 12),
                      ),
                      trailing: const Icon(Icons.chevron_right_rounded, color: Colors.white54),
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const AdminRoomsScreen()),
                        );
                      },
                    ),
                    const SizedBox(height: 12),
                    ListTile(
                      tileColor: const Color(0xFF1E293B),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                        side: const BorderSide(color: Color(0xFF334155)),
                      ),
                      leading: const CircleAvatar(
                        backgroundColor: Color(0xFF064E3B),
                        child: Icon(Icons.verified_rounded, color: Color(0xFF34D399)),
                      ),
                      title: const Text(
                        'Verified Results Dashboard',
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                      ),
                      subtitle: const Text(
                        'Automatic winner verification without screenshots',
                        style: TextStyle(color: Colors.white60, fontSize: 12),
                      ),
                      trailing: const Icon(Icons.chevron_right_rounded, color: Colors.white54),
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const AdminResultsScreen()),
                        );
                      },
                    ),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildStatCard({
    required String title,
    required String value,
    required IconData icon,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF334155), width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title,
                style: const TextStyle(color: Colors.white60, fontSize: 12, fontWeight: FontWeight.w500),
              ),
              Icon(icon, color: color, size: 20),
            ],
          ),
          Text(
            value,
            style: TextStyle(
              color: Colors.white,
              fontSize: 26,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}
