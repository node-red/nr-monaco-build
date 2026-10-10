// import * as monaco from 'monaco-editor-esm-i18n';
// window.monaco = monaco;
// window.MonacoEnvironment = window.MonacoEnvironment || {};
// if(!window.MonacoEnvironment.Locale) {
//     window.MonacoEnvironment.Locale = window.MonacoLocale
// }

import * as monaco from 'monaco-editor-esm-i18n';
const parent = typeof globalThis === "object" ? globalThis : typeof window === "object" ? window : typeof self === "object" ? self : global;
parent.monaco = monaco;
parent.MonacoEnvironment = parent.MonacoEnvironment || {};