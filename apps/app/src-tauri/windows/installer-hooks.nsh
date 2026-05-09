!macro NSIS_HOOK_POSTUNINSTALL
  ; Always remove disposable runtime state on uninstall.
  RMDir /r "$APPDATA\com.locoris.desktop\webview"
  RMDir /r "$LOCALAPPDATA\com.locoris.desktop\webview"
  RMDir /r "$APPDATA\com.locoris.desktop\cache"
  RMDir /r "$LOCALAPPDATA\com.locoris.desktop\cache"
  RMDir /r "$APPDATA\com.locoris.desktop\logs"
  RMDir /r "$LOCALAPPDATA\com.locoris.desktop\logs"
!macroend
