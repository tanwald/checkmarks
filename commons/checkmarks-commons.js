/**
 * Read-only storage for default values.
 * @constructor
 */
function DefaultsStore() {
    const TIMEOUT = 20;
    const TIMEOUT_OVERRULE = 5;
    const MAX_TABS = 5;
    const IGNORED_DIRS = ['archive', 'local'];
    const IGNORED_DIRS_ACTIVE = false;
    const INCLUDED_DIRS = [];
    const INCLUDED_DIRS_ACTIVE = false;
    const IGNORED_URLS = ['localhost', '192.168.', '172.16.', '10.'];
    const IGNORED_URLS_ACTIVE = true;
    const SHOW_FAVICONS = true;
    const TO_LOWERCASE = false;
    const DO_SORT = false;
    const SORT_UNFILED_BY_DATE = false;
    const CLEAR_CACHE = false;

    this.getTimeout = function () {
        return TIMEOUT;
    };

    this.getTimeoutOverrule = function () {
        return TIMEOUT_OVERRULE;
    };

    this.getMaxTabs = function () {
        return MAX_TABS;
    };

    this.getIgnoredDirs = function () {
        return IGNORED_DIRS;
    };

    this.getIgnoredDirsActive = function () {
        return IGNORED_DIRS_ACTIVE;
    };

    this.getIncludedDirs = function () {
        return INCLUDED_DIRS;
    };

    this.getIncludedDirsActive = function () {
        return INCLUDED_DIRS_ACTIVE;
    };

    this.getIgnoredUrls = function () {
        return IGNORED_URLS;
    };

    this.getIgnoredUrlsActive = function () {
        return IGNORED_URLS_ACTIVE;
    };

    this.getShowFavicons = function () {
        return SHOW_FAVICONS;
    };

    this.getToLowercase = function () {
        return TO_LOWERCASE;
    };

    this.doSort = function () {
        return DO_SORT;
    };

    this.sortUnfiledByDate = function () {
        return SORT_UNFILED_BY_DATE;
    };

    this.getClearCache = function () {
        return CLEAR_CACHE;
    }
}

const CM_DEFAULTS = new DefaultsStore();

