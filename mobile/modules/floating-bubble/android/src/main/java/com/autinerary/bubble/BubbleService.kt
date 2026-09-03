package com.autinerary.bubble

import android.app.Service
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Build
import android.os.IBinder
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView
import kotlin.math.abs

/**
 * The floating mascot itself: a small always-on-top view the user can drag
 * anywhere on screen, and tap to jump back into the app.
 *
 * TYPE_APPLICATION_OVERLAY is required from Android 8 onward; the older
 * TYPE_PHONE is refused. Both are kept so the service still works on 7.x.
 */
class BubbleService : Service() {

    private var windowManager: WindowManager? = null
    private var bubble: View? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (bubble != null) return START_STICKY
        val label = intent?.getStringExtra(EXTRA_LABEL) ?: "Autinerary"
        show(label)
        return START_STICKY
    }

    private fun show(label: String) {
        val wm = getSystemService(WINDOW_SERVICE) as WindowManager
        windowManager = wm

        val view = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.parseColor("#F5FFFFFF"))
            setPadding(24, 20, 24, 20)
            addView(TextView(this@BubbleService).apply {
                text = "🐢"
                textSize = 26f
            })
            addView(TextView(this@BubbleService).apply {
                // The task, truncated. The point of the bubble is that you can
                // see what you are meant to be doing without opening anything.
                text = if (label.length > 24) label.take(24) + "…" else label
                textSize = 10f
                setTextColor(Color.parseColor("#1E293B"))
            })
        }

        val type =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            else
                @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            type,
            // NOT_FOCUSABLE keeps the keyboard and touches working in whatever
            // app is underneath — without it the bubble would swallow input.
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = 24
            y = 240
        }

        var downX = 0f
        var downY = 0f
        var startX = 0
        var startY = 0

        view.setOnTouchListener { _, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    downX = event.rawX; downY = event.rawY
                    startX = params.x; startY = params.y
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    params.x = startX + (event.rawX - downX).toInt()
                    params.y = startY + (event.rawY - downY).toInt()
                    wm.updateViewLayout(view, params)
                    true
                }
                MotionEvent.ACTION_UP -> {
                    // Distinguish a tap from a drag, or every drag would also
                    // launch the app on release.
                    val moved = abs(event.rawX - downX) > 12 || abs(event.rawY - downY) > 12
                    if (!moved) openApp()
                    true
                }
                else -> false
            }
        }

        wm.addView(view, params)
        bubble = view
    }

    private fun openApp() {
        val launch = packageManager.getLaunchIntentForPackage(packageName)
        launch?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        launch?.let { startActivity(it) }
    }

    override fun onDestroy() {
        super.onDestroy()
        bubble?.let { windowManager?.removeView(it) }
        bubble = null
    }

    companion object {
        const val EXTRA_LABEL = "label"
    }
}
