// src/components/common/CodeMirrorEditor.tsx
import { useRef, useEffect, useImperativeHandle, forwardRef, memo } from 'react'; // Added React import
import { EditorState, StateEffect } from '@codemirror/state';
import { EditorView, keymap, drawSelection, dropCursor, rectangularSelection, placeholder as viewPlaceholder } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { bracketMatching, indentOnInput, foldKeymap } from '@codemirror/language';
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { searchKeymap } from '@codemirror/search';
import { lintKeymap } from '@codemirror/lint';
import { twMerge } from 'tailwind-merge';

// Enhanced theme with subtle glass option integrated
const editorTheme = EditorView.theme({
    '&': {
        height: '100%',
        fontSize: '13.5px', // Slightly larger font for editor clarity
        backgroundColor: 'transparent', // Ensure CM background doesn't override container
        borderRadius: 'inherit', // Inherit rounding
    },
    '.cm-scroller': {
        fontFamily: `var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace)`, // Use CSS var or fallback
        lineHeight: '1.65', // Slightly more generous line height
        overflow: 'auto',
        position: 'relative', // Needed for placeholder absolute positioning
    },
    '.cm-content': {
        padding: '12px 14px', // Slightly increased padding
        caretColor: 'hsl(208, 100%, 50%)', // Primary color caret
    },
    // Gutters styled for glassmorphism - more transparent background
    '.cm-gutters': {
        backgroundColor: 'hsla(220, 30%, 96%, 0.6)', // Transparent inset glass effect
        borderRight: '1px solid hsla(210, 20%, 85%, 0.5)', // Softer, semi-transparent border
        color: 'hsl(210, 9%, 55%)', // Muted text color
        paddingLeft: '8px',
        paddingRight: '4px',
        fontSize: '11px',
        userSelect: 'none',
        WebkitUserSelect: 'none', // Safari
        backdropFilter: 'blur(4px)', // Apply blur to gutters if desired
        WebkitBackdropFilter: 'blur(4px)',
    },
    '.cm-lineNumbers .cm-gutterElement': {
        minWidth: '22px', // Slightly wider for line numbers
    },
    '.cm-line': {
        padding: '0 4px', // Minimal horizontal padding within lines
    },
    '.cm-activeLine': {
        backgroundColor: 'hsla(208, 100%, 50%, 0.06)', // Slightly more visible primary active line
    },
    '.cm-activeLineGutter': {
        backgroundColor: 'hsla(208, 100%, 50%, 0.09)', // Slightly more visible gutter highlight
    },
    '.cm-placeholder': {
        color: 'hsl(210, 9%, 60%)', // Adjusted placeholder color
        fontStyle: 'italic',
        pointerEvents: 'none',
        padding: '12px 14px', // Match content padding
        position: 'absolute', // Position correctly within scroller
        top: 0,
        left: 0,
    },
    '.cm-foldGutter .cm-gutterElement': {
        padding: '0 4px 0 8px', // Adjust padding for fold arrows
        cursor: 'pointer',
        textAlign: 'center',
    },
    '.cm-foldMarker': { // Custom fold marker style
        display: 'inline-block',
        color: 'hsl(210, 10%, 70%)',
        '&:hover': {
            color: 'hsl(210, 10%, 50%)',
        },
    },
    // Specific styles for when the editor container has glass effect
    '.cm-editor-container-glass & .cm-scroller': {
        // Optionally make content background slightly transparent too if container is glass
        // backgroundColor: 'hsla(0, 0%, 100%, 0.8)',
    },
    '.cm-editor-container-glass & .cm-gutters': {
        // Ensure gutters blend well with glass container
        backgroundColor: 'hsla(220, 40%, 98%, 0.6)', // Match alt glass more closely
        borderRight: '1px solid hsla(210, 20%, 85%, 0.4)',
    },

});

interface CodeMirrorEditorProps {
    value: string;
    onChange: (newValue: string) => void;
    className?: string; // Class for the container div
    placeholder?: string;
    readOnly?: boolean;
    onBlur?: () => void;
    useGlassEffect?: boolean; // Prop to enable glass styling
}

// Define the type for the ref handle
export interface CodeMirrorEditorRef {
    focus: () => void;
    getView: () => EditorView | null;
}

