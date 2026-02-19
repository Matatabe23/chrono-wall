package ru.qugor.chronowall

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.app.WallpaperManager
import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.os.Build
import android.os.Environment
import android.os.IBinder
import androidx.core.app.ServiceCompat
import androidx.core.app.NotificationCompat
import java.io.File

/**
 * Фоновый сервис смены обоев по расписанию. Работает 24/7 при включённой коллекции,
 * даже когда приложение закрыто. Использует AlarmManager для следующей смены.
 */
class WallpaperRotationService : Service() {

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        // Вызываем startForeground() в onCreate(), чтобы система получила его до таймаута (onStartCommand может прийти с задержкой)
        startForeground(NOTIFICATION_ID, buildNotification())
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {

        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        if (!prefs.getBoolean(KEY_RUNNING, false)) {
            stopForegroundAndRemove()
            return START_NOT_STICKY
        }

        val sequenceStr = prefs.getString(KEY_SEQUENCE, null) ?: run {
            stopForegroundAndRemove()
            return START_NOT_STICKY
        }
        val paths = sequenceStr.split(SEQUENCE_DELIMITER).filter { it.isNotBlank() }
        if (paths.isEmpty()) {
            stopForegroundAndRemove()
            return START_NOT_STICKY
        }

        val scheduleOnly = intent?.getBooleanExtra(EXTRA_SCHEDULE_ONLY, false) == true
        if (scheduleOnly) {
            val intervalMinutes = prefs.getInt(KEY_INTERVAL_MINUTES, 15).coerceAtLeast(15)
            scheduleNextAlarm(this, prefs, intervalMinutes)
            stopForegroundAndRemove()
            return START_NOT_STICKY
        }

        val intervalMinutes = prefs.getInt(KEY_INTERVAL_MINUTES, 15).coerceAtLeast(15)
        val lastChangeAt = prefs.getLong(KEY_LAST_CHANGE_AT, 0L)
        val nextChangeAt = lastChangeAt + intervalMinutes * 60_000L
        val now = System.currentTimeMillis()
        // Если приложение недавно обновило обои (JS таймер), только перепланируем будильник
        if (now < nextChangeAt - 15_000) {
            scheduleNextAlarm(this, prefs, intervalMinutes)
            stopForegroundAndRemove()
            return START_NOT_STICKY
        }

        val target = prefs.getString(KEY_TARGET, "both") ?: "both"
        var rotationIndex = prefs.getInt(KEY_ROTATION_INDEX, 0)
        rotationIndex = (rotationIndex + 1) % paths.size
        val nextPath = paths[rotationIndex]

        val pictureDir = getPictureDir()
        if (pictureDir != null) {
            val fullPath = File(pictureDir, nextPath).absolutePath
            setWallpaperFromPath(fullPath, target)
        }

        prefs.edit()
            .putInt(KEY_ROTATION_INDEX, rotationIndex)
            .putLong(KEY_LAST_CHANGE_AT, System.currentTimeMillis())
            .apply()

        scheduleNextAlarm(this, prefs, intervalMinutes)
        stopForegroundAndRemove()
        return START_NOT_STICKY
    }

    private fun stopForegroundAndRemove() {
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun getPictureDir(): File? {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            getExternalFilesDir(Environment.DIRECTORY_PICTURES)
        } else {
            @Suppress("DEPRECATION")
            getExternalFilesDir(null)?.let { File(it, "Pictures") }
        }
    }

    private fun setWallpaperFromPath(path: String, target: String) {
        val bitmap = BitmapFactory.decodeFile(path) ?: return
        val wm = WallpaperManager.getInstance(this)
        val which = target.lowercase()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            when (which) {
                "home" -> wm.setBitmap(bitmap, null, false, WallpaperManager.FLAG_SYSTEM)
                "lock" -> wm.setBitmap(bitmap, null, false, WallpaperManager.FLAG_LOCK)
                else -> {
                    wm.setBitmap(bitmap, null, false, WallpaperManager.FLAG_SYSTEM)
                    wm.setBitmap(bitmap, null, false, WallpaperManager.FLAG_LOCK)
                }
            }
        } else {
            wm.setBitmap(bitmap)
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                getString(R.string.wallpaper_service_channel_name),
                NotificationManager.IMPORTANCE_LOW
            ).apply { setShowBadge(false) }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    private fun buildNotification() = NotificationCompat.Builder(this, CHANNEL_ID)
        .setContentTitle(getString(R.string.wallpaper_service_title))
        .setContentText(getString(R.string.wallpaper_service_text))
        .setSmallIcon(android.R.drawable.ic_menu_gallery)
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .setOngoing(false)
        .build()

    companion object {
        private const val PREFS_NAME = "chrono_wall_rotation"
        const val KEY_RUNNING = "running"
        const val KEY_INTERVAL_MINUTES = "interval_minutes"
        const val KEY_TARGET = "target"
        const val KEY_ROTATION_INDEX = "rotation_index"
        const val KEY_LAST_CHANGE_AT = "last_change_at"
        const val KEY_SEQUENCE = "sequence"
        const val SEQUENCE_DELIMITER = "\u0000"
        const val EXTRA_SCHEDULE_ONLY = "schedule_only"
        private const val CHANNEL_ID = "wallpaper_rotation"
        private const val NOTIFICATION_ID = 1
        private const val REQUEST_CODE_NEXT = 2

        fun scheduleNextAlarm(context: Context, prefs: android.content.SharedPreferences, intervalMinutes: Int) {
            val lastChange = prefs.getLong(KEY_LAST_CHANGE_AT, 0L)
            val nextAt = lastChange + intervalMinutes * 60_000L
            val alarmMgr = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val intent = Intent(context, WallpaperRotationService::class.java)
            val pending = PendingIntent.getService(
                context,
                REQUEST_CODE_NEXT,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            val triggerAt = maxOf(System.currentTimeMillis() + 60_000, nextAt)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (alarmMgr.canScheduleExactAlarms()) {
                    alarmMgr.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pending)
                } else {
                    alarmMgr.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pending)
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmMgr.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pending)
            } else {
                alarmMgr.set(AlarmManager.RTC_WAKEUP, triggerAt, pending)
            }
        }
    }
}
