import * as monaco from "monaco-editor-esm-i18n";

if(monaco && monaco.monaco) {
    monaco = monaco.monaco;
}

if(typeof window!="undefined") {
    if(!window.monaco) window.monaco = monaco
} 

if(typeof self!="undefined") {
    if(!self.monaco) self.monaco = monaco
}

monaco.version = "0.24.0";// update me when upgrading monaco-editor

export {
    monaco
};
  
