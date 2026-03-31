'use strict';
// Mini Genius — Electron Desktop Polyfill v3.4
// Replaces cordova.js. Handles:
//   1. deviceready event
//   2. Native OAuth popup (no paste-token dance)
//   3. Auto-reauth when token expires — stays "logged in"
//   4. WhatsApp Web (web.whatsapp.com) instead of whatsapp:// protocol
//   5. window.close() for exit
//   6. File exports via blob <a download>

(function () {

  // Stub cordova — file=null triggers blob-download fallbacks in utils.js
  window.cordova = { file: null, InAppBrowser: null };

  // Stub socialsharing — used by utils.js shareViaPlugin
  window.plugins = window.plugins || {};
  window.plugins.socialsharing = {
    shareWithOptions: function (opts, success) {
      // On desktop: copy message to clipboard if no files
      if (opts && opts.message && (!opts.files || !opts.files.length)) {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(opts.message).catch(function () {});
        }
      }
      if (success) success();
    },
    shareViaWhatsApp: function (msg) {
      _openWhatsAppWeb(null, msg);
    },
    shareViaWhatsAppToReceiver: function (phone, msg) {
      _openWhatsAppWeb(phone, msg);
    }
  };
  window.plugins.intentShim = null;

  // Helper: open WhatsApp Web in system browser
  function _openWhatsAppWeb(phone, msg) {
    var clean = (phone || '').replace(/\D/g, '');
    var intl = clean.startsWith('0') ? '972' + clean.substring(1) : clean;
    var url = intl
      ? 'https://web.whatsapp.com/send?phone=' + intl + '&text=' + encodeURIComponent(msg || '')
      : 'https://web.whatsapp.com/send?text=' + encodeURIComponent(msg || '');
    window.open(url, '_blank');
  }

  // Fire deviceready after all scripts load
  window.addEventListener('load', function () {
    document.dispatchEvent(new Event('deviceready'));

    // ===== Override WhatsApp to use WhatsApp Web =====
    if (window.Utils) {
      Utils.openWhatsApp = async function (phone, msg) {
        try { await App.flushDirty(); } catch (e) {}
        var clean = (phone || '').replace(/\D/g, '');
        var intl = clean.startsWith('0') ? '972' + clean.substring(1) : clean;
        _dbg('openWhatsApp (desktop web): ' + intl);
        _openWhatsAppWeb(intl, msg);
      };
      Utils.shareWhatsApp = function (msg) {
        _openWhatsAppWeb(null, msg);
      };
    }

    // ===== Override Sync.signIn — use native Electron OAuth popup =====
    if (window.Sync && window.electronAPI) {
      Sync.signIn = async function () {
        var clientId = App.settings.gdrive_clientId || '';
        if (!clientId) {
          Utils.toast('הגדר Client ID בהגדרות סנכרון', 'danger');
          return;
        }
        var redirectUri = 'https://alonharazi3-web.github.io/mini-genius/oauth.html';
        var scope = 'https://www.googleapis.com/auth/drive.file';
        var url = 'https://accounts.google.com/o/oauth2/v2/auth'
          + '?client_id=' + encodeURIComponent(clientId)
          + '&redirect_uri=' + encodeURIComponent(redirectUri)
          + '&response_type=token'
          + '&scope=' + encodeURIComponent(scope)
          + '&prompt=consent';

        Utils.toast('פותח חלון התחברות Google...', 'info');
        try {
          var result = await window.electronAPI.oauthSignIn(url, redirectUri);
          _dbg('Electron OAuth: got token, expires in ' + result.expiresIn + 's');

          Sync._token = result.token;
          Sync._tokenExpiry = Date.now() + (result.expiresIn * 1000);

          await DB.setSetting('gdrive_token', result.token);
          await DB.setSetting('gdrive_tokenExpiry', String(Sync._tokenExpiry));
          App.settings.gdrive_token = result.token;
          App.settings.gdrive_tokenExpiry = String(Sync._tokenExpiry);

          await Sync._findOrCreateSyncFile();
          Sync._startTimers();
          _scheduleAutoReauth(result.expiresIn);
          Utils.toast('מחובר ל-Google Drive! ✅', 'success');

        } catch (e) {
          _dbg('Electron OAuth err: ' + e.message);
          if (e.message !== 'Window closed by user') {
            Utils.toast('התחברות נכשלה — נסה שוב', 'danger');
          }
        }
      };

      // ===== Auto-reauth — silent popup before token expires =====
      function _scheduleAutoReauth(expiresInSeconds) {
        // Re-auth 5 minutes before expiry
        var delay = Math.max(0, (expiresInSeconds - 300)) * 1000;
        _dbg('Electron: auto-reauth scheduled in ' + Math.round(delay/60000) + ' min');
        setTimeout(async function () {
          if (!App.settings.gdrive_clientId) return;
          _dbg('Electron: attempting silent re-auth...');
          var clientId = App.settings.gdrive_clientId;
          var redirectUri = 'https://alonharazi3-web.github.io/mini-genius/oauth.html';
          var scope = 'https://www.googleapis.com/auth/drive.file';
          // Try silent auth first (prompt=none)
          var silentUrl = 'https://accounts.google.com/o/oauth2/v2/auth'
            + '?client_id=' + encodeURIComponent(clientId)
            + '&redirect_uri=' + encodeURIComponent(redirectUri)
            + '&response_type=token'
            + '&scope=' + encodeURIComponent(scope)
            + '&prompt=none';
          try {
            var result = await window.electronAPI.oauthSignIn(silentUrl, redirectUri);
            Sync._token = result.token;
            Sync._tokenExpiry = Date.now() + (result.expiresIn * 1000);
            await DB.setSetting('gdrive_token', result.token);
            await DB.setSetting('gdrive_tokenExpiry', String(Sync._tokenExpiry));
            App.settings.gdrive_token = result.token;
            _dbg('Electron: silent re-auth OK');
            _scheduleAutoReauth(result.expiresIn);
          } catch (e) {
            // Silent failed — token expired, user will see warning on next sync attempt
            _dbg('Electron: silent re-auth failed: ' + e.message);
            Sync._token = null;
            Utils.toast('חיבור Google Drive פג — לחץ "חבר מחדש" בהגדרות', 'warning');
          }
        }, delay);
      }

      // Schedule reauth if token already loaded and still valid
      var existingExpiry = parseInt(App.settings && App.settings.gdrive_tokenExpiry) || 0;
      if (existingExpiry > Date.now()) {
        var remainingSecs = Math.floor((existingExpiry - Date.now()) / 1000);
        _scheduleAutoReauth(remainingSecs);
      }
    }

    // ===== Override exit — window.close() on desktop =====
    if (window.Sync) {
      var _origDoExit = Sync._doExit.bind(Sync);
      Sync._doExit = async function () {
        Stages.closeModal();
        if (Sync.isSignedIn()) {
          Utils.toast('שומר ומעלה...', 'info');
          try {
            await App.flushDirty();
            var data = await Sync.exportLocal();
            await Sync.upload(data);
            _dbg('Exit: upload OK (' + data.candidates.length + ' candidates)');
          } catch (e) {
            _dbg('Exit upload err: ' + e);
          }
        } else {
          try { await App.flushDirty(); } catch (e) {}
        }
        setTimeout(function () {
          window.close();
        }, 300);
      };
    }
  });

})();
