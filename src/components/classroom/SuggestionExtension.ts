import { Mark, mergeAttributes } from "@tiptap/core";

/* ── 편집 제안: 삭제 표시 (빨간 취소선) ── */

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    suggestionDelete: {
      setSuggestionDelete: () => ReturnType;
      unsetSuggestionDelete: () => ReturnType;
    };
    suggestion: {
      setSuggestion: () => ReturnType;
      unsetSuggestion: () => ReturnType;
      toggleSuggestion: () => ReturnType;
    };
  }
}

export const SuggestionDelete = Mark.create({
  name: "suggestionDelete",
  keepOnSplit: false,

  parseHTML() {
    return [{ tag: "span[data-suggestion-delete]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-suggestion-delete": "",
        class: "suggestion-delete-mark",
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setSuggestionDelete:
        () =>
        ({ commands }) => commands.setMark(this.name),
      unsetSuggestionDelete:
        () =>
        ({ commands }) => commands.unsetMark(this.name),
    };
  },
});

/* ── 편집 제안: 추가 표시 (파란 밑줄) ── */

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
});
