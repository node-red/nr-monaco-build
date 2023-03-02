// Modified to support localization.
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
function _format(message, args) {
    let result;
    if (args.length === 0) {
        result = message;
    }
    else {
        result = message.replace(/\{(\d+)\}/g, function (match, rest) {
            const index = rest[0];
            return typeof args[index] !== 'undefined' ? args[index] : match;
        });
    }
    return result;
}

export function localize(path, data, defaultMessage) {
    const key = typeof data === "object" ? data.key : data;
    const localeData = ((self.MonacoLocale || {}) || {}).data || {};
    let message = (localeData[path] || {})[key];
    if (!message) {
        message = defaultMessage;
    }
    const args = [];
    for (let _i = 3; _i < arguments.length; _i++) {
        args[_i - 3] = arguments[_i];
    }
    return _format(message, args);
}

export function loadMessageBundle(file) {
    return localize;
}

export function config(opt) {
    return loadMessageBundle;
}

export function getConfiguredDefaultLocale() {
    return (self.MonacoLocale || {}).language;
}
