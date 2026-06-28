(function () {
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

    function appendLog(prefix, args) {
        logArea.appendChild(document.createTextNode(prefix + formatArgs(args) + '\n'));
        if (!hasSelectionInLog()) {
            logArea.scrollTop = logArea.scrollHeight;
        }
    }

    function hasSelectionInLog() {
        var sel = window.getSelection && window.getSelection();
        if (!sel || !sel.rangeCount) {
            return false;
        }
        var node = sel.anchorNode;
        return node && (logArea === node || logArea.contains(node));
    }

    var logArea = document.getElementById('log') || document.body.appendChild(document.createElement('pre'));
    logArea.id = 'log';
    logArea.style.cssText = [
        'position:fixed',
        'left:0',
        'bottom:0',
        'right:0',
        'max-height:40vh',
        'margin:0',
        'padding:8px',
        'overflow:auto',
        'z-index:2147483647',
        'background:rgba(0,0,0,0.85)',
        'color:#eee',
        'font:12px/1.4 monospace',
        'white-space:pre-wrap',
        'word-break:break-word',
        'pointer-events:auto',
        '-webkit-user-select:text',
        'user-select:text',
        '-webkit-touch-callout:default',
        'touch-action:auto'
    ].join(';');

    if (window._debugMessages && window._debugMessages.length > 0) {
        for (var i = 0; i < window._debugMessages.length; i++) {
            logArea.appendChild(document.createTextNode(window._debugMessages[i] + '\n'));
        }
        window._debugMessages = [];
    }

    console.log = function () {
        appendLog('console.log: ', arguments);
    };
    console.info = function () {
        appendLog('console.info: ', arguments);
    };
    console.error = function () {
        appendLog('console.error: ', arguments);
    };
    console.warn = function () {
        appendLog('console.warn: ', arguments);
    };
    console.debug = function () {
        appendLog('console.debug: ', arguments);
    };

    window.onerror = function (msg, url, lineNo, columnNo, error) {
        appendLog('Error: ', [msg + ' at ' + url + ':' + lineNo + ':' + columnNo]);
        if (error && error.stack) {
            appendLog('Stack trace: ', [error.stack]);
        }
        return false;
    };

    window.addEventListener('unhandledrejection', function (event) {
        var reason = event.reason;
        if (reason && reason.stack) {
            appendLog('Unhandled rejection: ', [reason.stack]);
        } else {
            appendLog('Unhandled rejection: ', [reason]);
        }
    });
})();
