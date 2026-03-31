# Mini Genius HR v2.4 — 10 תיקונים

## 🚀 הוראות התקנה (3 צעדים)

### צעד 1: העלאה ל-GitHub
```bash
# פתח טרמינל בתיקייה שחילצת מהזיפ
cd mini-genius-v24

# אתחל Git ודחוף
git init
git remote add origin https://github.com/alonharazi3-web/hr-app.git
git add -A
git commit -m "v2.4"
git branch -M main
git push -f origin main
```

### צעד 2: המתן ל-APK
- לך ל: https://github.com/alonharazi3-web/hr-app/actions
- תראה build רץ אוטומטית (1-3 דקות)
- כשסיים (✅ ירוק) — לחץ על הבילד → **Artifacts** → הורד `app-debug.apk`

### צעד 3: התקן על הטלפון
- העבר APK לטלפון (WhatsApp / Drive / כבל)
- פתח → "התקן מגורם לא מוכר" → אשר
- פתח את Mini Genius 🎉

---

## 📋 מה תוקן (10 באגים)

| # | בעיה | פתרון |
|---|------|-------|
| 1 | API תמלול חינמי | **AssemblyAI** — $50 קרדיט חינם (~100 שעות עברית) |
| 2 | תזכורות לא נפתחות | Calendar URL במקום extras (תיקון Double→Long crash) |
| 3 | WhatsApp קופא את האפליקציה | הסרת `window.open` + שאלת אישור לפני שליחה |
| 4 | אובדן מידע בקריסה | שמירה תוך 500ms + שמירה אוטומטית כשיוצאים מהאפליקציה |
| 5 | ייצוא שאלון כ-DOCX | כפתור "ייצוא .doc" חדש — נפתח ב-Word |
| 6 | תוכן מוסתר ע"י status bar | Safe area דינמי שמתאים לכל מכשיר |
| 7 | שמירה לאנשי קשר לא ממלאת | Extras תקינים + VCF fallback |
| 8 | סריקת הקלטות לא מוצאת קבצים | נתיב ראשי `/Call/` + תמיכה בעברית בשם |
| 9 | שרת Whisper נעלם מההגדרות | שוחזר + AssemblyAI כאופציה עם בורר שירות |
| 10 | סולם ציונים 1-10 | תוקן ל-**1-7** בכל מקום |

---

## ⚙️ הגדרת AssemblyAI (חד-פעמי)

1. הרשם ב-**assemblyai.com** (חינם)
2. העתק את ה-API Key
3. באפליקציה: **⚙️ דף ניהול** → **הגדרות תמלול**
4. בחר "AssemblyAI (חינם)" → הדבק Key → שמור
5. עכשיו כפתור "תמלל" עובד אוטומטית 🎙️

---

## 📁 קבצים ששונו

```
www/js/utils.js    ← WhatsApp, אנשי קשר, תזכורות, DOCX
www/js/app.js      ← שמירה מיידית + pause/visibility
www/js/stages.js   ← ציון 1-7, אישור WhatsApp
www/js/stage2.js   ← סריקת הקלטות, AssemblyAI, DOCX
www/js/admin.js    ← הגדרות תמלול
www/css/app.css    ← Safe area (env() לכל המכשירים)
```
