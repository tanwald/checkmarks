/**
 * Class for the sidebar action.
 * @constructor
 */
function RemarksSidebar() {

    // Default options for convenient access.
    let TIMEOUT = RE_DEFAULTS.getTimeout() * 1000;
    let TIMEOUT_OVERRULE = RE_DEFAULTS.getTimeoutOverrule();
    let MAX_TABS = RE_DEFAULTS.getMaxTabs();
    let IGNORED_DIRS = RE_DEFAULTS.getIgnoredDirs();
    let IGNORED_URLS = RE_DEFAULTS.getIgnoredUrls();
    let SHOW_FAVICONS = RE_DEFAULTS.getShowFavicons();
    let TO_LOWERCASE = RE_DEFAULTS.getToLowercase();

    // Constants for error-mapping and tooltips.
    const ERROR_RESOURCE_NOT_FOUND = 'resource_not_found';
    const ERROR_AUTH_REQUIRED = 'authentication_required';
    const ERROR_INVALID_CERTIFICATE = 'invalid_certificate';
    const ERROR_TIMEOUT = 'timeout';
    const ERROR_DUPLICATE = 'duplicate';
    const ERROR_BINDING_ABORTED = 'binding_aborted';
    const ERROR_ABORTED = 'aborted';
    const ERROR_CONNECTION_REFUSED = 'connection_refused';
    const ERROR_SERVER_NOT_FOUND = 'server_not_found';
    const ERROR_INTERRUPT = 'connection_interrupted';

    const REPORT_NAV_ERRORS = [
        ERROR_INVALID_CERTIFICATE,
        ERROR_SERVER_NOT_FOUND,
        ERROR_CONNECTION_REFUSED
    ];

    const REPORT_AUTH_ERRORS = [
        401,
        405,
        407
    ];

    // Error codes provided by the web-extensions API.
    const ERROR_CODES_TO_TYPE = {
        '2153394164': ERROR_INVALID_CERTIFICATE,
        '2152398850': ERROR_BINDING_ABORTED, // redirects?
        '2147500036': ERROR_ABORTED, // redirects?
        '2152398861': ERROR_CONNECTION_REFUSED,
        '2152398878': ERROR_SERVER_NOT_FOUND,
        '2152398919': ERROR_INTERRUPT
    };

    // Maps known error constants to material-icon-ids.
    const ERROR_TYPE_TO_ICON = {};
    ERROR_TYPE_TO_ICON[ERROR_RESOURCE_NOT_FOUND] = 'cloud_off';
    ERROR_TYPE_TO_ICON[ERROR_AUTH_REQUIRED] = 'security';
    ERROR_TYPE_TO_ICON[ERROR_CONNECTION_REFUSED] = 'block';
    ERROR_TYPE_TO_ICON[ERROR_SERVER_NOT_FOUND] = 'directions';
    ERROR_TYPE_TO_ICON[ERROR_ABORTED] = 'forward';
    ERROR_TYPE_TO_ICON[ERROR_BINDING_ABORTED] = 'forward';
    ERROR_TYPE_TO_ICON[ERROR_INVALID_CERTIFICATE] = 'no_encryption';
    ERROR_TYPE_TO_ICON[ERROR_TIMEOUT] = 'hourglass_full';
    ERROR_TYPE_TO_ICON[ERROR_DUPLICATE] = 'content_copy';

    // DOM objects.
    const START = document.getElementById('start');
    const CANCEL = document.getElementById('cancel');
    const OPTIONS = document.getElementById('options');
    const PROGRESS = document.getElementById('progress');
    const PROGRESS_BAR = document.getElementById('progress-bar');
    const STATS = document.getElementById('stats');
    const FAVICONS = document.getElementById('favicons');
    const MESSAGES = document.getElementById('messages');
    const MODAL = document.getElementById('modal');
    const MODAL_CONFIRM = document.getElementById('modal-confirm');
    const MODAL_CANCEL = document.getElementById('modal-cancel');

    const POST_LOAD_TIMEOUT = 2000;

    let bookmarks = [];
    let urls = {};
    let bookmarksIgnored = [];
    let bookmarksToProcess = 0;
    let bookmarksProcessed = 0;
    let errorCount = 0;
    let tabCount = 0;
    let tabRegistry = {};
    let tabRequestMap = {};
    let timeoutIds = [];
    let modalBookmarkId = -1;
    let removalConfirmed = false;

    /**
     * Registers the event-listeners for the sidebar controls.
     */
    this.init = function () {
        // Start button that initializes the chain of events.
        START.addEventListener('click', () => {
            browser.storage.local.get()
                .then((options) => {

                    setOptions(options);
                    resetState();

                    browser.bookmarks.getTree()
                        .then(run);
                });
        });

        // Cancel button that interrupts the chain of events.
        CANCEL.addEventListener('click', () => {
            cancel();
        });

        // Link to Options page
        OPTIONS.addEventListener('click', () => {
            browser.runtime.openOptionsPage();
        });

        // Confirmation button for the removal of bookmarks.
        MODAL_CONFIRM.addEventListener('click', () => {
            removeBookmark(modalBookmarkId, true);
            MODAL.style.display = 'none';
            removalConfirmed = true;
        });

        // Hides confirmation dialog for the removal of bookmarks.
        MODAL_CANCEL.addEventListener('click', () => {
            MODAL.style.display = 'none';
        });

        // Hides confirmation dialog for the removal of bookmarks when the user clicks somewhere else.
        window.addEventListener('click', (event) => {
            if (event.target === MODAL) {
                MODAL.style.display = 'none';
            }
        });
    };

    /**
     * Restores options from local storage or sets default values.
     * @param options Options map from local storage.
     */
    let setOptions = function (options) {
        TIMEOUT = typeof options.requestTimeout !== 'undefined' ? options.requestTimeout * 1000 : TIMEOUT;
        TIMEOUT_OVERRULE = typeof options.timeoutOverrule !== 'undefined' ? options.timeoutOverrule : TIMEOUT_OVERRULE;
        MAX_TABS = typeof options.maxTabs !== 'undefined' ? options.maxTabs : MAX_TABS;
        IGNORED_DIRS = typeof options.ignoredDirs !== 'undefined' ? getOptionsArray(options.ignoredDirs) : IGNORED_DIRS;
        IGNORED_URLS = typeof options.ignoredUrls !== 'undefined' ? getOptionsArray(options.ignoredUrls) : IGNORED_URLS;
        SHOW_FAVICONS = typeof options.showFavicons !== 'undefined' ? options.showFavicons : SHOW_FAVICONS;
        TO_LOWERCASE = typeof options.toLowercase !== 'undefined' ? options.toLowercase : TO_LOWERCASE;
    };

    /**
     * Resets some UI elements and almost all state members to their initial state.
     */
    let resetState = function () {
        PROGRESS_BAR.style.width = '0%';
        PROGRESS.innerHTML = '';
        MESSAGES.innerHTML = '';
        MESSAGES.style.marginTop = '100px';
        STATS.style.display = 'none';
        FAVICONS.style.display = 'none';
        FAVICONS.innerHTML = '';

        bookmarks = [];
        urls = {};
        bookmarksIgnored = [];
        bookmarksToProcess = 0;
        bookmarksProcessed = 0;
        errorCount = 0;
        tabCount = 0;
        tabRegistry = {};
        tabRequestMap = {};
        timeoutIds = [];
    };

    /**
     * Registers listener that keep the chain of events going.
     */
    let registerListeners = function () {
        browser.tabs.onRemoved.addListener(onRemoved);
        browser.webNavigation.onCompleted.addListener(onNavigationCompleted);
        browser.webNavigation.onErrorOccurred.addListener(onNavigationError);
        browser.webRequest.onCompleted.addListener(
            onRequestCompleted,
            {urls: ['<all_urls>']}
        );
    };

    /**
     * Reverts RemarksSidebar.registerListeners.
     */
    let removeListeners = function () {
        browser.tabs.onRemoved.removeListener(onRemoved);
        browser.webNavigation.onCompleted.removeListener(onNavigationCompleted);
        browser.webNavigation.onErrorOccurred.removeListener(onNavigationError);
        browser.webRequest.onCompleted.removeListener(onRequestCompleted);
    };

    /**
     * Cancels a running bookmarks check. Events are blocked, listeners and timeouts removed and opened tabs closed.
     */
    let cancel = function () {
        removeListeners();
        timeoutIds.forEach((id) => {
            clearTimeout(id);
        });
        Object.keys(tabRegistry).forEach((id) => {
            if (!id.endsWith('complete')) {
                browser.tabs.remove(parseInt(id));
            }
        });
        resetState();
    };

    /**
     * Initializes the chain of events by collecting bookmark-information and fetching the first number of bookmarks
     * depending on the maximum number of tabs.
     * @param tree {browser.bookmarks.BookmarkTreeNode}
     */
    let run = function (tree) {
        walk(tree[0], '/');

        bookmarksToProcess = bookmarks.length;
        setStats();
        registerListeners();

        while (tabCount < MAX_TABS && bookmarks.length > 0) {
            loadBookmark();
        }
    };

    /**
     * Recursively traverse bookmark folders.
     * @param treeItem {browser.bookmarks.BookmarkTreeNode}
     * @param path Path to the currently process bookmark folder.
     */
    let walk = function (treeItem, path) {
        if (treeItem.url && treeItem.url.startsWith('http')) {
            // Format
            if (TO_LOWERCASE) {
                browser.bookmarks.update(treeItem.id, {title: treeItem.title.toLowerCase()});
            }
            if (isIgnored(treeItem.url, IGNORED_URLS) || isIgnored(path, IGNORED_DIRS)) {
                // Bookmark or the currently processes folder is ignored.
                // Maybe retrieve information of ignored bookmarks?
                bookmarksIgnored.push(treeItem);
            } else if (treeItem.url in urls) {
                // Bookmark is duplicated.
                reportDuplicate(treeItem);
            } else {
                // Store urls for duplicate-check.
                urls[treeItem.url] = true;
                bookmarks.push(treeItem);
            }
        } else if (typeof treeItem.children !== 'undefined') {
            // Recurse into folder even if it is ignored to get the statistics.
            treeItem.children.forEach((child) => {
                walk(child, path + treeItem.title + '/');
            });
        }
    };

    /**
     * Checks if a bookmark should be ignored. Its called for checking folder and url separately.
     * @param pathOrUrl Path to the bookmark of its url.
     * @param ignoreArray Array of ignored paths or urls.
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
        browser.tabs.create({url: bookmark.url})
            .then((tab) => {
                tabRegistry[tab.id] = bookmark;
                timeoutIds.push(setTimeout(() => {
                    onTimeout(tab);
                }, TIMEOUT));
            }, (error) => {
                tabCount--;
                console.log(`ERROR: Could not create tab: ${error}`);
            });
    };

    /**
     * Identifies several HTTP errors and counts successful sub-requests while loading a bookmark.
     * @param details Details from {browser.webRequest.onCompleted}.
     */
    let onRequestCompleted = function (details) {
        if (details.type === 'main_frame' && details.statusCode >= 400) {
            if (REPORT_AUTH_ERRORS.includes(details.statusCode)) {
                // Auth required.
                handleError(details.tabId, ERROR_AUTH_REQUIRED);
            } else {
                // Most likely 404, resource not available (anymore).
                handleError(details.tabId, ERROR_RESOURCE_NOT_FOUND);
            }
        } else if (details.tabId in tabRegistry && details.statusCode === 200) {
            // Count successful requests during load.
            if (details.tabId in tabRequestMap) {
                tabRequestMap[details.tabId] += 1;
            } else {
                tabRequestMap[details.tabId] = 1;
            }

        }
    };

    /**
     * Checks if a bookmark is loaded completely and removes the tab it was loaded into.
     * @param details Details from {browser.webRequest.onNavigationCompleted}.
     */
    let onNavigationCompleted = function (details) {
        browser.tabs.get(details.tabId)
            .then((tab) => {
                const tabCompleteKey = tab.id + 'complete';
                if (tab.status === 'complete' && !(tabCompleteKey in tabRegistry)) {
                    tabRegistry[tabCompleteKey] = true;
                    handleSuccess(tab);
                }
            });
    };

    /**
     * Identifies several known connection errors.
     * @param details Details from {browser.webRequest.onNavigationError}.
     */
    let onNavigationError = function (details) {
        const errorCode = details.error.replace('Error code ', '');

        if (errorCode in ERROR_CODES_TO_TYPE) {
            let errorType = ERROR_CODES_TO_TYPE[errorCode];

            if (details.frameId === 0 && REPORT_NAV_ERRORS.includes(errorType)) {
                handleError(details.tabId, errorType);
            } else {
                // aborted
                let bookmark = tabRegistry[details.tabId];
                let error = errorType.replace(/_/g, ' ');
                console.log(`WARNING: ${error} Bookmark: ${bookmark.url} Request: ${details.url}`);
            }
        } else {
            // Unknown
            console.log(`SEVERE: ${JSON.stringify(details)}`);
        }
    };

    /**
     * After a tab is removed, ie the bookmark was successfully loaded or not, statistics and state is updated.
     * @param tabId Id of the removed tab.
     */
    let onRemoved = function (tabId) {
        if (tabId in tabRegistry) {
            delete tabRegistry[tabId];

            bookmarksProcessed++;
            tabCount--;

            let percent = Math.round(bookmarksProcessed / bookmarksToProcess * 100) + '%';
            PROGRESS_BAR.style.width = percent;
            PROGRESS.innerHTML = percent;

            if (bookmarksProcessed === bookmarksToProcess) {
                removeListeners();
                if (SHOW_FAVICONS) {
                    FAVICONS.style.display = 'none';
                    MESSAGES.style.marginTop = '100px';
                }
            } else if (bookmarks.length > 0) {
                loadBookmark();
            }
        }
    };

    /**
     * Removes a tab on timeout and decides if the bookmark is considered to be broken based on successful requests.
     * @param tab {tabs.Tab} that timed out.
     */
    let onTimeout = function (tab) {
        const tabCompleteKey = tab.id + 'complete';
        if (tab.id in tabRegistry && !(tabCompleteKey in tabRegistry)) {
            if (!(tab.id in tabRequestMap && tabRequestMap[tab.id] > TIMEOUT_OVERRULE)) {
                handleError(tab.id, ERROR_TIMEOUT);
            } else {
                tabRegistry[tabCompleteKey] = false;
                let bookmark = tabRegistry[tab.id];
                let responses = tabRequestMap[tab.id];
                console.log(`INFO: Timeout overruled. ${responses} successful requests. Bookmark: ${bookmark.url}`);
                handleSuccess(tab);
            }
        }
    };

    /**
     * Removes the successfully loaded tab and displays its favicon - if any.
     * @param tab {tabs.Tab} Successfully loaded tab.
     */
    let handleSuccess = function (tab) {
        if (SHOW_FAVICONS && typeof tab.favIconUrl !== 'undefined') {
            setFavicon(tab.favIconUrl);
        }
        timeoutIds.push(setTimeout(() => {
            browser.tabs.remove(tab.id);
        }, POST_LOAD_TIMEOUT));
    };

    /**
     * Initializes the chain of events that is followed by the detection of an error while loading a bookmark which
     * includes reporting and removing.
     * @param tabId Id of the tab where the error occured.
     * @param error {string} Type of error.
     */
    let handleError = function (tabId, error) {
        let unverifiedBookmark = tabRegistry[tabId];

        browser.tabs.remove(tabId);

        if (typeof unverifiedBookmark !== 'undefined') {
            errorCount++;
            setStats();
            appendErrorMessage(unverifiedBookmark, error);
        }
    };

    /**
     * Appends an ui error message for a duplicated bookmark.
     * @param bookmark {browser.bookmarks.BookmarkTreeNode}
     */
    let reportDuplicate = function (bookmark) {
        if (typeof bookmark !== 'undefined') {
            errorCount++;
            appendErrorMessage(bookmark, ERROR_DUPLICATE);
        }
    };

    /**
     * Appends an error message to the ui messages list.
     * @param bookmark {browser.bookmarks.BookmarkTreeNode} Invalid bookmark.
     * @param error {string} Type of error.
     */
    let appendErrorMessage = function (bookmark, error) {
        const messageContainer = document.createElement('div');
        messageContainer.id = bookmark.id;
        messageContainer.className = 'message';
        messageContainer.append(createActionIcons(bookmark));
        messageContainer.append(createIcon(ERROR_TYPE_TO_ICON[error], 'error', error.replace(/_/g, ' ')));
        messageContainer.append(document.createTextNode(bookmark.title.toLowerCase()));

        MESSAGES.append(messageContainer);
    };

    /**
     * Creates action icons for an invalid bookmark.
     * @param bookmark {browser.bookmarks.BookmarkTreeNode}
     * @returns {HTMLElement}
     */
    let createActionIcons = function (bookmark) {
        const actionContainer = document.createElement('span');

        const deleteFromBookmarksIcon = createIcon('delete', 'button');
        deleteFromBookmarksIcon.addEventListener('click', () => {
            if (removalConfirmed) {
                removeBookmark(bookmark.id, true);
            } else {
                modalBookmarkId = bookmark.id;
                MODAL.style.display = 'block';
            }
        });
        actionContainer.append(deleteFromBookmarksIcon);

        const deleteFromListIcon = createIcon('check_circle', 'button');
        deleteFromListIcon.addEventListener('click', () => {
            removeBookmark(bookmark.id, false);
        });
        actionContainer.append(deleteFromListIcon);

        const launchIcon = createIcon('launch', 'button');
        launchIcon.addEventListener('click', () => {
            browser.tabs.create({url: bookmark.url});
        });
        actionContainer.append(launchIcon);

        return actionContainer;
    };

    /**
     * Creates an informative icon for an error type or a simple icon for an action icon.
     * @param iconId {string} Id of the material icon.
     * @param cssClass {string} (Optional) Additional css class
     * @param tooltip {string} (Optional) Tooltip for the icon.
     * @returns {*}
     */
    let createIcon = function (iconId, cssClass, tooltip) {
        let icon;

        const simpleIcon = document.createElement('i');
        simpleIcon.classList = 'material-icons icon';
        simpleIcon.append(document.createTextNode(iconId));

        if (typeof cssClass !== 'undefined' && cssClass !== '') {
            simpleIcon.classList.add(cssClass);
        }

        if (typeof tooltip !== 'undefined') {
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
     * Displays statistic for the scanned bookmarks (total, ignored, problems).
     */
    let setStats = function () {
        STATS.style.display = 'block';
        STATS.innerHTML = '<b>Total:</b> ' + (bookmarksToProcess + bookmarksIgnored.length)
            + ' <b>Ignored:</b> ' + bookmarksIgnored.length
            + ' <b>Problems:</b> ' + errorCount;
    };

    /**
     * Displays a favicon beyond the progress bar for limited period of time.
     * @param favIconUrl Source of the favicon
     */
    let setFavicon = function (favIconUrl) {
        // preload
        const image = new Image();
        image.src = favIconUrl;

        const favIcon = document.createElement('img');
        favIcon.src = favIconUrl;
        favIcon.alt = '';
        favIcon.className = 'favicon';
        favIcon.crossOrigin = 'anonymous';
        FAVICONS.prepend(favIcon);
        FAVICONS.style.display = 'block';
        MESSAGES.style.marginTop = '140px';
    };

    /**
     * Removes a bookmark from the error list or permanently from bookmarks.
     * @param id Id of the bookmark that is to be removed.
     * @param permanently Flag to indicate whether the bookmarks should be removed permanently.
     */
    let removeBookmark = function (id, permanently) {
        if (permanently) {
            browser.bookmarks.remove(id)
                .then(() => {
                    document.getElementById(id).remove();
                    errorCount--;
                    setStats();
                }, (error) => {
                    console.log(`ERROR: Could not remove bookmark ${id}: ${error}`);
                });
        } else {
            document.getElementById(id).remove();
            errorCount--;
            setStats();
        }
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
}

const remarksSidebar = new RemarksSidebar();
remarksSidebar.init();