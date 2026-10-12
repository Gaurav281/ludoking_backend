class PlayerSlot {
  final String id;
  final String name;
  final String color;
  final int? joinedAt;

  PlayerSlot({
    required this.id,
    required this.name,
    required this.color,
    this.joinedAt,
  });

  factory PlayerSlot.fromJson(Map<String, dynamic> json, String defaultColor) {
    return PlayerSlot(
      id: json['id'] ?? '',
      name: json['name'] ?? 'Player',
      color: json['color'] ?? defaultColor,
      joinedAt: json['joinedAt'] as int?,
    );
  }
}

class RoomModel {
  final String id;
  final String code;
  final String status; // WAITING, IN_PROGRESS, COMPLETED, CANCELLED
  final PlayerSlot? player1;
  final PlayerSlot? player2;
  final String? winnerId;
  final String? winnerName;
  final String? winnerColor;
  final int createdAt;
  final int? startedAt;
  final int? completedAt;

  RoomModel({
    required this.id,
    required this.code,
    required this.status,
    this.player1,
    this.player2,
    this.winnerId,
    this.winnerName,
    this.winnerColor,
    required this.createdAt,
    this.startedAt,
    this.completedAt,
  });

  bool get isFull => player1 != null && player2 != null;
  bool get isWaiting => status == 'WAITING';
  bool get isInProgress => status == 'IN_PROGRESS';
  bool get isCompleted => status == 'COMPLETED';

  factory RoomModel.fromJson(Map<String, dynamic> json) {
    return RoomModel(
      id: json['id'] ?? '',
      code: json['code'] ?? '',
      status: json['status'] ?? 'WAITING',
      player1: json['player1'] != null
          ? PlayerSlot.fromJson(Map<String, dynamic>.from(json['player1']), 'red')
          : null,
      player2: json['player2'] != null
          ? PlayerSlot.fromJson(Map<String, dynamic>.from(json['player2']), 'yellow')
          : null,
      winnerId: json['winnerId'] as String?,
      winnerName: json['winnerName'] as String?,
      winnerColor: json['winnerColor'] as String?,
      createdAt: json['createdAt'] is int ? json['createdAt'] : 0,
      startedAt: json['startedAt'] as int?,
      completedAt: json['completedAt'] as int?,
    );
  }
}

class DashboardStats {
  final int total;
  final int waiting;
  final int inProgress;
  final int completed;
  final int cancelled;

  DashboardStats({
    required this.total,
    required this.waiting,
    required this.inProgress,
    required this.completed,
    required this.cancelled,
  });

  factory DashboardStats.fromJson(Map<String, dynamic> json) {
    return DashboardStats(
      total: json['total'] ?? 0,
      waiting: json['waiting'] ?? 0,
      inProgress: json['inProgress'] ?? 0,
      completed: json['completed'] ?? 0,
      cancelled: json['cancelled'] ?? 0,
    );
  }

  factory DashboardStats.empty() {
    return DashboardStats(total: 0, waiting: 0, inProgress: 0, completed: 0, cancelled: 0);
  }
}

class VerifiedResult {
  final String roomCode;
  final String roomId;
  final String player1;
  final String player2;
  final String winner;
  final String winnerColor;
  final String? winnerId;
  final String status;
  final int? createdAt;
  final int? startedAt;
  final int? completedAt;
  final int? durationSeconds;

  VerifiedResult({
    required this.roomCode,
    required this.roomId,
    required this.player1,
    required this.player2,
    required this.winner,
    required this.winnerColor,
    this.winnerId,
    required this.status,
    this.createdAt,
    this.startedAt,
    this.completedAt,
    this.durationSeconds,
  });

  factory VerifiedResult.fromJson(Map<String, dynamic> json) {
    return VerifiedResult(
      roomCode: json['roomCode'] ?? '',
      roomId: json['roomId'] ?? '',
      player1: json['player1'] ?? 'Player 1',
      player2: json['player2'] ?? 'Player 2',
      winner: json['winner'] ?? 'Unknown',
      winnerColor: json['winnerColor'] ?? 'red',
      winnerId: json['winnerId'] as String?,
      status: json['status'] ?? 'COMPLETED',
      createdAt: json['createdAt'] as int?,
      startedAt: json['startedAt'] as int?,
      completedAt: json['completedAt'] as int?,
      durationSeconds: json['durationSeconds'] as int?,
    );
  }
}
