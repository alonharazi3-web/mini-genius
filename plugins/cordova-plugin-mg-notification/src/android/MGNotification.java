package com.recruit.minigenius;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;

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
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) {
                callbackContext.error("NotificationManager not available");
                return;
            }

            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Mini Genius Calendar",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Today's calendar appointments");
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            channel.setShowBadge(true);
            nm.createNotificationChannel(channel);

            Intent intent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
            if (intent == null) intent = new Intent();
            intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent pendingIntent = PendingIntent.getActivity(context, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

            Notification.InboxStyle inboxStyle = new Notification.InboxStyle();
            String[] lines = text.split("\n");
            for (String line : lines) {
                if (!line.trim().isEmpty()) inboxStyle.addLine(line.trim());
            }
            inboxStyle.setSummaryText("Mini Genius");

            Notification notification = new Notification.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_menu_my_calendar)
                .setContentTitle(title)
                .setContentText(lines.length > 0 ? lines[0] : text)
                .setStyle(inboxStyle)
                .setOngoing(true)
                .setAutoCancel(false)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setContentIntent(pendingIntent)
                .setCategory(Notification.CATEGORY_EVENT)
                .build();

            nm.notify(NOTIFICATION_ID, notification);
            callbackContext.success("OK");
        } catch (Exception e) {
            callbackContext.error("Error: " + e.getMessage());
        }
    }

    private void clearNotification(CallbackContext callbackContext) {
        try {
            Context context = cordova.getActivity().getApplicationContext();
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.cancel(NOTIFICATION_ID);
            callbackContext.success("OK");
        } catch (Exception e) {
            callbackContext.error("Error: " + e.getMessage());
        }
    }
}
