/**
 * Class for the sidebar action.
 * @constructor
 */
function CheckmarksSidebar() {

    // Default options for convenient access.
    let TIMEOUT = CM_DEFAULTS.getTimeout() * 1000;
    let TIMEOUT_OVERRULE = CM_DEFAULTS.getTimeoutOverrule();
    let MAX_TABS = CM_DEFAULTS.getMaxTabs();
    let IGNORED_DIRS = CM_DEFAULTS.getIgnoredDirs();
    let IGNORED_DIRS_ACTIVE = CM_DEFAULTS.getIgnoredDirsActive();
    let INCLUDED_DIRS = CM_DEFAULTS.getIncludedDirs();
    let INCLUDED_DIRS_ACTIVE = CM_DEFAULTS.getIncludedDirsActive();
    let IGNORED_URLS = CM_DEFAULTS.getIgnoredUrls();
    let IGNORED_URLS_ACTIVE = CM_DEFAULTS.getIgnoredUrlsActive();
    let SHOW_FAVICONS = CM_DEFAULTS.getShowFavicons();
    let TO_LOWERCASE = CM_DEFAULTS.getToLowercase();
    let DO_SORT = CM_DEFAULTS.doSort();
    let SORT_UNFILED_BY_DATE = CM_DEFAULTS.sortUnfiledByDate();
    let CLEAR_CACHE = CM_DEFAULTS.getClearCache();

    // Constants for error-mapping and tooltips.
    // Custom error definitions:
    const ERROR_DUPLICATE = 'duplicate';
    const ERROR_TIMEOUT = 'timeout';
    const ERROR_UNSPECIFIED = 'unspecified_40x/50x'; // Not yet...
    // Request errors:
    const ERROR_RESOURCE_NOT_FOUND = 'resource_not_found';
    const ERROR_AUTH_REQUIRED = 'authentication_required';
    // Navigation errors:
    const ERROR_SERVER_NOT_FOUND = 'server_not_found';
    const ERROR_CONNECTION_REFUSED = 'connection_refused';
    const ERROR_INVALID_CERTIFICATE = 'invalid_certificate';
    const ERROR_BINDING_ABORTED = 'redirect'; // Actually a warning. Loading will continue.
    const ERROR_ABORTED = 'aborted';
    const ERROR_INTERRUPT = 'connection_interrupted';

    // Error codes provided by the web-extensions API and some HTTP error codes.
    const ERROR_CODES_TO_TYPE = {
        '2152398878': ERROR_SERVER_NOT_FOUND,
        '2152398861': ERROR_CONNECTION_REFUSED,
        '2153394164': ERROR_INVALID_CERTIFICATE,
        '2152398850': ERROR_BINDING_ABORTED,
        '2147500036': ERROR_ABORTED,
        '2152398919': ERROR_INTERRUPT,
        '401': ERROR_AUTH_REQUIRED,
        '403': ERROR_AUTH_REQUIRED,
        '404': ERROR_RESOURCE_NOT_FOUND,
        '405': ERROR_AUTH_REQUIRED,
        '407': ERROR_AUTH_REQUIRED
    };

    // Maps known error constants to material-icon-ids.
    const ERROR_TYPE_TO_ICON = {};
    // Custom error definitions:
    ERROR_TYPE_TO_ICON[ERROR_DUPLICATE] = 'content_copy';
    ERROR_TYPE_TO_ICON[ERROR_TIMEOUT] = 'hourglass_full';
    ERROR_TYPE_TO_ICON[ERROR_UNSPECIFIED] = 'warning';
    // Request errors:
    ERROR_TYPE_TO_ICON[ERROR_RESOURCE_NOT_FOUND] = 'cloud_off';
    ERROR_TYPE_TO_ICON[ERROR_AUTH_REQUIRED] = 'security';
    // Navigation errors:
    ERROR_TYPE_TO_ICON[ERROR_SERVER_NOT_FOUND] = 'dns';
    ERROR_TYPE_TO_ICON[ERROR_CONNECTION_REFUSED] = 'block';
    ERROR_TYPE_TO_ICON[ERROR_INVALID_CERTIFICATE] = 'no_encryption';
    ERROR_TYPE_TO_ICON[ERROR_BINDING_ABORTED] = 'directions';
    ERROR_TYPE_TO_ICON[ERROR_ABORTED] = 'report';
    ERROR_TYPE_TO_ICON[ERROR_INTERRUPT] = 'report';

    // DOM objects.
    const START = document.getElementById('start');
    const PAUSE = document.getElementById('pause');
    const CANCEL = document.getElementById('cancel');
    const OPTIONS = document.getElementById('options');
    const HELP = document.getElementById('help');
    const APOSTROPHE = document.getElementById('apostrophe');
    const PROGRESS = document.getElementById('progress');
    const PROGRESS_BAR = document.getElementById('progress-bar');
    const STATISTICS = document.getElementById('statistics');
    const STATISTICS_TOTAL = document.getElementById('statistics-total');
    const STATISTICS_IGNORED = document.getElementById('statistics-ignored');
    const STATISTICS_ERRORS = document.getElementById('statistics-errors');
    const FAVICONS = document.getElementById('favicons');
    const FILTERS = document.getElementById('filters');
    const MESSAGES = document.getElementById('messages');
    const MODAL = document.getElementById('modal');
    const MODAL_CANCEL = document.getElementById('modal-cancel');
    const MODAL_CANCEL_CONFIRM = document.getElementById('modal-cancel-confirm');
    const MODAL_CANCEL_CANCEL = document.getElementById('modal-cancel-cancel');
    const MODAL_HELP = document.getElementById('modal-help');
    const MODAL_DELETE = document.getElementById('modal-delete');
    const MODAL_DELETE_CONFIRM = document.getElementById('modal-delete-confirm');
    const MODAL_DELETE_CANCEL = document.getElementById('modal-delete-cancel');

    const POST_LOAD_TIMEOUT = 2000;
    const MIN_WINDOW_WIDTH = 220; // ...to display duration/progress %
    const MESSAGES_MARGIN_TOP = '130px';
    const MESSAGES_MARGIN_TOP_FAVICON_BAR = '170px';

    let startTime;
    let hostWindowId;
    let modalBookmarkId;
    let removalConfirmed = false;

    let filters = [];

    let errors = [];
    let bookmarks = [];
    let folders = {};
    let bookmarksIgnored = [];
    let bookmarksProcessed = {};
    let bookmarksTotal = 0;
    let paused = false;
    let restored = false;

    let urls = {};
    let tabCount = 0;
    let tabRegistry = {}; // tabId => bookmark, tabIdComplete => true/false
    let tabRequestMap = {}; // tabId => requestCount, tabUrl => error
    let timeoutIds = [];

    /**
     * Registers the event-listeners for sidebar controls and sets the icon according to the system theme.
     */
    this.init = function () {
        console.debug('DEBUG: Initializing...');
        setIcon();
        setFilters();
        restoreRun();
        // Start button that initializes the chain of events.
        START.addEventListener('click', start);
        START.addEventListener('mouseenter', () => APOSTROPHE.innerText = 'Start/Resume');
        START.addEventListener('mouseleave', () => APOSTROPHE.innerText = '');

        // Pause button that pauses the chain of events.
        PAUSE.addEventListener('click', pause);
        PAUSE.addEventListener('mouseenter', () => APOSTROPHE.innerText = 'Pause run');
        PAUSE.addEventListener('mouseleave', () => APOSTROPHE.innerText = '');

        // Cancel button that interrupts the chain of events.
        CANCEL.addEventListener('click', () => {
            MODAL.style.display = 'block';
            MODAL_CANCEL.style.display = 'block';
        });
        CANCEL.addEventListener('mouseenter', () => APOSTROPHE.innerText = 'Cancel/discard run');
        CANCEL.addEventListener('mouseleave', () => APOSTROPHE.innerText = '');

        // Confirmation button for canceling a run.
        MODAL_CANCEL_CONFIRM.addEventListener('click', () => {
            PAUSE.style.display = 'none';
            CANCEL.style.display = 'none';
            MODAL.style.display = 'none';
            MODAL_CANCEL.style.display = 'none';
            paused = false;
            cancel();
            reset();
        });

        // Hides warning modal without confirmation.
        MODAL_CANCEL_CANCEL.addEventListener('click', () => {
            MODAL.style.display = 'none';
            MODAL_CANCEL.style.display = 'none';
        });

        // Open help modal.
        HELP.addEventListener('click', () => {
            MODAL.style.display = 'block';
            MODAL_HELP.style.display = 'block';
        });
        HELP.addEventListener('mouseenter', () => APOSTROPHE.innerText = 'Show help');
        HELP.addEventListener('mouseleave', () => APOSTROPHE.innerText = '');

        // Close help modal.
        MODAL_HELP.addEventListener('click', () => {
            MODAL.style.display = 'none';
            MODAL_HELP.style.display = 'none';
        });

        // Link to options page.
        OPTIONS.addEventListener('click', () => {
            browser.runtime.openOptionsPage()
                .then(() => console.info('INFO: Options page opened.'));
        });
        OPTIONS.addEventListener('mouseenter', () => APOSTROPHE.innerText = 'Open preferences');
        OPTIONS.addEventListener('mouseleave', () => APOSTROPHE.innerText = '');

        // Confirmation button for the removal of bookmarks.
        MODAL_DELETE_CONFIRM.addEventListener('click', () => {
            removeBookmark(modalBookmarkId, true);
            MODAL.style.display = 'none';
            MODAL_DELETE.style.display = 'none';
            removalConfirmed = true;
        });

        // Hides warning modal without confirmation.
        MODAL_DELETE_CANCEL.addEventListener('click', () => {
            MODAL.style.display = 'none';
            MODAL_DELETE.style.display = 'none';
        });

        // Hides modals when the user clicks somewhere else.
        window.addEventListener('click', (event) => {
            if (event.target === MODAL) {
                MODAL.style.display = 'none';
                MODAL_CANCEL.style.display = 'none';
                MODAL_HELP.style.display = 'none';
                MODAL_DELETE.style.display = 'none';
            }
        });

        // Avoid that progress/duration information overlaps controls.
        window.addEventListener('resize', () => {
            if (window.innerWidth < MIN_WINDOW_WIDTH) {
                PROGRESS.innerText = '';
            }
        })
    };

    let setIcon = function () {
        const isDarkScheme = window.matchMedia('(prefers-color-scheme: dark)').matches;
        console.info(`INFO: Dark color scheme: ${isDarkScheme}.`);

        browser.sidebarAction.setIcon({
            path: isDarkScheme ? {
                16: '/assets/images/icon-light.svg',
                32: '/assets/images/icon-light.svg'
            } : {
                16: '/assets/images/icon-dark.svg',
                32: '/assets/images/icon-dark.svg'
            }
        }).then(() => console.info('INFO: Icon set.'));
    };

    /**
     * Restores options from local storage or sets default values.
     * @param options {{}} Options map from local storage.
     */
    let setOptions = function (options) {
        TIMEOUT = typeof options.requestTimeout !== 'undefined' ? options.requestTimeout * 1000 : TIMEOUT;
        TIMEOUT_OVERRULE = typeof options.timeoutOverrule !== 'undefined' ? options.timeoutOverrule : TIMEOUT_OVERRULE;
        MAX_TABS = typeof options.maxTabs !== 'undefined' ? options.maxTabs : MAX_TABS;
        IGNORED_DIRS = typeof options.ignoredDirs !== 'undefined' ?
            getOptionsArray(options.ignoredDirs) : IGNORED_DIRS;
        IGNORED_DIRS_ACTIVE = typeof options.ignoredDirsActive !== 'undefined' ?
            options.ignoredDirsActive : IGNORED_DIRS_ACTIVE;
        INCLUDED_DIRS = typeof options.includedDirs !== 'undefined' ?
            getOptionsArray(options.includedDirs) : INCLUDED_DIRS;
        INCLUDED_DIRS_ACTIVE = typeof options.includedDirsActive !== 'undefined' ?
            options.includedDirsActive : INCLUDED_DIRS_ACTIVE;
        IGNORED_URLS = typeof options.ignoredUrls !== 'undefined' ?
            getOptionsArray(options.ignoredUrls) : IGNORED_URLS;
        IGNORED_URLS_ACTIVE = typeof options.ignoredUrlsActive !== 'undefined' ?
            options.ignoredUrlsActive : IGNORED_URLS_ACTIVE;
        SHOW_FAVICONS = typeof options.showFavicons !== 'undefined' ? options.showFavicons : SHOW_FAVICONS;
        TO_LOWERCASE = typeof options.toLowercase !== 'undefined' ? options.toLowercase : TO_LOWERCASE;
        DO_SORT = typeof options.doSort !== 'undefined' ? options.doSort : DO_SORT;
        SORT_UNFILED_BY_DATE = typeof options.sortUnfiledByDate !== 'undefined' ?
            options.sortUnfiledByDate : SORT_UNFILED_BY_DATE;
        CLEAR_CACHE = typeof options.clearCache !== 'undefined' ? options.clearCache : CLEAR_CACHE;
    };

    /**
     * Transforms a comma separated string into an array of options.
     * @param option {string} Raw comma separated string.
     * @returns {string[]} Array of options.
     */
    let getOptionsArray = function (option) {
        return option
            .split(',')
            .map(x => x.trim())
            .filter(x => x !== '');
    };

    /**
     * Activates or deactivates filters for the given errors and sets button style accordingly.
     * @param button {HTMLElement} Button that toggles the filter.
     * @param error {boolean} Type of error that should be filtered or not.
     */
    let toggleFilter = function (button, error) {
        if (button.classList.contains('error')) {
            button.classList.remove('error');
            filters.push(error);
        } else {
            button.classList.add('error');
            filters = filters.filter((filter) => filter !== error);
        }
    }

    /**
     * Creates the UI for filtering errors.
     */
    let setFilters = function () {
        const seen = [];
        const filterButtons = [];
        Object.entries(ERROR_TYPE_TO_ICON).forEach((entry) => {
            const error = entry[1];

            if (!seen.includes(error)) {
                seen.push(error);
                const filterButton = createIcon(error, 'error', '');
                filterButton.classList.add('button');

                filterButton.addEventListener('click', () => {
                    toggleFilter(filterButton, error);
                    createList(errors, true);
                });

                FILTERS.append(filterButton);
                filterButtons.push(filterButton);
            }
        });

        const toggleButton = document.createElement('a');
        toggleButton.append(document.createTextNode('| toggle'));
        toggleButton.classList.add('button');
        toggleButton.addEventListener('click', () => {
            filterButtons.forEach((button) => {
                toggleFilter(button, button.innerText);
                createList(errors, true);
            });
        });
        FILTERS.append(toggleButton);
    };

    /**
     * Resets almost all state members to their initial state.
     */
    let resetState = function () {
        paused = false;
        restored = false;
        folders = {};
        urls = {};
        tabCount = 0;
        tabRegistry = {};
        tabRequestMap = {};
        timeoutIds = [];
    };

    /**
     * Resets bookmark information.
     */
    let resetBookmarks = function () {
        bookmarks = [];
        bookmarksIgnored = [];
        folders = {};
        // Keep information for restored or resumed runs!
        if (!paused && !restored) {
            errors = [];
            bookmarksProcessed = {};
        }
        browser.storage.local.remove(['processed', 'errors'])
            .then(() => console.info('INFO: Removed run from local storage.'));
    };

    /**
     * Resets UI elements.
     */
    let resetUI = function () {
        PROGRESS_BAR.style.width = '0%';
        PROGRESS.innerText = '';
        MESSAGES.innerHTML = '';
        STATISTICS.style.display = 'none';
        FAVICONS.style.display = 'none';
        FAVICONS.innerHTML = '';
        FILTERS.style.display = 'none';
        MESSAGES.style.marginTop = MESSAGES_MARGIN_TOP;
    };

    /**
     * Resets everything.
     */
    let reset = function () {
        resetState();
        resetBookmarks();
        resetUI();
    };

    /**
     * Registers listeners that keep the chain of events going.
     */
    let registerListeners = function () {
        browser.tabs.onRemoved.addListener(onRemoved);
        browser.webNavigation.onCompleted.addListener(onNavigationCompleted);
        browser.webNavigation.onErrorOccurred.addListener(onNavigationError);
        browser.webRequest.onCompleted.addListener(
            onRequestCompleted,
            {urls: ['<all_urls>']}
        );
        browser.webRequest.onAuthRequired.addListener(
            cancelAuth,
            {urls: ['<all_urls>']},
            ["blocking"]
        );
    };

    /**
     * Removes listeners again.
     */
    let removeListeners = function () {
        browser.tabs.onRemoved.removeListener(onRemoved);
        browser.webNavigation.onCompleted.removeListener(onNavigationCompleted);
        browser.webNavigation.onErrorOccurred.removeListener(onNavigationError);
        browser.webRequest.onCompleted.removeListener(onRequestCompleted);
        browser.webRequest.onAuthRequired.removeListener(cancelAuth);
    };

    /**
     * Initializes the chain of events.
     */
    let start = function () {
        startTime = Date.now();

        PAUSE.style.display = 'inline';
        CANCEL.style.display = 'inline';

        browser.storage.local.get()
            .then((storage) => {
                setOptions(storage.options || {});
                const processedCount = Object.keys(bookmarksProcessed).length;
                if (processedCount > 0 && processedCount !== bookmarksTotal) {
                    console.debug('DEBUG: Resuming run...');

                    resetBookmarks();
                    resetState();
                } else {
                    console.debug('DEBUG: New run...');
                    if (processedCount > 0) {
                        reset();
                    }
                    createPlaceholder();
                }

                if (CLEAR_CACHE) {
                    browser.browsingData.removeCache({})
                        .then(() => {
                            console.info('INFO: Cleared cache.');
                            browser.bookmarks.getTree()
                                .then(run);
                        });
                } else {
                    browser.bookmarks.getTree()
                        .then(run);
                }
            });
    }

    /**
     * Pauses a running bookmarks-check. Events are blocked, listeners and timeouts removed, opened tabs closed
     * and errors are stored before state is reset.
     */
    let pause = function () {
        paused = true;
        PAUSE.style.display = 'none';
        cancel();
        storeRun();
    };

    /**
     * Cancels a running bookmarks-check. Events are blocked, listeners and timeouts removed and opened tabs closed.
     */
    let cancel = function () {
        removeListeners();

        timeoutIds.forEach((id) => {
            clearTimeout(id);
        });

        Object.keys(tabRegistry).forEach((id) => {
            if (!id.endsWith('Complete')) {
                browser.tabs.remove(parseInt(id));
            }
        });
    };

    /**
     * Finishing touches after all bookmarks are processed;
     */
    let finish = function () {
        console.debug('DEBUG: Finishing...');
        storeRun();
        removeListeners();
        resetState();

        PAUSE.style.display = 'none';
        if (SHOW_FAVICONS) {
            FAVICONS.style.display = 'none';
            MESSAGES.style.marginTop = MESSAGES_MARGIN_TOP;
        }

        let endTime = Date.now();
        if (window.innerWidth > MIN_WINDOW_WIDTH && endTime - startTime < 1000 * 60 * 60 * 24) {
            // If the sidebar is to narrow the duration would overlap the controls.
            // This simple ms-conversion only works for durations shorter than one day.
            setTimeout(() => {
                PROGRESS.innerText = new Date(endTime - startTime)
                    .toUTCString()
                    .slice(17, 25);
            }, POST_LOAD_TIMEOUT);
        }
    };

    /**
     * Cancels request with authentication.
     * @param details {{}}
     * @return {{cancel: boolean}}
     */
    let cancelAuth = function (details) {
        console.info(`WARN: Canceling authentication for request: ${details.url};`);
        tabRequestMap[details.url] = ERROR_AUTH_REQUIRED;

        return {cancel: true};
    };

    /**
     * Initializes the chain of events by collecting bookmark-information and loading the first batch of bookmarks.
     * The batch-size is dependent on the configured maximum number of tabs.
     * @param tree {browser.bookmarks.BookmarkTreeNode}
     */
    let run = function (tree) {
        bookmarksTotal = 0;
        folders = {};
        // Collect bookmark-information
        walk(tree[0], '/');

        if (DO_SORT) {
            console.info(`INFO: Sorting... Unfiled by date: ${SORT_UNFILED_BY_DATE}`);
            sort();
        }

        FILTERS.style.display = 'block';
        setStatistics();
        setProgress();
        registerListeners();

        browser.windows.getCurrent()
            .then((window) => {
                // Open tabs only in the window the extension was started i n!
                hostWindowId = window.id;

                while (tabCount < MAX_TABS && bookmarks.length > 0) {
                    loadBookmark();
                }
            }, (error) => {
                console.error(`ERROR: Could not get window id: ${error};`);
            });
    };

    /**
     * Recursively traverses bookmark-folders.
     * @param treeItem {browser.bookmarks.BookmarkTreeNode}
     * @param path {string} Path to the currently processed bookmark-folder.
     */
    let walk = function (treeItem, path) {
        if (DO_SORT && treeItem.parentId && treeItem.parentId !== 'root________' && (treeItem.url || treeItem.children)) {
            if (!(treeItem.parentId in folders)) {
                folders[treeItem.parentId] = [treeItem];
            } else {
                folders[treeItem.parentId].push(treeItem);
            }
        }

        if (treeItem.url && treeItem.url.startsWith('http')) {
            bookmarksTotal++;
            if ((IGNORED_URLS_ACTIVE && isIgnored(treeItem.url, IGNORED_URLS)) ||
                (IGNORED_DIRS_ACTIVE && isIgnored(path, IGNORED_DIRS)) ||
                (INCLUDED_DIRS_ACTIVE && !isIgnored(path, INCLUDED_DIRS))) {
                // The bookmark or currently processed folder is ignored.
                bookmarksIgnored.push(treeItem.id);
            } else if (!(treeItem.id in bookmarksProcessed)) {
                // Format
                if (TO_LOWERCASE) {
                    browser.bookmarks.update(treeItem.id, {title: treeItem.title.toLowerCase()});
                }

                treeItem['path'] = path.replace(/(^\/\/|\/$)/g, '').toLowerCase();

                if (treeItem.url in urls) {
                    // Bookmark is duplicated.
                    reportError(treeItem, ERROR_DUPLICATE);
                    bookmarksProcessed[treeItem.id] = true;
                } else {
                    // Store urls for duplicate-check.
                    urls[treeItem.url] = true;
                    bookmarks.push(treeItem);
                }
            }
        } else if (treeItem.children) {
            // In order to get statistics recurse into the folder even if it is ignored!
            treeItem.children.forEach((child) => {
                walk(child, path + treeItem.title + '/');
            });
        }
    };

    /**
     * Sort function that sorts alphanumeric and folders before bookmarks. Unfiled (other) bookmarks are sorted by date.
     * @param a {browser.bookmarks.BookmarkTreeNode} Node for sorting.
     * @param b {browser.bookmarks.BookmarkTreeNode} Node for sorting.
     * @returns {number} Result for sorting.
     */
    let sortCompare = function (a, b) {
        let result = 0;
        if (a.children && !b.children) {
            result = -1;
        } else if (!a.children && b.children) {
            result = 1;
        } else if (SORT_UNFILED_BY_DATE && a.parentId === 'unfiled_____') {
            result = a.dateAdded - b.dateAdded;
        }

        return result === 0 ? a.title.localeCompare(b.title) : result;
    }

    /**
     * Sorts bookmarks by title.
     */
    let sort = function () {
        Object.entries(folders).forEach((entry) => {
            entry[1].sort(sortCompare).forEach((bookmark, index) => {
                browser.bookmarks.move(bookmark.id, {parentId: bookmark.parentId, index: index});
            })
        });

    };

    /**
     * Checks if a bookmark should be ignored. Its called for checking folder and url separately.
     * @param pathOrUrl {string} Path to the bookmark or its url.
     * @param ignoreArray {string[]} Array of ignored (partial) paths or urls.
     * @returns {boolean}
     */
    let isIgnored = function (pathOrUrl, ignoreArray) {
        return pathOrUrl !== '' && ignoreArray.some((x) => {
            return pathOrUrl.toLowerCase().includes(x.toLowerCase());
        });
    };

    /**
     * Creates a new tab and loads the next bookmark from the stack. It also sets the procedure which is called on
     * timeout.
     */
    let loadBookmark = function () {
        tabCount++;
        let bookmark = bookmarks.shift();

        browser.tabs.create({url: bookmark.url, windowId: hostWindowId, active: false})
            .then((tab) => {
                tabRegistry[tab.id] = bookmark;

                timeoutIds.push(setTimeout(() => {
                    onTimeout(tab);
                }, TIMEOUT));
            }, (error) => {
                tabCount--;
                console.error(`ERROR: Could not create tab: ${error};`);
            });
    };

    /**
     * Identifies several common HTTP errors and counts successful sub-requests while loading a bookmark.
     * @param details {{}} Details from {browser.webRequest.onCompleted}.
     */
    let onRequestCompleted = function (details) {
        if (details.tabId in tabRegistry || details.tabId === -1) {
            if (details.type === 'main_frame' && details.statusCode >= 400) {
                if (details.statusCode in ERROR_CODES_TO_TYPE) {
                    console.warn(`WARN: HTTP error: ${details.statusCode} tab: ${details.tabId} url: ${details.url}`);
                    handleRequestError(details, ERROR_CODES_TO_TYPE[details.statusCode]);
                } else {
                    // >= 500 or some other 40x...
                    console.error(`ERROR: HTTP error: ${details.statusCode} tab: ${details.tabId} url: ${details.url}`);
                    handleRequestError(details, ERROR_UNSPECIFIED);
                }
            } else if (details.statusCode >= 200 && details.statusCode < 300) {
                // Count successful requests while loading!
                if (details.tabId in tabRequestMap) {
                    tabRequestMap[details.tabId] += 1;
                } else {
                    tabRequestMap[details.tabId] = 1;
                }
            }
        }
    };

    /**
     * Checks if a bookmark is loaded completely or has produced errors and dispatches to success- and error-handlers.
     * @param details {{}} Details from {browser.webRequest.onCompleted}.
     */
    let onNavigationCompleted = function (details) {
        if (details.tabId in tabRegistry) {
            if (details.url in tabRequestMap) {
                // HTTP error detected in onRequestCompleted but tabId was -1.
                handleError(details.tabId, tabRequestMap[details.url]);
            } else {
                browser.tabs.get(details.tabId)
                    .then((tab) => {
                        const tabCompleteKey = tab.id + 'Complete';
                        if (tab.status === 'complete' && !(tabCompleteKey in tabRegistry)) {
                            // Sometimes a tab reports "status complete" twice?
                            tabRegistry[tabCompleteKey] = true;
                            handleSuccess(tab);
                        }
                    });
            }
        }
    };

    /**
     * Identifies several known navigation errors.
     * @param details {{}} Details from {browser.webRequest.onNavigationError}.
     */
    let onNavigationError = function (details) {
        if (details.tabId in tabRegistry) {
            const errorCode = details.error.replace('Error code ', '');

            if (errorCode in ERROR_CODES_TO_TYPE) {
                let errorType = ERROR_CODES_TO_TYPE[errorCode];
                // override if canceled by extension (for example cancelAuth).
                if (details.url in tabRequestMap) {
                    errorType = tabRequestMap[details.url];
                }
                // Capitalize and remove underline characters!
                let errorString = (errorType.charAt(0).toUpperCase() + errorType.slice(1)).replace(/_/g, ' ');
                let bookmark = tabRegistry[details.tabId];

                if (details.frameId === 0) {
                    // Main frame...
                    handleError(details.tabId, errorType);
                    console.warn(`WARN: ${errorString}; bookmark: ${bookmark.title}; request: ${details.url};`);
                } else {
                    // Sub-requests are more likely to be aborted by content-blockers.
                    errorString = errorString.replace('Redirect', 'Aborted/redirected');
                    console.info(`INFO: ${errorString}; bookmark: ${bookmark.title}; request: ${details.url};`);
                }
            } else {
                // Unknown
                console.error(`ERROR: Unknown navigation error: ${JSON.stringify(details)};`);
            }
        }
    };

    /**
     * After a tab is removed, ie the bookmark was loaded successfully or not, statistics and state are updated.
     * @param tabId {number} Id of the removed tab.
     */
    let onRemoved = function (tabId) {
        if (!paused && tabId in tabRegistry) {
            bookmarksProcessed[tabRegistry[tabId].id] = true;
            delete tabRegistry[tabId];
            tabCount--;

            setProgress();

            if (bookmarks.length + tabCount === 0) {
                finish();
            } else if (bookmarks.length > 0) {
                loadBookmark();
            }
        }
    };

    /**
     * Removes a tab on timeout and decides if the bookmark is considered to be broken, based on successful requests.
     * @param tab {browser.tabs.Tab} that timed out.
     */
    let onTimeout = function (tab) {
        const tabCompleteKey = tab.id + 'Complete';
        if (tab.id in tabRegistry && !(tabCompleteKey in tabRegistry)) {
            if (!(tab.id in tabRequestMap && tabRequestMap[tab.id] > TIMEOUT_OVERRULE)) {
                handleError(tab.id, ERROR_TIMEOUT);
            } else {
                tabRegistry[tabCompleteKey] = false;
                let bookmark = tabRegistry[tab.id];
                let responses = tabRequestMap[tab.id];
                console.info(`INFO: Timeout overruled; ${responses} successful requests; bookmark: ${bookmark.url};`);
                handleSuccess(tab);
            }
        }
    };

    /**
     * Removes the successfully loaded tab and displays its favicon - if present.
     * @param tab {browser.tabs.Tab} Successfully loaded tab.
     */
    let handleSuccess = function (tab) {
        if (SHOW_FAVICONS && tab.favIconUrl) {
            setFavicon(tab.favIconUrl);
        }
        timeoutIds.push(setTimeout(() => {
            browser.tabs.remove(tab.id);
        }, POST_LOAD_TIMEOUT));
    };

    /**
     * Initializes the chain of events that is followed by errors while loading a bookmark. This includes reporting and
     * removing the tab. On redirection "errors" the tab is not removed.
     * @param tabId {number} Id of the tab where the error occurred.
     * @param error {string} Type of error.
     */
    let handleError = function (tabId, error) {
        let unverifiedBookmark = tabRegistry[tabId];

        if (unverifiedBookmark) {
            // Keep on loading on redirect. The tab is likely to complete successfully.
            if (error !== ERROR_BINDING_ABORTED) {
                browser.tabs.remove(tabId);
            }
            reportError(unverifiedBookmark, error);
        }
    };

    /**
     * Handles request errors where the corresponding tab id is known or unknown (-1).
     * @param details {{}} Details from {browser.webRequest.onCompleted}.
     * @param error {string} Type of error.
     */
    let handleRequestError = function (details, error) {
        // Url-error-relation might be need by onNavigationCompleted if the tab id is -1.
        tabRequestMap[details.url] = error;
        if (details.tabId !== -1) {
            handleError(details.tabId, error);
        }
    };

    /**
     * Temporarily stores errors and appends an error message to the messages-list of the UI.
     * @param bookmark {browser.bookmarks.BookmarkTreeNode} Invalid bookmark.
     * @param error {string} Type of error.
     */
    let reportError = function (bookmark, error) {
        errors.push({
            bookmark: {
                id: bookmark.id,
                title: bookmark.title,
                url: bookmark.url,
                path: bookmark.path
            },
            error: error
        });

        if (!filters.includes(ERROR_TYPE_TO_ICON[error])) {
            createListEntry(bookmark, error);
        }
        setStatistics();
    };

    /**
     * Creates an empty error-list row to allow tooltips above the first regular error-entry.
     */
    let createPlaceholder = function () {
        const placeholder = document.createElement('div');
        placeholder.className = 'message-container';
        MESSAGES.append(placeholder);
    };

    /**
     * Creates the error list from existing errors.
     * @param existingErrors {[{bookmark: browser.bookmarks.BookmarkTreeNode, error: string}]} Error storage to use
     * @param uiOnly {boolean} If set to true the error is not added to the internal list of errors.
     * Filters are applied to the
     * UI only.
     */
    let createList = function (existingErrors, uiOnly) {
        MESSAGES.innerHTML = '';
        createPlaceholder();

        existingErrors.forEach((error) => {
            if (!filters.includes(ERROR_TYPE_TO_ICON[error.error])) {
                if (uiOnly) {
                    createListEntry(error.bookmark, error.error);
                } else {
                    reportError(error.bookmark, error.error);
                }
            }
        });
    };

    /**
     * Creates an entry for the given error.
     * @param bookmark {browser.bookmarks.BookmarkTreeNode} Invalid bookmark.
     * @param error {string} Type of error.
     */
    let createListEntry = function (bookmark, error) {
        const messageContainer = document.createElement('div');
        messageContainer.id = bookmark.id;
        messageContainer.className = 'message-container';

        const message = document.createElement('div');
        message.className = 'message';
        message.append(createActionIcons(bookmark));
        message.append(createIcon('folder_open', '', '/' + bookmark.path));
        message.append(createIcon(ERROR_TYPE_TO_ICON[error], 'error', error.replace(/_/g, ' ')));
        message.append(document.createTextNode(bookmark.title.toLowerCase()));

        messageContainer.append(message);

        MESSAGES.append(messageContainer);
    };

    /**
     * Creates action icons for an invalid bookmark.
     * @param bookmark {browser.bookmarks.BookmarkTreeNode}
     * @returns {HTMLElement}
     */
    let createActionIcons = function (bookmark) {
        const actionContainer = document.createElement('span');

        const deleteFromBookmarksIcon = createIcon('delete', 'button', 'delete bookmark');
        deleteFromBookmarksIcon.addEventListener('click', () => {
            if (removalConfirmed) {
                removeBookmark(bookmark.id, true);
            } else {
                modalBookmarkId = bookmark.id;
                MODAL.style.display = 'block';
                MODAL_DELETE.style.display = 'block';
                MODAL_HELP.style.display = 'none';
            }
        });
        actionContainer.append(deleteFromBookmarksIcon);

        const deleteFromListIcon = createIcon('check_circle', 'button', 'checked; remove from list');
        deleteFromListIcon.addEventListener('click', () => {
            removeBookmark(bookmark.id, false);
        });
        actionContainer.append(deleteFromListIcon);

        const launchIcon = createIcon('launch', 'button', 'launch in a new tab');
        launchIcon.addEventListener('click', () => {
            browser.tabs.create({url: bookmark.url, index: 1})
                .then((tab) => {
                    const saveIcon = createIcon('save', 'button', 'update with url of launched tab');
                    saveIcon.addEventListener('click', () => {
                        browser.tabs.get(tab.id)
                            .then((loadedTab) => {
                                browser.bookmarks.update(bookmark.id, {url: loadedTab.url})
                                    .then(() => {
                                        setTempClass(saveIcon, 'success');
                                        console.info(`INFO: Updated ${bookmark.title} to ${loadedTab.url};`);
                                    }, (error) => {
                                        setTempClass(saveIcon, 'error');
                                        console.error(`ERROR: Could not update ${bookmark.title}: ${error};`);
                                    });
                            });
                    });
                    launchIcon.remove();
                    actionContainer.append(saveIcon);
                });
        });
        actionContainer.append(launchIcon);

        return actionContainer;
    };

    /**
     * Creates tooltip icons for error types or simple icons for actions.
     * @param iconId {string} Id of the material icon.
     * @param cssClass {string} (Optional) Additional CSS class
     * @param tooltip {string} (Optional) Tooltip for the icon.
     * @returns {HTMLElement}
     */
    let createIcon = function (iconId, cssClass, tooltip) {
        let icon;

        const simpleIcon = document.createElement('i');
        simpleIcon.classList = 'material-icons icon';
        simpleIcon.append(document.createTextNode(iconId));

        if (cssClass && cssClass !== '') {
            simpleIcon.classList.add(cssClass);
        }

        if (tooltip) {
            const tooltipIconContainer = document.createElement('div');
            const tooltipTextContainer = document.createElement('span');
            const tooltipText = document.createTextNode(tooltip);

            tooltipIconContainer.className = 'tooltip-container';
            tooltipTextContainer.className = 'tooltip-text';

            tooltipTextContainer.append(tooltipText);

            tooltipIconContainer.append(simpleIcon);
            tooltipIconContainer.append(tooltipTextContainer);

            icon = tooltipIconContainer;
        } else {
            icon = simpleIcon;
        }

        return icon;
    };

    /**
     * Temporarily sets the given CSS class
     * @param element {HTMLElement} Element where the class should be set.
     * @param cssClass {string} Name of the class to set.
     */
    let setTempClass = function (element, cssClass) {
        element.classList.add(cssClass);

        timeoutIds.push(setTimeout(() => {
            element.classList.remove(cssClass);
        }, 2000));
    };

    /**
     * Updates progress information.
     */
    let setProgress = function () {
        const processedCount = Object.keys(bookmarksProcessed).length;
        const percent = Math.round(processedCount / (bookmarksTotal - bookmarksIgnored.length) * 100) + '%';
        PROGRESS_BAR.style.width = percent;
        if (window.innerWidth > MIN_WINDOW_WIDTH) {
            PROGRESS.innerText = percent;
        }
    };

    /**
     * Displays statistics for scanned bookmarks (total, ignored, problems).
     */
    let setStatistics = function () {
        STATISTICS.style.display = 'block';
        STATISTICS_TOTAL.innerText = bookmarksTotal;
        STATISTICS_IGNORED.innerText = bookmarksIgnored.length + '';
        STATISTICS_ERRORS.innerText = errors.length + '';
    };

    /**
     * Displays a favicon beyond the progress bar for limited period of time.
     * @param favIconUrl {string} Source of the favicon
     */
    let setFavicon = function (favIconUrl) {
        // preload
        const image = new Image();
        image.src = favIconUrl;

        const favIcon = document.createElement('img');
        favIcon.src = image.src;
        favIcon.alt = '';
        favIcon.className = 'favicon';
        favIcon.crossOrigin = 'anonymous';
        FAVICONS.prepend(favIcon);
        FAVICONS.style.display = 'block';
        MESSAGES.style.marginTop = MESSAGES_MARGIN_TOP_FAVICON_BAR;
    };

    /**
     * Removes a bookmark from the UI list or permanently (from the profile).
     * @param id {string} Id of the bookmark that is to be removed.
     * @param permanently {boolean} Flag to indicate whether the bookmark should be removed permanently.
     */
    let removeBookmark = function (id, permanently) {
        if (permanently) {
            browser.bookmarks.remove(id)
                .then(() => {
                    bookmarksTotal--;
                    delete bookmarksProcessed[id];
                    hideBookmark(id);
                }, (error) => {
                    // After a reported redirection another error may occur for the same bookmark which results in
                    // two entries in the UI.
                    console.warn(`WARNING: Could not remove bookmark ${id}: ${error}; Already removed before?`);
                });
        } else {
            hideBookmark(id);
        }
    };

    /**
     * Hides a bookmark from the UI list and updates statistics.
     * @param id {string} Id of the bookmark that is to be removed.
     */
    let hideBookmark = function (id) {
        document.getElementById(id).remove();
        errors = errors.filter((error) => error.bookmark.id !== id);
        setStatistics();
    };

    /**
     * Stores run bookmarks in local storage.
     */
    let storeRun = function () {
        browser.storage.local.set({
            total: bookmarksTotal,
            ignored: bookmarksIgnored,
            processed: bookmarksProcessed,
            errors: errors
        }).then(() => console.info('INFO: Stored run in local storage.'));
    }

    /**
     * Restores run from local storage - if available.
     */
    let restoreRun = function () {
        browser.storage.local.get()
            .then((storage) => {
                if (storage.processed && Object.keys(storage.processed).length > 0) {
                    console.debug('DEBUG: Restoring run...');
                    console.debug(storage.processed, storage.errors);

                    restored = true;
                    bookmarksTotal = storage.total;
                    bookmarksIgnored = storage.ignored;
                    bookmarksProcessed = storage.processed;

                    CANCEL.style.display = 'inline';
                    STATISTICS.style.display = 'block';
                    FILTERS.style.display = 'block';

                    createList(storage.errors, false);
                    setProgress();
                    setStatistics();
                }
            });
    }
}

const checkmarksSidebar = new CheckmarksSidebar();
checkmarksSidebar.init();
