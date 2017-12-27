/**
 * Class for the options page.
 * @constructor
 */
function CheckmarksOptions() {

    const requestTimeoutInput = document.getElementById('request-timeout');
    const timeoutOverruleInput = document.getElementById('timeout-overrule');
    const maxTabsInput = document.getElementById('max-tabs');
    const ignoredDirsInput = document.getElementById('ignored-dirs');
    const ignoredUrlsInput = document.getElementById('ignored-urls');
    const showFavicons = document.getElementById('show-favicons');
    const toLowercaseInput = document.getElementById('to-lowercase');

    /**
     * Registers event-listeners to store options on input and retrieve them on load.
     */
    this.init = function () {
        document.addEventListener('DOMContentLoaded', restoreOptions);
        document.querySelectorAll('input').forEach((input) => {
            input.addEventListener('input', setOptions);
        });
    };

    /**
     * Updates all stored options with current values. KISS...
     */
    let setOptions = function () {
        browser.storage.local.set({
            requestTimeout: requestTimeoutInput.value,
            timeoutOverrule: timeoutOverruleInput.value,
            maxTabs: maxTabsInput.value,
            ignoredDirs: ignoredDirsInput.value,
            ignoredUrls: ignoredUrlsInput.value,
            showFavicons: showFavicons.checked,
            toLowercase: toLowercaseInput.checked
        });
    };

    /**
     * Restores options from local storage or sets default values.
     */
    let restoreOptions = function () {
        browser.storage.local.get()
            .then((options) => {
                requestTimeoutInput.value = options.requestTimeout || CM_DEFAULTS.getTimeout();
                timeoutOverruleInput.value = options.timeoutOverrule || CM_DEFAULTS.getTimeoutOverrule();
                maxTabsInput.value = options.maxTabs || CM_DEFAULTS.getMaxTabs();
                ignoredDirsInput.value = options.ignoredDirs || CM_DEFAULTS.getIgnoredDirs();
                ignoredUrlsInput.value = options.ignoredUrls || CM_DEFAULTS.getIgnoredUrls();
                showFavicons.checked = options.showFavicons || CM_DEFAULTS.getShowFavicons();
                toLowercaseInput.checked = options.toLowercase || CM_DEFAULTS.getToLowercase();
            });
    };
}

const checkmarksOptions = new CheckmarksOptions();
checkmarksOptions.init();