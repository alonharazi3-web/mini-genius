// MGNotification — standalone bridge (no plugin system needed)
var MGNotification = {
    show: function(title, text, success, error) {
        if(window.cordova && cordova.exec){
            cordova.exec(success||function(){}, error||function(){}, 'MGNotification', 'show', [title, text]);
        }
    },
    clear: function(success, error) {
        if(window.cordova && cordova.exec){
            cordova.exec(success||function(){}, error||function(){}, 'MGNotification', 'clear', []);
        }
    }
};
