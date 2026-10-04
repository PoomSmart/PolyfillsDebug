(function () {
    var stickToBottom = true;
    var SCROLL_THRESHOLD = 24;
    var logScroller;
    var topMarker;
    var bottomMarker;
    var MARKER_STYLE = 'display:block;height:1px;line-height:0;font-size:0;overflow:hidden;';
    var lastLineKey = null;
    var lastLineNode = null;
    var lastLineCount = 0;

    function hasSelectionInLog() {
        var sel = window.getSelection && window.getSelection();
        if (!sel || !sel.rangeCount) {
            return false;
        }
        var node = sel.anchorNode;
        return node && (logArea === node || logArea.contains(node));
    }

    function isAtBottom(el) {
        return el.scrollHeight - el.scrollTop - el.clientHeight <= SCROLL_THRESHOLD;
    }

    function getScroller() {
        return logScroller || logArea;
    }

    function ensureMarkers() {
        if (!logArea) {
            return;
        }
        if (!topMarker || !topMarker.parentNode) {
            topMarker = document.createElement('span');
            topMarker.id = 'pf-debug-top-marker';
            topMarker.style.cssText = MARKER_STYLE;
            if (logArea.firstChild) {
                logArea.insertBefore(topMarker, logArea.firstChild);
            } else {
                logArea.appendChild(topMarker);
            }
        }
        if (!bottomMarker || !bottomMarker.parentNode) {
            bottomMarker = document.createElement('span');
            bottomMarker.id = 'pf-debug-bottom-marker';
            bottomMarker.style.cssText = MARKER_STYLE;
            logArea.appendChild(bottomMarker);
        }
    }

    function scrollToBottom() {
        stickToBottom = true;
        var scroller = getScroller();
        if (!scroller) {
            return;
        }
        ensureMarkers();
        scroller.scrollTop = scroller.scrollHeight;
        if (bottomMarker && bottomMarker.scrollIntoView) {
            bottomMarker.scrollIntoView(false);
        }
        scroller.scrollTop = scroller.scrollHeight;
    }

    function scrollToTop() {
        stickToBottom = false;
        var scroller = getScroller();
        if (!scroller) {
            return;
        }
        ensureMarkers();
        scroller.scrollTop = 0;
        if (topMarker && topMarker.scrollIntoView) {
            topMarker.scrollIntoView(true);
        }
        scroller.scrollTop = 0;
    }

    function bindTap(el, fn) {
        var lock = false;
        function run(e) {
            if (lock) {
                return;
            }
            lock = true;
            if (e && e.preventDefault) {
                e.preventDefault();
            }
            if (e && e.stopPropagation) {
                e.stopPropagation();
            }
            fn();
            setTimeout(function () {
                lock = false;
            }, 400);
        }
        el.addEventListener('touchend', run, false);
        el.addEventListener('click', run, false);
    }

    function getLogText() {
        return logArea.textContent || '';
    }

    function copyLog() {
        var text = getLogText();
        if (!text) {
            return;
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).catch(function () {
                copyLogFallback(text);
            });
            return;
        }
        copyLogFallback(text);
    }

    function copyLogFallback(text) {
        var textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
        } catch (e) {
            /* ignore */
        }
        document.body.removeChild(textarea);
    }

    function formatLineWithCount(line, count) {
        if (count <= 1) {
            return line;
        }
        return line + ' (\u00d7' + count + ')';
    }

    function resetLineAggregation() {
        lastLineKey = null;
        lastLineNode = null;
        lastLineCount = 0;
    }

    function clearLog() {
        if (!logArea) {
            return;
        }
        while (logArea.firstChild) {
            logArea.removeChild(logArea.firstChild);
        }
        topMarker = null;
        bottomMarker = null;
        resetLineAggregation();
        if (window._debugResetSanitizedErrorCap) {
            window._debugResetSanitizedErrorCap();
        }
        localSanitizedState.logged = 0;
        suppressNoticeShown = false;
        window._debugMessages.length = 0;
        stickToBottom = true;
    }

    function appendLine(line) {
        if (!logArea) {
            return;
        }
        ensureMarkers();
        if (lastLineKey === line && lastLineNode) {
            lastLineCount++;
            lastLineNode.nodeValue = formatLineWithCount(line, lastLineCount) + '\n';
        } else {
            lastLineKey = line;
            lastLineCount = 1;
            lastLineNode = document.createTextNode(formatLineWithCount(line, 1) + '\n');
            logArea.insertBefore(lastLineNode, bottomMarker);
        }
        if (stickToBottom && !hasSelectionInLog()) {
            scrollToBottom();
        }
    }

    var panel;
    var toolbar;
    var panelExpanded = true;
    var panelExpandedHeight;
    var expandBtn;
    var logArea;

    function defaultPanelHeight() {
        return Math.max(120, Math.floor((window.innerHeight || document.documentElement.clientHeight || 320) * 0.4));
    }

    function updateExpandButton() {
        if (!expandBtn) {
            return;
        }
        if (panelExpanded) {
            expandBtn.textContent = 'Collapse';
            expandBtn.title = 'Collapse log panel';
        } else {
            expandBtn.textContent = 'Expand';
            expandBtn.title = 'Expand log panel';
        }
    }

    function setPanelExpanded(expanded) {
        if (!panel || !logScroller || !toolbar) {
            return;
        }
        panelExpanded = expanded;
        if (expanded) {
            panel.style.height = panelExpandedHeight + 'px';
            logScroller.style.display = 'block';
            logScroller.style.top = (toolbar.offsetHeight || 28) + 'px';
            updateExpandButton();
            if (stickToBottom) {
                scrollToBottom();
            }
        } else {
            if (panel.offsetHeight > (toolbar.offsetHeight || 28)) {
                panelExpandedHeight = panel.offsetHeight;
            }
            logScroller.style.display = 'none';
            panel.style.height = (toolbar.offsetHeight || 28) + 'px';
            updateExpandButton();
        }
    }

    function togglePanelExpanded() {
        setPanelExpanded(!panelExpanded);
    }

    panel = document.getElementById('pf-debug-panel');

    if (!panel) {
        panelExpandedHeight = defaultPanelHeight();

        panel = document.createElement('div');
        panel.id = 'pf-debug-panel';
        panel.style.cssText = [
            'position:fixed',
            'left:0',
            'bottom:0',
            'right:0',
            'height:' + panelExpandedHeight + 'px',
            'z-index:2147483647',
            'background:rgba(0,0,0,0.85)',
            'color:#eee',
            'font:12px/1.4 monospace',
            'pointer-events:auto',
            '-webkit-user-select:none'
        ].join(';');

        var toolbar = document.createElement('div');
        toolbar.id = 'pf-debug-toolbar';
        toolbar.style.cssText = [
            'padding:4px 8px',
            'border-bottom:1px solid rgba(255,255,255,0.15)',
            'background:rgba(0,0,0,0.35)'
        ].join(';');

        var btnStyle = [
            'margin:0 6px 0 0',
            'padding:2px 8px',
            'border:1px solid rgba(255,255,255,0.25)',
            'border-radius:3px',
            'background:rgba(255,255,255,0.08)',
            'color:#eee',
            'font:11px/1.4 monospace',
            'cursor:pointer',
            '-webkit-appearance:none'
        ].join(';');

        function createButton(label, title, onClick) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = label;
            btn.title = title;
            btn.style.cssText = btnStyle;
            bindTap(btn, onClick);
            return btn;
        }

        toolbar.appendChild(createButton('Copy', 'Copy log to clipboard', copyLog));
        toolbar.appendChild(createButton('Clear', 'Clear log', function () {
            console.clear();
        }));
        toolbar.appendChild(createButton('Top', 'Scroll to top', scrollToTop));
        toolbar.appendChild(createButton('Bottom', 'Scroll to bottom', scrollToBottom));
        expandBtn = createButton('Collapse', 'Collapse log panel', togglePanelExpanded);
        toolbar.appendChild(expandBtn);

        logScroller = document.createElement('div');
        logScroller.id = 'pf-debug-log-scroller';
        logScroller.style.cssText = [
            'position:absolute',
            'left:0',
            'right:0',
            'bottom:0',
            'overflow-x:hidden',
            'overflow-y:scroll',
            '-webkit-overflow-scrolling:touch'
        ].join(';');

        logArea = document.createElement('pre');
        logArea.id = 'log';
        logArea.style.cssText = [
            'margin:0',
            'padding:8px',
            'white-space:pre-wrap',
            'word-break:break-word',
            'background:transparent',
            'color:inherit',
            'font:inherit',
            '-webkit-user-select:text',
            '-webkit-touch-callout:default'
        ].join(';');

        logScroller.appendChild(logArea);
        panel.appendChild(toolbar);
        panel.appendChild(logScroller);
        (document.body || document.documentElement).appendChild(panel);
        logScroller.style.top = (toolbar.offsetHeight || 28) + 'px';

        logScroller.addEventListener('scroll', function () {
            stickToBottom = isAtBottom(logScroller);
        }, false);

        panel.addEventListener('touchstart', function (e) {
            e.stopPropagation();
        }, true);

        panel.addEventListener('touchmove', function (e) {
            e.stopPropagation();
        }, true);
    } else {
        logScroller = document.getElementById('pf-debug-log-scroller');
        toolbar = document.getElementById('pf-debug-toolbar');
        logArea = document.getElementById('log');
        panelExpandedHeight = panel.offsetHeight || defaultPanelHeight();
        panelExpanded = logScroller && logScroller.style.display !== 'none';
        expandBtn = null;
        if (toolbar && toolbar.querySelectorAll) {
            var toolbarButtons = toolbar.querySelectorAll('button');
            for (var bi = 0; bi < toolbarButtons.length; bi++) {
                if (toolbarButtons[bi].textContent === 'Collapse' || toolbarButtons[bi].textContent === 'Expand') {
                    expandBtn = toolbarButtons[bi];
                    bindTap(expandBtn, togglePanelExpanded);
                    break;
                }
            }
        }
        if (toolbar && !expandBtn) {
            expandBtn = document.createElement('button');
            expandBtn.type = 'button';
            expandBtn.style.cssText = 'margin:0 6px 0 0;padding:2px 8px;border:1px solid rgba(255,255,255,0.25);border-radius:3px;background:rgba(255,255,255,0.08);color:#eee;font:11px/1.4 monospace;cursor:pointer;-webkit-appearance:none';
            bindTap(expandBtn, togglePanelExpanded);
            toolbar.appendChild(expandBtn);
        }
        updateExpandButton();
        if (!logArea) {
            logArea = document.createElement('pre');
            logArea.id = 'log';
            if (logScroller) {
                logScroller.appendChild(logArea);
            } else {
                panel.appendChild(logArea);
            }
        }
    }

    window._debugAppendLine = appendLine;
    window._debugClearPanel = clearLog;

    if (window._debugMessages && window._debugMessages.length > 0) {
        for (var i = 0; i < window._debugMessages.length; i++) {
            appendLine(window._debugMessages[i]);
        }
        window._debugMessages.length = 0;
    }

    // Self-sufficient console capture rendered straight to the panel.
    // This owns console.* live (overriding the priority script's early
    // buffering hooks) so logging works even if the priority script's
    // hooks were clobbered by the page, or did not run at all.
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

    function captureStack() {
        try {
            throw new Error();
        } catch (e) {
            return e.stack || '';
        }
    }

    function emitLive(prefix, args) {
        appendLine(indentPrefix() + prefix + formatArgs(args));
    }

    var nativeConsole = window._debugOriginalConsole || {};

    function forwardNative(name, args) {
        var fn = nativeConsole[name];
        if (typeof fn === 'function') {
            try {
                return fn.apply(console, args);
            } catch (e) {
                /* ignore */
            }
        }
    }

    function hookLive(name) {
        console[name] = function () {
            emitLive('console.' + name + ': ', arguments);
            forwardNative(name, arguments);
        };
    }

    hookLive('log');
    hookLive('info');
    hookLive('error');
    hookLive('warn');
    hookLive('debug');
    hookLive('dir');
    hookLive('dirxml');

    console.trace = function () {
        emitLive('console.trace: ', arguments);
        emitLive('Stack trace: ', [captureStack()]);
        forwardNative('trace', arguments);
    };

    console.assert = function (condition) {
        if (!condition) {
            var args = Array.prototype.slice.call(arguments, 1);
            emitLive('Assertion failed: ', args.length ? args : ['console.assert']);
        }
        forwardNative('assert', arguments);
    };

    console.table = function (data, columns) {
        emitLive('console.table: ', [data]);
        if (columns) {
            emitLive('console.table columns: ', [columns]);
        }
        forwardNative('table', arguments);
    };

    console.group = function () {
        emitLive('console.group: ', arguments);
        groupDepth++;
        forwardNative('group', arguments);
    };

    console.groupCollapsed = function () {
        emitLive('console.groupCollapsed: ', arguments);
        groupDepth++;
        forwardNative('groupCollapsed', arguments);
    };

    console.groupEnd = function () {
        if (groupDepth > 0) {
            groupDepth--;
        }
        emitLive('console.groupEnd', []);
        forwardNative('groupEnd', arguments);
    };

    console.time = function (label) {
        label = label || 'default';
        timers[label] = Date.now();
        emitLive('console.time: ', [label]);
        forwardNative('time', arguments);
    };

    console.timeEnd = function (label) {
        label = label || 'default';
        var start = timers[label];
        var elapsed = typeof start === 'number' ? Date.now() - start : NaN;
        delete timers[label];
        emitLive('console.timeEnd: ', [label + ': ' + elapsed + 'ms']);
        forwardNative('timeEnd', arguments);
    };

    console.timeLog = function (label) {
        label = label || 'default';
        var start = timers[label];
        var elapsed = typeof start === 'number' ? Date.now() - start : NaN;
        emitLive('console.timeLog: ', [label + ': ' + elapsed + 'ms']);
        forwardNative('timeLog', arguments);
    };

    console.count = function (label) {
        label = label || 'default';
        counters[label] = (counters[label] || 0) + 1;
        emitLive('console.count: ', [label + ': ' + counters[label]]);
        forwardNative('count', arguments);
    };

    console.countReset = function (label) {
        if (label === undefined) {
            counters = {};
            emitLive('console.countReset: ', ['all']);
        } else {
            delete counters[label];
            emitLive('console.countReset: ', [label]);
        }
        forwardNative('countReset', arguments);
    };

    console.clear = function () {
        clearLog();
        emitLive('console.clear', []);
        forwardNative('clear', arguments);
    };

    // Self-sufficient error capture rendered straight to the panel. This works
    // even if the priority script (document start) never ran on this device
    // (e.g. older WebKit failing the start bundle). Marking ownership stops the
    // priority script from also rendering errors, which would double them.
    window._debugErrorsOwnedByPanel = true;

    function describeScriptEl(script) {
        if (script.src) {
            return script.src;
        }
        var text = (script.textContent || '').replace(/^\s+|\s+$/g, '');
        if (text.length > 80) {
            text = text.slice(0, 80) + '...';
        }
        return text ? 'inline script: ' + text : 'inline script';
    }

    function isSanitizedScriptError(event) {
        var msg = event && event.message ? String(event.message) : '';
        if (msg === 'Script error.' || msg === 'Script error') {
            return true;
        }
        return msg.indexOf('Script error') === 0;
    }

    var localSanitizedState = { logged: 0 };
    var SANITIZED_LIMIT = 12;
    var suppressNoticeShown = false;

    function sanitizedErrorAction() {
        if (typeof window._debugSanitizedErrorAction === 'function') {
            return window._debugSanitizedErrorAction();
        }
        if (localSanitizedState.logged < SANITIZED_LIMIT) {
            localSanitizedState.logged++;
            return 'log';
        }
        return 'suppress';
    }

    function sanitizedLoggedCount() {
        if (window._debugSanitizedErrorState && typeof window._debugSanitizedErrorState.logged === 'number') {
            return window._debugSanitizedErrorState.logged;
        }
        return localSanitizedState.logged;
    }

    function explainScriptError(event) {
        var hints = [];
        if (typeof window._debugExplainScriptError === 'function') {
            try {
                hints = window._debugExplainScriptError(event) || [];
            } catch (e) {
                hints = [];
            }
        }
        if (!hints.length) {
            if (isSanitizedScriptError(event)) {
                hints.push('Browser hid file/line (cross-origin script without crossorigin + CORS)');
            } else if (!event || !event.filename) {
                hints.push('No source URL reported for this error');
            }
        }
        return hints;
    }

    function emitScriptHints(event) {
        var hints = explainScriptError(event);
        for (var i = 0; i < hints.length; i++) {
            emitLive('Script hint: ', [hints[i]]);
        }
    }

    function emitTrackedScriptsSnapshot() {
        var list = [];
        if (typeof window._debugDumpTrackedScripts === 'function') {
            try {
                list = window._debugDumpTrackedScripts() || [];
            } catch (e) {
                list = [];
            }
        }
        if (!list.length && document.querySelectorAll) {
            try {
                var scripts = document.querySelectorAll('script');
                for (var si = 0; si < scripts.length; si++) {
                    list.push(describeScriptEl(scripts[si]));
                }
            } catch (e2) {
                /* ignore */
            }
        }
        if (!list.length) {
            emitLive('Script hint: ', ['No <script> elements found on page']);
            return;
        }
        emitLive('Script hint: ', ['Tracked scripts at first Script error (' + list.length + '):']);
        var max = 24;
        for (var k = 0; k < list.length && k < max; k++) {
            emitLive('Script hint: ', ['  ' + list[k]]);
        }
        if (list.length > max) {
            emitLive('Script hint: ', ['  ... and ' + (list.length - max) + ' more']);
        }
    }

    function logWindowError(event) {
        var target = event.target;
        if (target && target !== window && target.tagName) {
            var url = target.src || target.href || target.currentSrc || '';
            if (target.tagName === 'SCRIPT' && !url && target.textContent) {
                url = describeScriptEl(target);
            }
            emitLive('Resource error: ', [target.tagName + ' failed to load' + (url ? ': ' + url : '')]);
            return;
        }
        if (!event.message) {
            return;
        }
        if (isSanitizedScriptError(event)) {
            if (sanitizedErrorAction() === 'suppress') {
                if (!suppressNoticeShown) {
                    suppressNoticeShown = true;
                    emitLive('Script hint: ', ['Reached cap for cross-origin "Script error." — further ones are now hidden (use Clear to reset).']);
                }
                return;
            }
            emitLive('Error: ', [event.message + ' at ' + (event.filename || '') + ':' + (event.lineno || 0) + ':' + (event.colno || 0)]);
            if (event.error && event.error.stack) {
                emitLive('Real stack: ', [event.error.stack]);
            } else if (event.error && event.error.message) {
                emitLive('Real error: ', [(event.error.name ? event.error.name + ': ' : '') + event.error.message]);
            }
            if (sanitizedLoggedCount() === 1) {
                emitScriptHints(event);
                emitTrackedScriptsSnapshot();
            }
            return;
        }
        emitLive('Error: ', [event.message + ' at ' + (event.filename || '') + ':' + (event.lineno || 0) + ':' + (event.colno || 0)]);
        if (event.error && event.error.stack) {
            emitLive('Stack trace: ', [event.error.stack]);
        }
        emitScriptHints(event);
    }

    // Loop-proof wrapper: the debug script is itself an injected user script
    // with no source URL, so if one of these handlers ever threw, WebKit would
    // report it as another "Script error. at :0:0", which our error handler
    // would log, which could cascade endlessly on every page. The re-entrancy
    // guard plus the swallowing try/catch make that impossible.
    function safeHandler(fn) {
        return function (event) {
            if (window.__pfInDebugHandler) {
                return;
            }
            window.__pfInDebugHandler = true;
            try {
                fn.call(this, event);
            } catch (e) {
                /* never let a debug handler throw */
            } finally {
                window.__pfInDebugHandler = false;
            }
        };
    }

    window.addEventListener('error', safeHandler(logWindowError), true);

    window.addEventListener('unhandledrejection', safeHandler(function (event) {
        var reason = event.reason;
        emitLive('Unhandled rejection: ', [reason && reason.stack ? reason.stack : reason]);
    }));

    window.addEventListener('rejectionhandled', safeHandler(function (event) {
        var reason = event.reason;
        emitLive('Rejection handled: ', [reason && reason.stack ? reason.stack : reason]);
    }));

    document.addEventListener('securitypolicyviolation', safeHandler(function (event) {
        emitLive('CSP violation: ', [
            (event.violatedDirective || event.effectiveDirective || 'policy') +
            ' blocked ' + (event.blockedURI || '') +
            ' (' + (event.sourceFile || '') + ':' + (event.lineNumber || 0) + ')'
        ]);
    }));
})();
