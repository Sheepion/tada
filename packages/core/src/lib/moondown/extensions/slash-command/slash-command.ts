import { EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { createIcons, icons } from 'lucide';
import { slashCommandState, toggleSlashCommand } from "./fields";
import { type SlashCommandOption, slashCommands } from "./commands";
import { CSS_CLASSES, ICON_SIZES, TIMING } from "../../core/constants";
import { createElement, createIconElement, debounce, scrollIntoView as scrollElementIntoView } from "../../core/utils/dom-utils";
import {translationsState} from "../default-extensions";
import {MoondownTranslations} from "../../core";

export const slashCommandPlugin = ViewPlugin.fromClass(class {
    menu: HTMLElement;
    debounceTimer: number | null;
    currentAbortController: AbortController | null;
    debouncedUpdate: (update: ViewUpdate) => void;

    constructor(view: EditorView) {
        this.menu = createElement('div', CSS_CLASSES.SLASH_COMMAND_MENU);
        view.dom.appendChild(this.menu);
        this.debounceTimer = null;
        this.currentAbortController = null;
        this.debouncedUpdate = debounce(
            (update: ViewUpdate) => this.updateMenu(update),
            TIMING.DEBOUNCE_DELAY
        );

        view.dom.addEventListener('click', () => {
            this.abortAIContinuation();
        });

        document.addEventListener('click', (e) => {
            if (!this.menu.contains(e.target as Node) && !view.dom.contains(e.target as Node)) {
                view.dispatch({
                    effects: toggleSlashCommand.of(false)
                });
                this.abortAIContinuation();
            }
        });
    }

    update(update: ViewUpdate): void {
        this.debouncedUpdate(update);
    }

    updateMenu(update: ViewUpdate): void {
        const state = update.state.field(slashCommandState);
        const translations = update.state.field(translationsState);

        if (!state.active) {
            this.hide();
            return;
        }

        this.show();

        requestAnimationFrame(() => {
            const pos = update.view.coordsAtPos(state.pos);
            if (pos) {
                const editorRect = update.view.dom.getBoundingClientRect();
                const menuRect = this.menu.getBoundingClientRect();

                if (pos.top + menuRect.height > editorRect.bottom) {
                    this.menu.style.top = `${pos.top - editorRect.top - menuRect.height}px`;
                } else {
                    this.menu.style.top = `${pos.top - editorRect.top + 20}px`;
                }

                this.menu.style.left = `${pos.left - editorRect.left}px`;
            }
        });

        const filteredCommands = this.filterCommands(state.filterText, translations);

        this.renderCommands(filteredCommands, state.selectedIndex, update.view, state.pos, translations);
    }

    filterCommands(filterText: string, translations: MoondownTranslations): SlashCommandOption[] {
        return slashCommands.filter(cmd => {
                const title = translations[cmd.titleKey] || cmd.titleKey;
                return title.toLowerCase().includes(filterText.toLowerCase())
            }
        );
    }

    renderCommands(
        commands: SlashCommandOption[],
        selectedIndex: number,
        view: EditorView,
        pos: number,
        translations: MoondownTranslations
    ): void {
        requestAnimationFrame(() => {
            const fragment = document.createDocumentFragment();

            commands.forEach((cmd, index) => {
                if (cmd.titleKey === "divider") {
                    const divider = createElement("hr", CSS_CLASSES.SLASH_COMMAND_DIVIDER);
                    fragment.appendChild(divider);
                    return;
                }

                const isSelected = index === selectedIndex;
                const itemClass = `${CSS_CLASSES.SLASH_COMMAND_ITEM} ${
                    isSelected ? CSS_CLASSES.SLASH_COMMAND_SELECTED : ''
                }`;
                const item = createElement("div", itemClass);
                const titleText = translations[cmd.titleKey] || cmd.titleKey;

                const icon = createIconElement(cmd.icon, "cm-slash-command-icon");
                const title = createElement("span", "cm-slash-command-title");
                title.textContent = titleText;

                item.appendChild(icon);
                item.appendChild(title);

                item.addEventListener("mousedown", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.executeCommand(view, cmd, pos);
                });

                fragment.appendChild(item);
            });

            this.menu.innerHTML = '';
            this.menu.appendChild(fragment);

            createIcons({
                icons,
                attrs: ICON_SIZES.MEDIUM,
            });

            this.scrollSelectedIntoView();
        });
    }

    scrollSelectedIntoView(): void {
        const selectedItem = this.menu.querySelector(
            `.${CSS_CLASSES.SLASH_COMMAND_ITEM}.${CSS_CLASSES.SLASH_COMMAND_SELECTED}`
        ) as HTMLElement;

        if (selectedItem) {
            scrollElementIntoView(selectedItem, this.menu);
        }
    }

    executeCommand(view: EditorView, cmd: SlashCommandOption, pos: number): void {
        const state = view.state;
        const currentPos = state.selection.main.from;
        const line = state.doc.lineAt(currentPos);
        const lineStart = line.from;
        const lineText = line.text;
        const cursorInLine = currentPos - lineStart;

        const beforeCursor = lineText.slice(0, cursorInLine);
        const slashMatch = beforeCursor.match(/\/\w*$/);

        if (slashMatch) {
            const slashStart = lineStart + beforeCursor.lastIndexOf(slashMatch[0]);
            const slashEnd = currentPos;

            view.dispatch({
                changes: { from: slashStart, to: slashEnd, insert: "" },
                effects: toggleSlashCommand.of(false)
            });
        } else {
            view.dispatch({
                effects: toggleSlashCommand.of(false)
            });
        }

        const result = cmd.execute(view);
        if (result instanceof Promise) {
            result.then(controller => {
                if (controller instanceof AbortController) {
                    this.currentAbortController = controller;
                }
            });
        }

        view.focus();
    }

    show(): void {
        this.menu.style.display = "block";
    }

    hide(): void {
        this.menu.style.display = "none";
    }

    setCurrentAbortController(controller: AbortController): void {
        this.currentAbortController = controller;
    }

    clearCurrentAbortController(): void {
        this.currentAbortController = null;
    }

    abortAIContinuation(): void {
        if (this.currentAbortController) {
            this.currentAbortController.abort();
            this.currentAbortController = null;
        }
    }

    destroy(): void {
        this.menu.remove();
        this.abortAIContinuation();
    }
});