package com.autinerary.bubble

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Bridge for the floating mascot, on the Expo Modules API so it autolinks
 * with the rest of the app rather than needing manual registration.
 *
 * Overlay permission is not a normal runtime permission — no dialog can grant
 * it. The user has to toggle it in system settings, so the flow is: check,
 * send them there, let them come back and try again.
 */
class FloatingBubbleModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("FloatingBubble")

    AsyncFunction("hasOverlayPermission") {
      val ctx = appContext.reactContext ?: return@AsyncFunction false
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) Settings.canDrawOverlays(ctx) else true
    }

    AsyncFunction("requestOverlayPermission") {
      val ctx = appContext.reactContext ?: return@AsyncFunction
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return@AsyncFunction
      val intent = Intent(
        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
        Uri.parse("package:${ctx.packageName}")
      ).apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) }
      ctx.startActivity(intent)
    }

    AsyncFunction("start") { label: String ->
      val ctx = appContext.reactContext ?: return@AsyncFunction
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(ctx)) {
        throw IllegalStateException("Overlay permission has not been granted.")
      }
      ctx.startService(
        Intent(ctx, BubbleService::class.java).putExtra(BubbleService.EXTRA_LABEL, label)
      )
    }

    AsyncFunction("stop") {
      val ctx = appContext.reactContext ?: return@AsyncFunction
      ctx.stopService(Intent(ctx, BubbleService::class.java))
    }
  }
}
