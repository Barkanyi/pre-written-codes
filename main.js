/*
The MIT License (MIT)

Copyright (c) 2016 Barkanyi

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
 */

/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets, window, Mustache */

define(function (require, exports, module) {
    'use strict';

    var AppInit = brackets.getModule('utils/AppInit'),
        EditorManager = brackets.getModule('editor/EditorManager'),
        CodeHintManager = brackets.getModule("editor/CodeHintManager"),
        LanguageManager = brackets.getModule("language/LanguageManager"),
        PreferencesManager = brackets.getModule('preferences/PreferencesManager'),
        Menus = brackets.getModule('command/Menus'),
        Strings = brackets.getModule("strings"),
        StringUtils = brackets.getModule("utils/StringUtils"),
        DocumentManager = brackets.getModule("document/DocumentManager"),
		Commands = brackets.getModule("command/Commands"),
		CommandManager = brackets.getModule("command/CommandManager"),
		KeyBindingManager = brackets.getModule("command/KeyBindingManager"),
		MainViewManager = brackets.getModule("view/MainViewManager"),
        FileSystem = brackets.getModule("filesystem/FileSystem"),
        FileUtils = brackets.getModule("file/FileUtils"),
        ExtensionUtils = brackets.getModule("utils/ExtensionUtils"),
        KeyEvent = brackets.getModule('utils/KeyEvent'),
        Dialogs = brackets.getModule("widgets/Dialogs"),
        DefaultDialogs = brackets.getModule("widgets/DefaultDialogs"),
        DialogText = require('text!codewrite.html'),
        snippets = require('snippet'),
        bsfuncHint = require('text!bs-func.txt'),
        enabled = false,
        prefs = PreferencesManager.getExtensionPrefs('pre-written-codes'),
        COMMAND_NAME = 'Saját kódok engedélyezve',
        COMMAND_ID = 'prewrittenbox.togglePreWrittenCode',
        COMMAND_MENU_NAME1 = 'Saját kódok',
        COMMAND_MENU_ID1 = 'ritenewcode',
        COMMAND_NAME1 = 'Új kód',
        COMMAND_ID1 = 'ritenewcode.togglewritenewcode',
        CodeWrite = function ($codename, $code) {
            var FileError = 0;
            brackets.fs.readFile(require.toUrl('./code/' + $codename), 'utf8', function (err, contents) {
                FileError = err;
                console.log("FileError = " + err + ' contents: ' + contents);
                if (FileError === 0) {
                    alert('Ez a file már létezik! ' + require.toUrl('./code/' + $codename));
                    var dialog = Dialogs.showModalDialog(DefaultDialogs.DIALOG_ID_INFO, COMMAND_NAME1, DialogText);
                    var $dlg = dialog.getElement();
                    $("#codename", $dlg).val($codename.replace('.txt', ''));
                    $("#code", $dlg).val($code);
                    dialog.done(function () {
                        var $dlg = dialog.getElement();
                        var $codename = $("#codename", $dlg).val() + '.txt';
                        var $code = $("#code", $dlg).val();
                        var a = new CodeWrite($codename, $code);
                    });
                    return false;
                } else {
                    brackets.fs.writeFile(require.toUrl('./code/' + $codename), $code, 'utf8', function (err) {
                        brackets.fs.readFile(require.toUrl('./bs-func.txt'), 'utf8', function (err, contents) {
                            contents += '\n' + $codename.replace('.txt', '');
                            brackets.fs.writeFile(require.toUrl('./bs-func.txt'), contents, 'utf8', function (err) {
                                
                            });
                        });
                        brackets.fs.readFile(require.toUrl('./snippet.js'), 'utf8', function (err, contents) {
                            var snipp = 'snippets.' + $codename.replace('.txt', '') + " = require('text!./code/" + $codename + "');";
                            contents = contents.replace('//##//', snipp + '\n    //##//');
                            brackets.fs.writeFile(require.toUrl('./snippet.js'), contents, 'utf8', function (err) {
                                CommandManager.execute(Commands.APP_RELOAD);
                            });
                        });
                    });
                }
            });
        },
        CodeWriteWin = function () {
            var dialog = Dialogs.showModalDialog(DefaultDialogs.DIALOG_ID_INFO, COMMAND_NAME1, DialogText);
            dialog.done(function () {
                var $dlg = dialog.getElement();
                var $codename = $("#codename", $dlg).val() + '.txt';
                var $code = $("#code", $dlg).val();
                var a = new CodeWrite($codename, $code);
            });
        },
        handleToggleSnippets = function () {
            enabled = !enabled;
            prefs.set('enabled', enabled);
            prefs.save();
            CommandManager.get(COMMAND_ID).setChecked(enabled);
        },
        applyPreferences = function () {
            enabled = prefs.get('enabled');
            CommandManager.get(COMMAND_ID).setChecked(enabled);
        },
        parseLine = function (line, cursorPosition) {
            var words;
            line = line.substring(0, cursorPosition);
            words = line.split(/\W/);
            return words[words.length - 1];
        },
        keyEventHandler = function ($event, editor, event) {
            enabled = prefs.get('enabled');
            var cursorPosition, line, snippetKey, start;
            if (enabled) {
                if ((event.type === 'keydown') && (event.keyCode === KeyEvent.DOM_VK_TAB || event.keyCode === KeyEvent.DOM_VK_DOWN)) {
                    cursorPosition = editor.getCursorPos();
                    line = editor.document.getLine(cursorPosition.line);
                    snippetKey = parseLine(line, cursorPosition.ch);
                    if (snippets[snippetKey]) {
                        start = {
                            line: cursorPosition.line,
                            ch: cursorPosition.ch - snippetKey.length
                        };

                        editor.document.replaceRange(snippets[snippetKey], start, cursorPosition);
                        event.preventDefault();
                    }
                }
            }
        },
        activeEditorChangeHandler = function ($event, focusedEditor, lostEditor) {
            enabled = prefs.get('enabled');
            if (lostEditor) {
                $(lostEditor).off('keyEvent', keyEventHandler);
            }
            if (focusedEditor) {
                $(focusedEditor).on('keyEvent', keyEventHandler);
            }
        };
    var lastLine,
        lastFileName,
        cachedMatches,
        cachedWordList,
        tokenDefinition,
        currentTokenDefinition;
    function BShints() {
        this.lastLine = 0;
        this.lastFileName = "";
        this.cachedMatches = [];
        this.cachedWordList = [];
        this.tokenDefinition = /[a-zA-Z][(_a-zA-Z0-9$,.';_ )].{2,}/g;
        this.currentTokenDefinition = /[a-zA-Z][a-zA-Z0-9_]+$/g;
    }
    BShints.prototype.hasHints = function (editor, implicitChar) {
        this.editor = editor;
        var cursor = this.editor.getCursorPos();

        if (cursor.line !== this.lastLine) {
            var rawWordList = bsfuncHint.match(this.tokenDefinition);
            this.cachedWordList = [];
            var i;
            for (i = 0; i < rawWordList.length; i++) {
                var word = rawWordList[i];
                if (this.cachedWordList.indexOf(word) === -1) {
                    this.cachedWordList.push(word);
                }
            }
        }
        this.lastLine = cursor.line;

        var lineBeginning = {
            line: cursor.line,
            ch: 0
        };
        var textBeforeCursor = this.editor.document.getRange(lineBeginning, cursor);
        var symbolBeforeCursorArray = textBeforeCursor.match(this.currentTokenDefinition);
        if (symbolBeforeCursorArray) {
            var n;
            for (n = 0; n < this.cachedWordList.length; n++) {
                if (this.cachedWordList[n].indexOf(symbolBeforeCursorArray[0]) === 0) {
                    return true;
                }
            }
        }
        return false;
    };
    BShints.prototype.getHints = function (implicitChar) {
        var cursor = this.editor.getCursorPos();
        var lineBeginning = {
            line: cursor.line,
            ch: 0
        };
        var textBeforeCursor = this.editor.document.getRange(lineBeginning, cursor);
        var symbolBeforeCursorArray = textBeforeCursor.match(this.currentTokenDefinition);
        var hintList = [];
        var j;
        for (j = 0; j < this.cachedWordList.length; j++) {
            if (this.cachedWordList[j].indexOf(symbolBeforeCursorArray[0]) === 0) {
                hintList.push(this.cachedWordList[j]);
            }
        }

        return {
            hints: hintList,
            match: symbolBeforeCursorArray[0],
            selectInitial: true,
            handleWideResults: false
        };
    };
    BShints.prototype.insertHint = function (hint) {
        var cursor = this.editor.getCursorPos();
        var lineBeginning = {
            line: cursor.line,
            ch: 0
        };
        var textBeforeCursor = this.editor.document.getRange(lineBeginning, cursor);
        var indexOfTheSymbol = textBeforeCursor.search(this.currentTokenDefinition);
        var replaceStart = {
            line: cursor.line,
            ch: indexOfTheSymbol
        };
        this.editor.document.replaceRange(hint, replaceStart, cursor);

        var cursorPosition = this.editor.getCursorPos();
        var line = this.editor.document.getLine(cursorPosition.line);
        var snippetKey = parseLine(line, cursorPosition.ch);
        if (snippets[snippetKey]) {
            var start = {
                line: cursorPosition.line,
                ch: cursorPosition.ch - snippetKey.length
            };

            this.editor.document.replaceRange(snippets[snippetKey], start, cursorPosition);
            event.preventDefault();
        }

        return false;
    };
    AppInit.appReady(function () {
        enabled = prefs.get('enabled');

        CommandManager.register(COMMAND_NAME1, COMMAND_ID1, CodeWriteWin);
        var menu = Menus.addMenu(COMMAND_MENU_NAME1, COMMAND_MENU_ID1);
        menu.addMenuItem(COMMAND_ID1);
        
        CommandManager.register(COMMAND_NAME, COMMAND_ID, handleToggleSnippets);
        menu.addMenuItem(COMMAND_ID);

        var currentEditor = EditorManager.getCurrentFullEditor();
        $(currentEditor).on('keyEvent', keyEventHandler);
        $(EditorManager).on('activeEditorChange', activeEditorChangeHandler);

        var bsHints = new BShints();
        CodeHintManager.registerHintProvider(bsHints, ["all"], 0);

        prefs.on('change', applyPreferences);
        applyPreferences();
    });
});