const CodeMirrorEditor = forwardRef<CodeMirrorEditorRef, CodeMirrorEditorProps>(
    ({
         value,
         onChange,
         className,
         placeholder,
         readOnly = false,
         onBlur,
         useGlassEffect = false, // Default to no glass
     }, ref) => {
        const editorRef = useRef<HTMLDivElement>(null);
        const viewRef = useRef<EditorView | null>(null);
        const stateRef = useRef<EditorState | null>(null); // Keep track of state

        // Expose focus and view instance via ref
        useImperativeHandle(ref, () => ({
            focus: () => {
                viewRef.current?.focus();
            },
            getView: () => viewRef.current,
        }));

        // Effect for Initialization and Cleanup
        useEffect(() => {
            if (!editorRef.current) return;

            const createExtensions = () => [
                history(),
                drawSelection(),
                dropCursor(),
                EditorState.allowMultipleSelections.of(true),
                indentOnInput(),
                bracketMatching(),
                closeBrackets(),
                autocompletion(),
                rectangularSelection(),
                keymap.of([
                    ...closeBracketsKeymap,
                    ...defaultKeymap,
                    ...searchKeymap,
                    ...historyKeymap,
                    ...foldKeymap,
                    ...completionKeymap,
                    ...lintKeymap,
                    indentWithTab,
                ]),
                markdown({
                    base: markdownLanguage,
                    codeLanguages: languages,
                    addKeymap: true,
                }),
                EditorView.lineWrapping,
                EditorView.contentAttributes.of({ 'aria-label': 'Markdown editor' }),
                EditorView.updateListener.of((update) => {
                    // Update internal state ref first
                    if (update.state) {
                        stateRef.current = update.state;
                    }
                    // Notify parent of document changes
                    if (update.docChanged) {
                        onChange(update.state.doc.toString());
                    }
                    // Handle blur event
                    if (update.focusChanged && !update.view.hasFocus && onBlur) {
                        onBlur();
                    }
                }),
                EditorState.readOnly.of(readOnly),
                ...(placeholder ? [viewPlaceholder(placeholder)] : []),
                editorTheme, // Apply our custom theme adjustments
            ];

            let view = viewRef.current;

            if (view) {
                // If view exists, just reconfigure
                view.dispatch({
                    effects: StateEffect.reconfigure.of(createExtensions())
                });
                stateRef.current = view.state; // Update stateRef
            } else {
                // Create new state and view
                const startState = EditorState.create({
                    doc: value, // Use current value for initial state
                    extensions: createExtensions(),
                });
                stateRef.current = startState;
                view = new EditorView({
                    state: startState,
                    parent: editorRef.current as Element, // Type assertion
                });
                viewRef.current = view;
            }


            // Cleanup function
            return () => {
                // Destroy the view if it exists and matches the current ref
                if (viewRef.current) {
                    viewRef.current.destroy();
                    viewRef.current = null;
                    // Keep stateRef as is, might be needed if remounted quickly
                }
            };
            // Dependency array includes props that affect extensions
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [readOnly, placeholder, useGlassEffect, onChange, onBlur]); // Added onChange/onBlur


        // Effect to update the editor content ONLY when the `value` prop changes externally
        useEffect(() => {
            const view = viewRef.current;
            const currentState = stateRef.current;

            // Only dispatch if the view exists and the external value is different from the current editor state
            if (view && currentState && value !== currentState.doc.toString()) {
                // Check again to prevent race conditions if internal state updated quickly
                if (value !== view.state.doc.toString()){
                    view.dispatch({
                        changes: { from: 0, to: view.state.doc.length, insert: value || '' },
                        // Keep the user's selection/cursor position
                        selection: view.state.selection,
                        // Prevent disrupting user interaction if they are typing
                        userEvent: "external"
                    });
                }
            }
        }, [value]); // Only depend on the external value prop

        // Removed the separate readOnly useEffect as it's handled by the main setup effect


        // Container div handles focus ring, background, and overall structure
        return (
            <div
                ref={editorRef}
                className={twMerge(
                    'cm-editor-container relative h-full w-full overflow-hidden rounded-md', // Base structure, ensure rounding
                    // Apply focus styles to the container for a clear boundary
                    'focus-within:ring-1 focus-within:ring-primary/50 focus-within:border-primary/80 border border-transparent', // Transparent border initially
                    // Conditional glass styling
                    useGlassEffect && 'bg-glass-inset-100 backdrop-blur-sm border-black/5 cm-editor-container-glass',
                    // Default non-glass styling (subtle inset)
                    !useGlassEffect && 'bg-canvas-inset border-border-color/80',
                    className // Allow overrides like adding border/bg externally
                )}
            />
        );
    }
);

CodeMirrorEditor.displayName = 'CodeMirrorEditor';
// Memoize to prevent unnecessary re-renders if props haven't changed shallowly
export default memo(CodeMirrorEditor);