package com.recruit.minigenius;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import org.apache.cordova.CordovaPlugin;
import org.apache.cordova.CallbackContext;
import org.json.JSONArray;
import org.json.JSONException;

public class MGNotification extends CordovaPlugin {
    
    private static final String CHANNEL_ID = "mg_calendar";
    private static final int NOTIFICATION_ID = 999;

    @Override
    public boolean execute(String action, JSONArray args, CallbackContext callbackContext) throws JSONException {
        if ("show".equals(action)) {
            String title = args.getString(0);
            String text = args.getString(1);
            this.showNotification(title, text, callbackContext);
            return true;
        } else if ("clear".equals(action)) {
            this.clearNotification(callbackContext);
            return true;
        }
        return false;
    }

    private void showNotification(String title, String text, CallbackContext callbackContext) {
        try {
            Context context = cordova.getActivity().getApplicationContext();
            
            // Create notification channel (Android 8+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Mini Genius Calendar",
                    NotificationManager.IMPORTANCE_LOW // No sound, visible on lock screen
                );
                channel.setDescription("Today's calendar appointments");
                channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
                channel.setShowBadge(true);
                
                NotificationManager nm = context.getSystemService(NotificationManager.class);
                if (nm != null) {
                    nm.createNotificationChannel(channel);
                }
            }

            // Intent to open app when notification is tapped
            Intent intent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
            if (intent == null) {
                intent = new Intent();
            }
            intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent pendingIntent = PendingIntent.getActivity(context, 0, intent, flags);

            // Build notification with InboxStyle for multiple lines
            NotificationCompat.InboxStyle inboxStyle = new NotificationCompat.InboxStyle();
            String[] lines = text.split("\n");
            for (String line : lines) {
                if (!line.trim().isEmpty()) {
                    inboxStyle.addLine(line.trim());
                }
            }
            inboxStyle.setSummaryText("Mini Genius");

            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_menu_my_calendar)
                .setContentTitle(title)
                .setContentText(lines.length > 0 ? lines[0] : text)
                .setStyle(inboxStyle)
                .setOngoing(true)              // Can't be swiped away
                .setAutoCancel(false)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC) // Show on lock screen
                .setContentIntent(pendingIntent)
                .setCategory(NotificationCompat.CATEGORY_EVENT);

            NotificationManagerCompat notificationManager = NotificationManagerCompat.from(context);
            notificationManager.notify(NOTIFICATION_ID, builder.build());
            
            callbackContext.success("Notification shown");
        } catch (Exception e) {
            callbackContext.error("Error: " + e.getMessage());
        }
    }

    private void clearNotification(CallbackContext callbackContext) {
        try {
            Context context = cordova.getActivity().getApplicationContext();
            NotificationManagerCompat nm = NotificationManagerCompat.from(context);
            nm.cancel(NOTIFICATION_ID);
            callbackContext.success("Notification cleared");
        } catch (Exception e) {
            callbackContext.error("Error: " + e.getMessage());
        }
    }
}
