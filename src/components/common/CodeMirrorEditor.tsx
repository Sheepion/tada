// src/components/common/CodeMirrorEditor.tsx
// @ts-expect-error - Explicit React import sometimes needed
import React, { useRef, useEffect, useImperativeHandle, forwardRef, memo } from 'react';
import { EditorState, StateEffect, Annotation } from '@codemirror/state';
import { EditorView, keymap, drawSelection, dropCursor, rectangularSelection, placeholder as viewPlaceholder } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { bracketMatching, indentOnInput, foldKeymap } from '@codemirror/language';
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { lintKeymap } from '@codemirror/lint';
import { twMerge } from 'tailwind-merge';

// Consistent Editor Theme definition (remains the same)
const editorTheme = EditorView.theme({
    '&': { height: '100%', fontSize: '13.5px', backgroundColor: 'transparent', borderRadius: 'inherit', },
    '.cm-scroller': { fontFamily: `var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace)`, lineHeight: '1.65', overflow: 'auto', position: 'relative', backgroundColor: 'transparent !important', height: '100%', outline: 'none', },
    '.cm-content': { padding: '14px 16px', caretColor: 'hsl(var(--primary-h), var(--primary-s), var(--primary-l))', backgroundColor: 'transparent !important', outline: 'none', },
    '.cm-gutters': { backgroundColor: 'hsla(220, 40%, 98%, 0.65)', borderRight: '1px solid hsla(210, 20%, 85%, 0.4)', color: 'hsl(210, 9%, 55%)', paddingLeft: '8px', paddingRight: '4px', fontSize: '11px', userSelect: 'none', WebkitUserSelect: 'none', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', },
    '.cm-lineNumbers .cm-gutterElement': { minWidth: '24px', textAlign: 'right' },
    '.cm-line': { padding: '0 4px' },
    '.cm-activeLine': { backgroundColor: 'hsla(var(--primary-h), var(--primary-s), 50%, 0.10)' },
    '.cm-activeLineGutter': { backgroundColor: 'hsla(var(--primary-h), var(--primary-s), 50%, 0.15)' },
    '.cm-placeholder': { color: 'hsl(210, 9%, 60%)', fontStyle: 'italic', pointerEvents: 'none', padding: '14px 16px', position: 'absolute', top: 0, left: 0, },
    '.cm-foldGutter .cm-gutterElement': { padding: '0 4px 0 8px', cursor: 'pointer', textAlign: 'center', },
    '.cm-foldMarker': { display: 'inline-block', color: 'hsl(210, 10%, 70%)', '&:hover': { color: 'hsl(210, 10%, 50%)' }, },
    '.cm-searchMatch': { backgroundColor: 'hsla(50, 100%, 50%, 0.35)', outline: '1px solid hsla(50, 100%, 50%, 0.5)', borderRadius: '2px', },
    '.cm-searchMatch-selected': { backgroundColor: 'hsla(50, 100%, 50%, 0.55)', outline: '1px solid hsla(50, 100%, 40%, 0.8)' },
    '.cm-selectionBackground, ::selection': { backgroundColor: 'hsla(var(--primary-h), var(--primary-s), 50%, 0.25) !important', },
    '.cm-focused': { outline: 'none !important' },
});

// Define an Annotation type for external changes
const externalChangeEvent = Annotation.define<boolean>();

interface CodeMirrorEditorProps {
    value: string;
    onChange: (newValue: string) => void;
    className?: string;
    placeholder?: string;
    readOnly?: boolean;
    onBlur?: () => void;
}

export interface CodeMirrorEditorRef {
    focus: () => void;
    getView: () => EditorView | null;
}

// Use forwardRef to allow parent components to get a ref to the editor instance
const CodeMirrorEditor = forwardRef<CodeMirrorEditorRef, CodeMirrorEditorProps>(
    ({
         value,
         onChange,
         className,
         placeholder,
         readOnly = false,
         onBlur,
     }, ref) => {
        const editorRef = useRef<HTMLDivElement>(null);
        const viewRef = useRef<EditorView | null>(null);
        const onChangeRef = useRef(onChange); // Use refs for callbacks to avoid re-triggering effects
        const onBlurRef = useRef(onBlur);

        // Refs to store previous prop values for comparison to optimize reconfigurations
        const prevReadOnlyRef = useRef(readOnly);
        const prevPlaceholderRef = useRef(placeholder);

        // Update callback refs if they change
        useEffect(() => {
            onChangeRef.current = onChange;
        }, [onChange]);
        useEffect(() => {
            onBlurRef.current = onBlur;
        }, [onBlur]);

        // Expose focus and getView methods via the ref
        useImperativeHandle(ref, () => ({
            focus: () => { viewRef.current?.focus(); },
            getView: () => viewRef.current,
        }), []);

        // Effect for Editor Setup and Teardown - Runs ONCE on mount
        useEffect(() => {
            if (!editorRef.current) return;

            // Function to create extensions, including dynamic ones based on initial props
            const createExtensions = (currentPlaceholder?: string, currentReadOnly?: boolean) => [
                history(), drawSelection(), dropCursor(), EditorState.allowMultipleSelections.of(true), indentOnInput(),
                bracketMatching(), closeBrackets(), autocompletion(), rectangularSelection(), highlightSelectionMatches(),
                keymap.of([ ...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, ...foldKeymap, ...completionKeymap, ...lintKeymap, indentWithTab, ]),
                markdown({ base: markdownLanguage, codeLanguages: languages, addKeymap: true }),
                EditorView.lineWrapping, EditorView.contentAttributes.of({ 'aria-label': 'Markdown editor content' }),
                EditorView.updateListener.of((update) => {
                    // Distinguish between user edits and external value changes
                    const isExternal = update.transactions.some(tr => tr.annotation(externalChangeEvent));
                    if (update.docChanged && !isExternal) {
                        // Call onChange only for user edits
                        onChangeRef.current(update.state.doc.toString());
                    }
                    if (update.focusChanged && !update.view.hasFocus) {
                        // Call onBlur when focus is lost
                        onBlurRef.current?.();
                    }
                }),
                EditorState.readOnly.of(currentReadOnly ?? false), // Apply initial readOnly state
                ...(currentPlaceholder ? [viewPlaceholder(currentPlaceholder)] : []), // Apply initial placeholder
                editorTheme, // Apply custom theme
            ];

            // Create the initial editor state
            const startState = EditorState.create({
                doc: value, // Use initial value prop
                extensions: createExtensions(placeholder, readOnly) // Use initial placeholder/readOnly props
            });

            // Create the editor view
            const view = new EditorView({
                state: startState,
                parent: editorRef.current,
            });
            viewRef.current = view;

            // Store initial props in refs *after* setup for comparison in later effects
            prevReadOnlyRef.current = readOnly;
            prevPlaceholderRef.current = placeholder;

            // Cleanup function: Destroy the editor view when the component unmounts
            return () => {
                view.destroy();
                viewRef.current = null;
            };
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []); // Empty dependency array ensures this runs only once on mount

        // Effect to handle EXTERNAL value changes from props
        useEffect(() => {
            const view = viewRef.current;
            // Only update if the view exists and the prop value is different from the editor's current state
            if (view && value !== view.state.doc.toString()) {
                // Use a transaction to replace the entire document content
                view.dispatch({
                    changes: { from: 0, to: view.state.doc.length, insert: value || '' },
                    // Annotate the transaction to mark it as an external change
                    annotations: externalChangeEvent.of(true)
                });
            }
        }, [value]); // Dependency: Run only when the 'value' prop changes

        // Effect to handle dynamic readOnly and placeholder prop changes AFTER mount
        useEffect(() => {
            const view = viewRef.current;
            if (!view) return;

            const effects: StateEffect<unknown>[] = []; // Use unknown for StateEffect type

            // Compare current readOnly prop with previous value
            if (readOnly !== prevReadOnlyRef.current) {
                // Reconfigure the readOnly state extension
                effects.push(StateEffect.reconfigure.of(EditorState.readOnly.of(readOnly)));
                prevReadOnlyRef.current = readOnly; // Update previous value ref
            }

            // Compare current placeholder prop with previous value
            if (placeholder !== prevPlaceholderRef.current) {
                // Reconfigure the placeholder view extension
                effects.push(StateEffect.reconfigure.of(placeholder ? [viewPlaceholder(placeholder)] : []));
                prevPlaceholderRef.current = placeholder; // Update previous value ref
            }

            // Dispatch effects only if there were actual changes
            if (effects.length > 0) {
                view.dispatch({ effects });
            }

        }, [readOnly, placeholder]); // Dependencies: Run when readOnly or placeholder props change


        return (
            <div
                ref={editorRef}
                className={twMerge(
                    'cm-editor-container relative h-full w-full overflow-hidden rounded-md',
                    'bg-glass-inset-100 backdrop-blur-lg border border-black/10 shadow-inner', // Base appearance
                    'focus-within:ring-1 focus-within:ring-primary/50 focus-within:border-primary/80', // Focus styling
                    className // Allow external class overrides
                )}
            />
        );
    }
);

CodeMirrorEditor.displayName = 'CodeMirrorEditor';
// Performance: Export the memoized component directly
export default memo(CodeMirrorEditor);