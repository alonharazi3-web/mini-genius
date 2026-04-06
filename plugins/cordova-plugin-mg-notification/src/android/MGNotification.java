package com.recruit.minigenius;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.os.Build;

import org.apache.cordova.CordovaPlugin;
import org.apache.cordova.CallbackContext;
import org.json.JSONArray;
import org.json.JSONException;

public class MGNotification extends CordovaPlugin {

    private static final String CHANNEL_ID = "mg_calendar";
    private static final int NOTIFICATION_ID = 999;
    private static final String GROUP_KEY = "mg_today";
    private static final int PERMISSION_REQUEST_CODE = 100;
    private CallbackContext permissionCallback;

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
        } else if ("requestPermission".equals(action)) {
            this.requestNotificationPermission(callbackContext);
            return true;
        }
        return false;
    }

    private void requestNotificationPermission(CallbackContext callbackContext) {
        if (Build.VERSION.SDK_INT >= 33) {
            if (cordova.getActivity().checkSelfPermission("android.permission.POST_NOTIFICATIONS")
                    != PackageManager.PERMISSION_GRANTED) {
                permissionCallback = callbackContext;
                cordova.requestPermission(this, PERMISSION_REQUEST_CODE, "android.permission.POST_NOTIFICATIONS");
                return;
            }
        }
        callbackContext.success("granted");
    }

    @Override
    public void onRequestPermissionResult(int requestCode, String[] permissions, int[] grantResults) {
        if (requestCode == PERMISSION_REQUEST_CODE && permissionCallback != null) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                permissionCallback.success("granted");
            } else {
                permissionCallback.error("denied");
            }
            permissionCallback = null;
        }
    }

    private void showNotification(String title, String text, CallbackContext callbackContext) {
        try {
            Context context = cordova.getActivity().getApplicationContext();
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) {
                callbackContext.error("NotificationManager not available");
                return;
            }

            if (Build.VERSION.SDK_INT >= 33) {
                if (cordova.getActivity().checkSelfPermission("android.permission.POST_NOTIFICATIONS")
                        != PackageManager.PERMISSION_GRANTED) {
                    callbackContext.error("Permission not granted");
                    return;
                }
            }

            // Channel: IMPORTANCE_HIGH forces expanded on lock screen
            // Sound + vibration disabled to keep it silent
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Mini Genius - לוז יומי",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Today's calendar appointments");
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            channel.setShowBadge(true);
            channel.enableVibration(false);
            channel.setVibrationPattern(null);
            channel.setSound(null, null);
            nm.createNotificationChannel(channel);

            // Intent to open app
            Intent intent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
            if (intent == null) intent = new Intent();
            intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent pendingIntent = PendingIntent.getActivity(context, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

            // Build expanded InboxStyle
            String[] lines = text.split("\n");
            Notification.InboxStyle inboxStyle = new Notification.InboxStyle();
            inboxStyle.setBigContentTitle(title);
            for (String line : lines) {
                if (!line.trim().isEmpty()) inboxStyle.addLine(line.trim());
            }
            inboxStyle.setSummaryText(lines.length + " אירועים");

            Notification notification = new Notification.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_menu_my_calendar)
                .setContentTitle(title)
                .setContentText(lines.length > 0 ? lines[0] : text)
                .setStyle(inboxStyle)
                .setOngoing(true)
                .setAutoCancel(false)
                .setOnlyAlertOnce(true)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setContentIntent(pendingIntent)
                .setCategory(Notification.CATEGORY_EVENT)
                .setGroup(GROUP_KEY)
                .setGroupSummary(true)
                .setNumber(lines.length)
                .build();

            // Force persistence flags
            notification.flags |= Notification.FLAG_ONGOING_EVENT | Notification.FLAG_NO_CLEAR;
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
