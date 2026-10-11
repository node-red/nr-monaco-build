// Modified to support localization.
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const globalScope = typeof globalThis === "object" ? globalThis : typeof window === "object" ? window : typeof self === "object" ? self : global; 
let isPseudo = (typeof document !== 'undefined' && document.location && document.location.hash.indexOf('pseudo=true') >= 0);

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
    if (isPseudo) {
        // FF3B and FF3D is the Unicode zenkaku representation for [ and ]
        result = '\uFF3B' + result.replace(/[aouei]/g, '$&$&') + '\uFF3D';
    }
    return result;
}

/**
 * @skipMangle
 */
export function localize(path, data, defaultMessage, ...args) {
    const key = typeof data=== "object" ? data.key : data;
    // data = ((globalScope.MonacoEnvironment||{}).Locale||{}).data||{};
    // data = ((globalScope.MonacoLocale || {}) || {}).data || {};
    // let message = (data[path]||{})[key];
    const localeData = ((globalScope.MonacoLocale || {}) || {}).data || {};
    let message = (localeData[path] || {})[key];
    if (!message) {
        message = defaultMessage;
    }
    args = [];
    for (let _i = 3; _i < arguments.length; _i++) {
        args[_i - 3] = arguments[_i];
    }
    return _format(message, args);
}
/**
 * @skipMangle
 */
export function localize2(path, data, defaultMessage, ...args) {
    const key = typeof data=== "object" ? data.key : data;
    // data = ((globalScope.MonacoEnvironment||{}).Locale||{}).data||{};
    // data = ((globalScope.MonacoLocale || {}) || {}).data || {};
    // let message = (data[path]||{})[key];
    const localeData = ((globalScope.MonacoLocale || {}) || {}).data || {};
    let message = (localeData[path] || {})[key];
    if (!message) {
        message = defaultMessage;
    }
    args = [];
    for (let _i = 3; _i < arguments.length; _i++) {
        args[_i - 3] = arguments[_i];
    }
    const original = _format(message, args);
    return {
        value: original,
        original
    };
}

export function loadMessageBundle(file) {
    return localize;
}

export function config(opt) {
    return loadMessageBundle;
}

/**
 * @skipMangle
 */
export function getConfiguredDefaultLocale() {
    return (self.MonacoLocale || {}).language;
}
/**
 * @skipMangle
 */
export function getNLSLanguage() {
    return (self.MonacoLocale || {}).language;
}
export function getNLSMessages() {
    return ((self.MonacoLocale || {}) || {}).data || {};
}
