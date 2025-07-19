(function () {
    // Initialize global storage for debug messages
    window._debugMessages = window._debugMessages || [];

    var originalConsole = {
        log: console.log,
        info: console.info,
        error: console.error,
        warn: console.warn
    };

    var originalOnError = window.onerror;

    console.log = function () {
        var msg = Array.prototype.slice.call(arguments).join(' ');
        window._debugMessages.push('console.log: ' + msg);
        return originalConsole.log.apply(console, arguments);
    };

    console.info = function () {
        var msg = Array.prototype.slice.call(arguments).join(' ');
        window._debugMessages.push('console.info: ' + msg);
        return originalConsole.info.apply(console, arguments);
    };

    console.error = function () {
        var msg = Array.prototype.slice.call(arguments).join(' ');
        window._debugMessages.push('console.error: ' + msg);
        return originalConsole.error.apply(console, arguments);
    };

    console.warn = function () {
        var msg = Array.prototype.slice.call(arguments).join(' ');
        window._debugMessages.push('console.warn: ' + msg);
        return originalConsole.warn.apply(console, arguments);
    };

    window.onerror = function (msg, url, lineNo, columnNo, error) {
        var errorMsg = 'Error: ' + msg + ' at ' + url + ':' + lineNo + ':' + columnNo;
        window._debugMessages.push(errorMsg);

        if (error && error.stack) {
            window._debugMessages.push('Stack trace: ' + error.stack);
        }

        if (originalOnError) {
            return originalOnError.apply(window, arguments);
        }

        return false;
    };
})();