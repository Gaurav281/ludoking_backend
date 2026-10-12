import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../../config/api_config.dart';
import '../../services/session_service.dart';
import '../../services/api_service.dart';
import 'platform/game_iframe_helper.dart';

class GameWebViewScreen extends StatefulWidget {
  final String roomCode;
  final String playerId;
  final String sessionToken;
  final String color;

  const GameWebViewScreen({
    super.key,
    required this.roomCode,
    required this.playerId,
    required this.sessionToken,
    required this.color,
  });

  @override
  State<GameWebViewScreen> createState() => _GameWebViewScreenState();
}

class _GameWebViewScreenState extends State<GameWebViewScreen> {
  WebViewController? _mobileController;
  bool _isLoading = true;
  late final String _gameUrl;
  final String _viewTypeId = 'phaser-game-view-${DateTime.now().millisecondsSinceEpoch}';

  @override
  void initState() {
    super.initState();
    _gameUrl = ApiConfig.getGameUrl(
      roomCode: widget.roomCode,
      playerId: widget.playerId,
      sessionToken: widget.sessionToken,
      color: widget.color,
    );

    if (kIsWeb) {
      // Register iframe for Flutter Web
      registerGameIFrame(_viewTypeId, _gameUrl);
      setState(() => _isLoading = false);
    } else {
      // Mobile WebView Flutter
      _initMobileWebView();
    }
  }

  void _initMobileWebView() {
    final controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFF0F172A))
      ..addJavaScriptChannel(
        'FlutterGameBridge',
        onMessageReceived: (JavaScriptMessage msg) {
          _handleGameMessage(msg.message);
        },
      )
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (String url) {
            setState(() => _isLoading = true);
          },
          onPageFinished: (String url) {
            setState(() => _isLoading = false);
          },
          onWebResourceError: (WebResourceError error) {
            debugPrint('WebView error: ${error.description}');
          },
        ),
      )
      ..loadRequest(Uri.parse(_gameUrl));

    _mobileController = controller;
  }

  void _handleGameMessage(String rawJson) {
    try {
      final data = jsonDecode(rawJson);
      final type = data['type'];
      if (type == 'MATCH_COMPLETED') {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: Color(0xFF10B981),
            content: Text('Match finished and verified! Results recorded.'),
          ),
        );
      } else if (type == 'EXIT_MATCH' || type == 'RETURN_LOBBY') {
        Navigator.pop(context);
      }
    } catch (_) {}
  }

  Future<void> _handleExit() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        title: const Text('Exit Match?', style: TextStyle(color: Colors.white)),
        content: const Text(
          'Leaving an active match will forfeit the game to your opponent.',
          style: TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Keep Playing', style: TextStyle(color: Colors.white60)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEF4444)),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Exit & Forfeit', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirm == true && mounted) {
      await ApiService.leaveRoom(
        code: widget.roomCode,
        playerId: widget.playerId,
        sessionToken: widget.sessionToken,
      );
      await SessionService.clearPlayerSession();
      if (mounted) Navigator.pop(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    final themeColor = widget.color.toLowerCase() == 'red' ? const Color(0xFFEF4444) : const Color(0xFFEAB308);

    return WillPopScope(
      onWillPop: () async {
        await _handleExit();
        return false;
      },
      child: Scaffold(
        backgroundColor: const Color(0xFF0F172A),
        appBar: AppBar(
          backgroundColor: const Color(0xFF0F172A),
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
            onPressed: _handleExit,
            tooltip: 'Leave Match',
          ),
          title: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(color: themeColor, shape: BoxShape.circle),
              ),
              const SizedBox(width: 8),
              Text(
                'Room ${widget.roomCode}',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
              ),
            ],
          ),
          centerTitle: true,
          actions: [
            IconButton(
              icon: const Icon(Icons.refresh_rounded),
              onPressed: () {
                if (kIsWeb) {
                  setState(() {});
                } else {
                  _mobileController?.reload();
                }
              },
              tooltip: 'Reload Game',
            ),
          ],
        ),
        body: Stack(
          children: [
            if (kIsWeb)
              HtmlElementView(viewType: _viewTypeId)
            else if (_mobileController != null)
              WebViewWidget(controller: _mobileController!)
            else
              const Center(
                child: Text('WebView not supported on this platform', style: TextStyle(color: Colors.white70)),
              ),
            if (_isLoading)
              Container(
                color: const Color(0xFF0F172A),
                child: const Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      CircularProgressIndicator(color: Color(0xFF6366F1)),
                      SizedBox(height: 16),
                      Text(
                        'Connecting to Ludo Arena...',
                        style: TextStyle(color: Colors.white70, fontSize: 14),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
