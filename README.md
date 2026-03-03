# Mini Genius — HR Recruitment App

## Quick Deploy (Termux)

```bash
# Install requirements
pkg update && pkg install nodejs git openjdk-17

# Clone and build
git clone https://github.com/YOUR_REPO/mini-genius.git
cd mini-genius
npm install
npm install -g cordova
cordova platform add android
cordova build android

# APK location
ls platforms/android/app/build/outputs/apk/debug/app-debug.apk
```

## GitHub Deployment

1. Create repo on GitHub
2. Push code:
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_REPO/mini-genius.git
git push -u origin main
```
3. GitHub Actions will auto-build APK
4. Download from Actions > Artifacts

## Structure
- `www/` — App source (HTML/CSS/JS)
- `www/js/db.js` — IndexedDB storage
- `www/js/app.js` — Main controller
- `www/js/stages.js` — Shared stage logic
- `www/js/stage1.js` — Leads
- `www/js/stage2.js` — Phone interview + questionnaire
- `www/js/stage3.js` — Home exam
- `www/js/dashboard.js` — Dashboard + export
- `www/js/tasks.js` — Task management
- `www/js/daysummary.js` — Day summary + close day
- `www/js/admin.js` — Admin settings
- `config.xml` — Cordova config
