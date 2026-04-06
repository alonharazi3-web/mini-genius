var exec = require('cordova/exec');

var MGNotification = {
    show: function(title, text, success, error) {
        exec(success || function(){}, error || function(){}, 'MGNotification', 'show', [title, text]);
    },
    clear: function(success, error) {
        exec(success || function(){}, error || function(){}, 'MGNotification', 'clear', []);
    }
};

module.exports = MGNotification;
