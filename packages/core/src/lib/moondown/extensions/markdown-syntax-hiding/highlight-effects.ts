import { StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView } from '@codemirror/view';

export const addHighlightEffect = StateEffect.define<{from: number, to: number, timestamp: number}>();

export interface HighlightInfo {
    from: number;
    to: number;
    timestamp: number;
}

export const referenceHighlightField = StateField.define<HighlightInfo | null>({
    create() {
        return null;
    },
    update(highlight, tr) {
        for (const effect of tr.effects) {
            if (effect.is(addHighlightEffect)) {
                return effect.value;
            }
        }
        if (highlight) {
            const elapsed = Date.now() - highlight.timestamp;
            if (elapsed >= 2000) {
                return null;
            }
        }
        if (highlight && tr.docChanged) {
            return {
                from: tr.changes.mapPos(highlight.from),
                to: tr.changes.mapPos(highlight.to),
                timestamp: highlight.timestamp
            };
        }
        return highlight;
    },
    provide: f => EditorView.decorations.from(f, highlight => {
        if (!highlight) return Decoration.none;
        const elapsed = Date.now() - highlight.timestamp;
        if (elapsed >= 2000) {
            return Decoration.none;
        }
        const deco = Decoration.mark({
            class: "cm-reference-highlight"
        }).range(highlight.from, highlight.to);
        return Decoration.set([deco]);
    })
});

export const highlightCleanupPlugin = EditorView.updateListener.of((update) => {
    const highlight = update.state.field(referenceHighlightField, false);
    if (highlight) {
        const elapsed = Date.now() - highlight.timestamp;
        if (elapsed >= 2000 && elapsed < 2100) {
            setTimeout(() => {
                if (update.view.state.field(referenceHighlightField, false)) {
                    update.view.dispatch({});
                }
            }, 100);
        }
    }
});