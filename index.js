import * as monaco from 'monaco-editor-esm-i18n';
const parent = self || window || globalThis;

parent.monaco = monaco;
monaco.parent = parent;
parent.MonacoEnvironment = parent.MonacoEnvironment || {};
if(!parent.MonacoEnvironment.Locale) {
    parent.MonacoEnvironment.Locale = parent.MonacoLocale
}