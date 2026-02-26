import { Mark, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    suggestion: {
      setSuggestion: () => ReturnType;
      unsetSuggestion: () => ReturnType;
      toggleSuggestion: () => ReturnType;
    };
  }
}

export const Suggestion = Mark.create({
  name: "suggestion",

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
});
