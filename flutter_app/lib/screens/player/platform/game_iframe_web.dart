// ignore_for_file: avoid_web_libraries_in_flutter
import 'dart:html' as html;
import 'dart:ui_web' as ui_web;

void registerGameIFrame(String viewTypeId, String url) {
  ui_web.platformViewRegistry.registerViewFactory(
    viewTypeId,
    (int viewId) {
      final iframe = html.IFrameElement()
        ..src = url
        ..style.border = 'none'
        ..style.width = '100%'
        ..style.height = '100%';
      return iframe;
    },
  );
}
