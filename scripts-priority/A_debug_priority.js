(function () {
    window._debugMessages = window._debugMessages || [];
    window._debugScriptState = window._debugScriptState || {
        entries: [],
        lastExecuted: null,
        lastExecutedAt: 0
    };

    function describeScript(script) {
        if (script.src) {
            return script.src;
        }
        var text = (script.textContent || '').replace(/^\s+|\s+$/g, '');
        if (text.length > 80) {
            text = text.slice(0, 80) + '...';
        }
        return text ? 'inline script: ' + text : 'inline script';
    }

    function noteScript(script) {
        window._debugScriptState.entries.push({
            id: describeScript(script),
            at: Date.now()
        });
        if (window._debugScriptState.entries.length > 100) {
            window._debugScriptState.entries.shift();
        }
    }

    function watchScript(script) {
        if (!script || script.__pfDebugWatched) {
            return;
        }
        script.__pfDebugWatched = true;
        noteScript(script);
        script.addEventListener('load', function () {
            window._debugScriptState.lastExecuted = describeScript(script);
            window._debugScriptState.lastExecutedAt = Date.now();
        });
    }

    function scanScripts(root) {
        if (!root || !root.querySelectorAll) {
            return;
        }
        var scripts = root.querySelectorAll('script');
        for (var i = 0; i < scripts.length; i++) {
            watchScript(scripts[i]);
        }
    }

    function isSanitizedScriptError(event) {
        var msg = event && event.message ? String(event.message) : '';
        if (msg === 'Script error.' || msg === 'Script error') {
            return true;
        }
        return msg.indexOf('Script error') === 0;
    }

    window._debugSanitizedErrorLimit = 12;
    window._debugSanitizedErrorState = window._debugSanitizedErrorState || { logged: 0 };

    window._debugResetSanitizedErrorCap = function () {
        window._debugSanitizedErrorState = { logged: 0 };
    };

    window._debugSanitizedErrorAction = function (event) {
        var state = window._debugSanitizedErrorState;
        var limit = window._debugSanitizedErrorLimit || 12;
        if (state.logged < limit) {
            state.logged++;
            return 'log';
        }
        return 'suppress';
    };

    function sanitizedErrorAction(event) {
        if (window._debugSanitizedErrorAction) {
            return window._debugSanitizedErrorAction(event);
        }
        return 'log';
    }

    window._debugExplainScriptError = function (event) {
        var hints = [];
        var state = window._debugScriptState || { entries: [], lastExecuted: null, lastExecutedAt: 0 };
        var sanitized = isSanitizedScriptError(event);
        var filename = event && event.filename ? String(event.filename) : '';

        if (!sanitized && filename) {
            return hints;
        }

        if (state.lastExecuted && Date.now() - state.lastExecutedAt < 10000) {
            hints.push('Likely from recently executed script: ' + state.lastExecuted);
        }

        var seen = {};
        var external = [];
        var recent = [];
        for (var i = 0; i < state.entries.length; i++) {
            var id = state.entries[i].id;
            if (seen[id]) {
                continue;
            }
            seen[id] = true;
            if (id.indexOf('inline script') !== 0) {
                external.push(id);
            }
            if (Date.now() - state.entries[i].at < 10000) {
                recent.push(id);
            }
        }

        if (recent.length) {
            hints.push('Scripts added recently: ' + recent.join(', '));
        } else if (external.length) {
            hints.push('External scripts on page: ' + external.join(', '));
        }

        if (sanitized) {
            hints.push('Browser hid file/line (cross-origin script without crossorigin + CORS)');
        } else if (!filename) {
            hints.push('No source URL reported for this error');
        }

        return hints;
    };

    window._debugDumpTrackedScripts = function () {
        var lines = [];
        var seen = {};
        function add(id) {
            if (!id || seen[id]) {
                return;
            }
            seen[id] = true;
            lines.push(id);
        }
        var state = window._debugScriptState;
        if (state && state.entries) {
            for (var i = 0; i < state.entries.length; i++) {
                add(state.entries[i].id);
            }
        }
        try {
            if (document.querySelectorAll) {
                var scripts = document.querySelectorAll('script');
                for (var j = 0; j < scripts.length; j++) {
                    add(describeScript(scripts[j]));
                }
            }
        } catch (e) {
            /* ignore */
        }
        return lines;
    };

    if (document.documentElement) {
        scanScripts(document);
    }

    if (typeof MutationObserver !== 'undefined') {
        new MutationObserver(function (mutations) {
            for (var i = 0; i < mutations.length; i++) {
                var nodes = mutations[i].addedNodes;
                for (var j = 0; j < nodes.length; j++) {
                    var node = nodes[j];
                    if (node.tagName === 'SCRIPT') {
                        watchScript(node);
                    } else {
                        scanScripts(node);
                    }
                }
            }
        }).observe(document.documentElement || document, { childList: true, subtree: true });
    }

    var groupDepth = 0;
    var timers = {};
    var counters = {};

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

    function indentPrefix() {
        if (groupDepth <= 0) {
            return '';
        }
        var out = '';
        for (var i = 0; i < groupDepth; i++) {
            out += '  ';
        }
        return out;
    }

    function emit(prefix, args) {
        var line = indentPrefix() + prefix + formatArgs(args);
        if (typeof window._debugAppendLine === 'function') {
            window._debugAppendLine(line);
        } else {
            window._debugMessages.push(line);
        }
    }

    function captureStack() {
        try {
            throw new Error();
        } catch (e) {
            return e.stack || '';
        }
    }

    function forward(name, original, args) {
        if (original) {
            return original.apply(console, args);
        }
        return console.log.apply(console, args);
    }

    var originalConsole = {
        log: console.log,
        info: console.info,
        error: console.error,
        warn: console.warn,
        debug: console.debug,
        trace: console.trace,
        assert: console.assert,
        dir: console.dir,
        dirxml: console.dirxml,
        table: console.table,
        group: console.group,
        groupCollapsed: console.groupCollapsed,
        groupEnd: console.groupEnd,
        time: console.time,
        timeEnd: console.timeEnd,
        timeLog: console.timeLog,
        count: console.count,
        countReset: console.countReset,
        clear: console.clear
    };

    window._debugOriginalConsole = originalConsole;

    function hookSimple(name) {
        console[name] = function () {
            emit('console.' + name + ': ', arguments);
            return forward(name, originalConsole[name], arguments);
        };
    }

    function installConsoleHooks() {
    hookSimple('log');
    hookSimple('info');
    hookSimple('error');
    hookSimple('warn');
    hookSimple('debug');
    hookSimple('dir');
    hookSimple('dirxml');

    console.trace = function () {
        emit('console.trace: ', arguments);
        emit('Stack trace: ', [captureStack()]);
        return forward('trace', originalConsole.trace, arguments);
    };

    console.assert = function (condition) {
        if (condition) {
            return forward('assert', originalConsole.assert, arguments);
        }
        var args = Array.prototype.slice.call(arguments, 1);
        emit('Assertion failed: ', args.length ? args : ['console.assert']);
        return forward('assert', originalConsole.assert, arguments);
    };

    console.table = function (data, columns) {
        emit('console.table: ', [data]);
        if (columns) {
            emit('console.table columns: ', [columns]);
        }
        return forward('table', originalConsole.table, arguments);
    };

    console.group = function () {
        emit('console.group: ', arguments);
        groupDepth++;
        return forward('group', originalConsole.group, arguments);
    };

    console.groupCollapsed = function () {
        emit('console.groupCollapsed: ', arguments);
        groupDepth++;
        return forward('groupCollapsed', originalConsole.groupCollapsed, arguments);
    };

    console.groupEnd = function () {
        if (groupDepth > 0) {
            groupDepth--;
        }
        emit('console.groupEnd', []);
        return forward('groupEnd', originalConsole.groupEnd, arguments);
    };

    console.time = function (label) {
        label = label || 'default';
        timers[label] = Date.now();
        emit('console.time: ', [label]);
        return forward('time', originalConsole.time, arguments);
    };

    console.timeEnd = function (label) {
        label = label || 'default';
        var start = timers[label];
        var elapsed = typeof start === 'number' ? Date.now() - start : NaN;
        delete timers[label];
        emit('console.timeEnd: ', [label + ': ' + elapsed + 'ms']);
        return forward('timeEnd', originalConsole.timeEnd, arguments);
    };

    console.timeLog = function (label) {
        label = label || 'default';
        var start = timers[label];
        var elapsed = typeof start === 'number' ? Date.now() - start : NaN;
        emit('console.timeLog: ', [label + ': ' + elapsed + 'ms']);
        return forward('timeLog', originalConsole.timeLog, arguments);
    };

    console.count = function (label) {
        label = label || 'default';
        counters[label] = (counters[label] || 0) + 1;
        emit('console.count: ', [label + ': ' + counters[label]]);
        return forward('count', originalConsole.count, arguments);
    };

    console.countReset = function (label) {
        if (label === undefined) {
            counters = {};
            emit('console.countReset: ', ['all']);
        } else {
            delete counters[label];
            emit('console.countReset: ', [label]);
        }
        return forward('countReset', originalConsole.countReset, arguments);
    };

    console.clear = function () {
        window._debugMessages.length = 0;
        if (window._debugResetSanitizedErrorCap) {
            window._debugResetSanitizedErrorCap();
        }
        if (typeof window._debugClearPanel === 'function') {
            window._debugClearPanel();
        }
        emit('console.clear', []);
        return forward('clear', originalConsole.clear, arguments);
    };
    }

    installConsoleHooks();

    function emitTrackedScriptsSnapshot() {
        var list = [];
        if (window._debugDumpTrackedScripts) {
            try {
                list = window._debugDumpTrackedScripts() || [];
            } catch (e) {
                list = [];
            }
        }
        if (!list.length) {
            emit('Script hint: ', ['No <script> elements found on page']);
            return;
        }
        emit('Script hint: ', ['Tracked scripts at first Script error (' + list.length + '):']);
        var max = 24;
        for (var i = 0; i < list.length && i < max; i++) {
            emit('Script hint: ', ['  ' + list[i]]);
        }
        if (list.length > max) {
            emit('Script hint: ', ['  ... and ' + (list.length - max) + ' more']);
        }
    }

    function emitScriptHints(event) {
        var hints = [];
        try {
            hints = window._debugExplainScriptError(event) || [];
        } catch (e) {
            hints = [];
        }
        if (!hints.length && isSanitizedScriptError(event)) {
            hints.push('Browser hid file/line (cross-origin script without crossorigin + CORS)');
        } else if (!hints.length && (!event || !event.filename)) {
            hints.push('No source URL reported for this error');
        }
        for (var i = 0; i < hints.length; i++) {
            emit('Script hint: ', [hints[i]]);
        }
    }

    function logWindowError(event) {
        if (window._debugErrorsOwnedByPanel) {
            return;
        }
        var target = event.target;

        if (target && target !== window && target.tagName) {
            var url = target.src || target.href || target.currentSrc || '';
            if (target.tagName === 'SCRIPT' && !url && target.textContent) {
                url = describeScript(target);
            }
            emit('Resource error: ', [target.tagName + ' failed to load' + (url ? ': ' + url : '')]);
            return;
        }

        if (event.message) {
            if (isSanitizedScriptError(event)) {
                var action = sanitizedErrorAction(event);
                if (action === 'suppress') {
                    return;
                }
                emit('Error: ', [event.message + ' at ' + (event.filename || '') + ':' + (event.lineno || 0) + ':' + (event.colno || 0)]);
                if (window._debugSanitizedErrorState.logged === 1) {
                    emitScriptHints(event);
                    emitTrackedScriptsSnapshot();
                }
                return;
            }

            emit('Error: ', [event.message + ' at ' + (event.filename || '') + ':' + (event.lineno || 0) + ':' + (event.colno || 0)]);
            if (event.error && event.error.stack) {
                emit('Stack trace: ', [event.error.stack]);
            }
            emitScriptHints(event);
        }
    }

    window.addEventListener('error', logWindowError, true);

    window.addEventListener('unhandledrejection', function (event) {
        if (window._debugErrorsOwnedByPanel) {
            return;
        }
        var reason = event.reason;
        emit('Unhandled rejection: ', [reason && reason.stack ? reason.stack : reason]);
    });

    window.addEventListener('rejectionhandled', function (event) {
        if (window._debugErrorsOwnedByPanel) {
            return;
        }
        var reason = event.reason;
        emit('Rejection handled: ', [reason && reason.stack ? reason.stack : reason]);
    });

    document.addEventListener('securitypolicyviolation', function (event) {
        if (window._debugErrorsOwnedByPanel) {
            return;
        }
        emit('CSP violation: ', [
            (event.violatedDirective || event.effectiveDirective || 'policy') +
            ' blocked ' + (event.blockedURI || '') +
            ' (' + (event.sourceFile || '') + ':' + (event.lineNumber || 0) + ')'
        ]);
    });
})();
