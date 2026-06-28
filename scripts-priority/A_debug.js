(function () {
    window._debugMessages = window._debugMessages || [];

    function formatArgs(args) {
        return Array.prototype.map.call(args, function (arg) {
            if (typeof arg === 'string') {
                return arg;
            }
            if (arg && typeof arg === 'object' && arg.stack) {
                return arg.stack;
            }
            try {
                return JSON.stringify(arg);
            } catch (e) {
                return String(arg);
            }
        }).join(' ');
    }

    function pushMessage(prefix, args) {
        window._debugMessages.push(prefix + formatArgs(args));
    }

    var originalConsole = {
        log: console.log,
        info: console.info,
        error: console.error,
        warn: console.warn,
        debug: console.debug
    };

    var originalOnError = window.onerror;

    console.log = function () {
        pushMessage('console.log: ', arguments);
        return originalConsole.log.apply(console, arguments);
    };

    console.info = function () {
        pushMessage('console.info: ', arguments);
        return originalConsole.info.apply(console, arguments);
    };

    console.error = function () {
        pushMessage('console.error: ', arguments);
        return originalConsole.error.apply(console, arguments);
    };

    console.warn = function () {
        pushMessage('console.warn: ', arguments);
        return originalConsole.warn.apply(console, arguments);
    };

    console.debug = function () {
        pushMessage('console.debug: ', arguments);
        if (originalConsole.debug) {
            return originalConsole.debug.apply(console, arguments);
        }
        return originalConsole.log.apply(console, arguments);
    };

    window.onerror = function (msg, url, lineNo, columnNo, error) {
        pushMessage('Error: ', [msg + ' at ' + url + ':' + lineNo + ':' + columnNo]);
        if (error && error.stack) {
            pushMessage('Stack trace: ', [error.stack]);
        }

        if (originalOnError) {
            return originalOnError.apply(window, arguments);
        }

        return false;
    };

    window.addEventListener('unhandledrejection', function (event) {
        var reason = event.reason;
        if (reason && reason.stack) {
            pushMessage('Unhandled rejection: ', [reason.stack]);
        } else {
            pushMessage('Unhandled rejection: ', [reason]);
        }
    });
})();
