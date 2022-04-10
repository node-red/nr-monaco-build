import * as monaco from 'monaco-editor-esm-i18n';
window.monaco = monaco;
window.MonacoEnvironment = window.MonacoEnvironment || {};
if(!window.MonacoEnvironment.Locale) {
    window.MonacoEnvironment.Locale = window.MonacoLocale
}