// src/components/common/CodeMirrorEditor.tsx
import React, {forwardRef, memo, useEffect, useImperativeHandle, useRef} from 'react';
import {Annotation, EditorState, StateEffect} from '@codemirror/state';
import {
    drawSelection,
    dropCursor,
    EditorView,
    keymap,
    placeholder as viewPlaceholder,
    rectangularSelection
} from '@codemirror/view';
import {defaultKeymap, history, historyKeymap, indentWithTab} from '@codemirror/commands';
import {markdown, markdownLanguage} from '@codemirror/lang-markdown';
import {languages} from '@codemirror/language-data';
import {bracketMatching, foldKeymap, indentOnInput} from '@codemirror/language';
import {autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap} from '@codemirror/autocomplete';
import {highlightSelectionMatches, searchKeymap} from '@codemirror/search';
import {lintKeymap} from '@codemirror/lint';
import {twMerge} from 'tailwind-merge';

const editorTheme = EditorView.theme({
    '&': {
        height: '100%',
        fontSize: '13px',
        backgroundColor: 'transparent',
        color: 'hsl(var(--color-grey-dark))', // Will use the new darker grey-dark
        borderRadius: 'inherit',
        fontFamily: 'var(--font-primary)',
        fontWeight: 'var(--font-primary-regular-weight)',
    },
    '.cm-scroller': {
        fontFamily: 'inherit',
        fontWeight: 'inherit',
        lineHeight: '1.6',
        overflow: 'auto !important',
        position: 'relative',
        backgroundColor: 'transparent !important',
        height: '100%',
        outline: 'none',
        boxSizing: 'border-box',
    },
    '.cm-content': {
        padding: '16px',
        caretColor: 'hsl(var(--color-primary))',
        backgroundColor: 'transparent !important',
        outline: 'none',
        wordBreak: 'break-word',
        boxSizing: 'border-box',
    },
    '.cm-gutters': {display: 'none',},
    '.cm-activeLine': {backgroundColor: 'hsl(var(--color-grey-ultra-light))',}, // Will use new grey-ultra-light
    '.cm-placeholder': {
        color: 'hsl(var(--color-grey-medium))', // Will use new darker grey-medium
        fontStyle: 'normal',
        fontWeight: 'var(--font-primary-light-weight)',
        pointerEvents: 'none',
        padding: '16px',
        position: 'absolute', top: 0, left: 0,
    },
    '.cm-searchMatch': {
        backgroundColor: 'hsl(var(--color-primary-light) / 0.5)',
        outline: '1px solid hsl(var(--color-primary-light) / 0.7)',
        borderRadius: '2px',
    },
    '.cm-searchMatch-selected': {
        backgroundColor: 'hsl(var(--color-primary-light) / 0.8)',
        outline: '1px solid hsl(var(--color-primary))'
    },
    '.cm-selectionBackground, ::selection': {
        backgroundColor: 'hsl(var(--color-primary-light) / 0.6) !important',
    },
    '.cm-focused': {outline: 'none !important'},
    '&.cm-focused': {outline: 'none !important'},
    '.cm-editor': {height: '100%'},
});

const externalChangeEvent = Annotation.define<boolean>();

interface CodeMirrorEditorProps {
    value: string;
    onChange: (newValue: string) => void;
    className?: string;
    placeholder?: string;
    readOnly?: boolean;
    onBlur?: () => void;
    onFocus?: () => void;
}

export interface CodeMirrorEditorRef {
    focus: () => void;
    getView: () => EditorView | null;
}

const CodeMirrorEditor = forwardRef<CodeMirrorEditorRef, CodeMirrorEditorProps>(
    ({value, onChange, className, placeholder, readOnly = false, onBlur, onFocus}, ref) => {
        const editorRef = useRef<HTMLDivElement>(null);
        const viewRef = useRef<EditorView | null>(null);
        const onChangeRef = useRef(onChange);
        const onBlurRef = useRef(onBlur);
        const onFocusRef = useRef(onFocus);
        const prevReadOnlyRef = useRef(readOnly);
        const prevPlaceholderRef = useRef(placeholder);

        useEffect(() => {
            onChangeRef.current = onChange;
        }, [onChange]);
        useEffect(() => {
            onBlurRef.current = onBlur;
        }, [onBlur]);
        useEffect(() => {
            onFocusRef.current = onFocus;
        }, [onFocus]);

        useImperativeHandle(ref, () => ({
            focus: () => {
                viewRef.current?.focus();
            }, getView: () => viewRef.current,
        }), []);

        useEffect(() => {
            if (!editorRef.current) return;
            const createExtensions = (currentPlaceholder?: string, currentReadOnly?: boolean) => [
                history(), drawSelection(), dropCursor(), EditorState.allowMultipleSelections.of(true), indentOnInput(),
                bracketMatching(), closeBrackets(), autocompletion(), rectangularSelection(), highlightSelectionMatches(),
                keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, ...foldKeymap, ...completionKeymap, ...lintKeymap, indentWithTab,]),
                markdown({base: markdownLanguage, codeLanguages: languages, addKeymap: true}),
                EditorView.lineWrapping, EditorView.contentAttributes.of({'aria-label': 'Markdown editor content'}),
                EditorView.updateListener.of((update) => {
                    const isExternal = update.transactions.some(tr => tr.annotation(externalChangeEvent));
                    if (update.docChanged && !isExternal) {
                        onChangeRef.current(update.state.doc.toString());
                    }
                    if (update.focusChanged) {
                        if (update.view.hasFocus) onFocusRef.current?.(); else onBlurRef.current?.();
                    }
                }),
                EditorState.readOnly.of(currentReadOnly ?? false),
                ...(currentPlaceholder ? [viewPlaceholder(currentPlaceholder)] : []),
                editorTheme,
            ];
            const startState = EditorState.create({doc: value, extensions: createExtensions(placeholder, readOnly)});
            const view = new EditorView({state: startState, parent: editorRef.current,});
            viewRef.current = view;
            prevReadOnlyRef.current = readOnly;
            prevPlaceholderRef.current = placeholder;
            return () => {
                view.destroy();
                viewRef.current = null;
            };
        }, []);

        useEffect(() => {
            const view = viewRef.current;
            if (view && value !== view.state.doc.toString()) {
                view.dispatch({
                    changes: {from: 0, to: view.state.doc.length, insert: value || ''},
                    annotations: externalChangeEvent.of(true)
                });
            }
        }, [value]);

        useEffect(() => {
            const view = viewRef.current;
            if (!view) return;
            const effects: StateEffect<unknown>[] = [];
            if (readOnly !== prevReadOnlyRef.current) {
                effects.push(StateEffect.reconfigure.of(EditorState.readOnly.of(readOnly)));
                prevReadOnlyRef.current = readOnly;
            }
            if (placeholder !== prevPlaceholderRef.current) {
                effects.push(StateEffect.reconfigure.of(placeholder ? [viewPlaceholder(placeholder)] : []));
                prevPlaceholderRef.current = placeholder;
            }
            if (effects.length > 0) {
                view.dispatch({effects});
            }
        }, [readOnly, placeholder]);

        const containerClasses = twMerge(
            'cm-editor-container relative h-full w-full overflow-hidden rounded-base',
            readOnly && 'bg-grey-ultra-light', // Will use new grey-ultra-light
            className
        );

        return (<div ref={editorRef} className={containerClasses}/>);
    }
);
CodeMirrorEditor.displayName = 'CodeMirrorEditor';
export default memo(CodeMirrorEditor);