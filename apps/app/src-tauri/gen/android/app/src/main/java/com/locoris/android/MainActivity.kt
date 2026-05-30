package com.locoris.android

import android.content.Intent
import android.os.Bundle
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }

  @Deprecated("Deprecated by Android, but still required as a compatibility bridge for Tauri Android OAuth results.")
  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    if (LocorisAndroidPlugin.handleGoogleDriveAuthorizationActivityResult(requestCode, resultCode, data)) {
      return
    }

    super.onActivityResult(requestCode, resultCode, data)
  }
}
