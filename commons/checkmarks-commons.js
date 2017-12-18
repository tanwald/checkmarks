/**
 * Read-only storage for default values.
 * @constructor
 */
function DefaultsStore() {
    const TIMEOUT = 20;
    const TIMEOUT_OVERRULE = 5;
    const MAX_TABS = 5;
    const IGNORED_DIRS = ['archive', 'local'];
    const IGNORED_URLS = ['localhost', '192.168.1.', '10.0.0.'];
    const SHOW_FAVICONS = true;
    const TO_LOWERCASE = false;

    this.getTimeout = function () {
        return TIMEOUT;
    };

    this.getTimeoutOverrule = function () {
        return TIMEOUT_OVERRULE;
    };

    this.getMaxTabs = function () {
        return MAX_TABS;
    };

    this.getIgnoredUrls = function () {
        return IGNORED_URLS;
    };

    this.getIgnoredDirs = function () {
        return IGNORED_DIRS;
    };

    this.getShowFavicons = function () {
        return SHOW_FAVICONS;
    }

    this.getToLowercase = function () {
        return TO_LOWERCASE;
    };
}

const RE_DEFAULTS = new DefaultsStore();

