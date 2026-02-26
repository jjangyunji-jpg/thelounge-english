import { Mark, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    suggestion: {
      setSuggestion: () => ReturnType;
      unsetSuggestion: () => ReturnType;
      toggleSuggestion: () => ReturnType;
    };
  }
}

const suggestionPluginKey = new PluginKey("suggestion");

export const Suggestion = Mark.create({
  name: "suggestion",

  keepOnSplit: true,

  parseHTML() {
    return [{ tag: "span[data-suggestion]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-suggestion": "",
        class: "suggestion-mark",
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setSuggestion:
        () =>
        ({ commands }) => commands.setMark(this.name),
      unsetSuggestion:
        () =>
        ({ commands }) => commands.unsetMark(this.name),
      toggleSuggestion:
        () =>
        ({ commands }) => commands.toggleMark(this.name),
    };
  },

  addProseMirrorPlugins() {
    const markType = this.type;
    return [
      new Plugin({
        key: suggestionPluginKey,
        appendTransaction(transactions, _oldState, newState) {
          // If the suggestion mark is in storedMarks, keep it active
          // This ensures typing preserves the mark
          const storedMarks = newState.storedMarks;
          if (storedMarks && storedMarks.some((m) => m.type === markType)) {
            return null; // marks are already stored, nothing to do
          }
          return null;
        },
      }),
    ];
  },
});
