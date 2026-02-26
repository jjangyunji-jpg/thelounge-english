import { Node, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    detailsBlock: {
      setDetailsBlock: () => ReturnType;
    };
  }
}

export const DetailsSummary = Node.create({
  name: "detailsSummary",
  group: "block",
  content: "inline*",
  defining: true,

  parseHTML() {
    return [{ tag: "summary" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["summary", mergeAttributes(HTMLAttributes, { class: "toggle-summary" }), 0];
  },
});

export const DetailsBlock = Node.create({
  name: "detailsBlock",
  group: "block",
  content: "detailsSummary block+",
  defining: true,

  addAttributes() {
    return {
      open: {
        default: true,
        parseHTML: (el: HTMLElement) => el.hasAttribute("open"),
        renderHTML: (attrs: Record<string, boolean>) => (attrs.open ? { open: "" } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "details" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "details",
      mergeAttributes(HTMLAttributes, { class: "toggle-list" }),
      0,
    ];
  },

  addCommands() {
    return {
      setDetailsBlock:
        () =>
        ({ chain }) => {
          return chain()
            .insertContent({
              type: this.name,
              attrs: { open: true },
              content: [
                {
                  type: "detailsSummary",
                  content: [{ type: "text", text: "Toggle" }],
                },
                {
                  type: "paragraph",
                },
              ],
            })
            .run();
        },
    };
  },

  addNodeView() {
    return ({ node, HTMLAttributes, getPos, editor }) => {
      const details = document.createElement("details");
      details.classList.add("toggle-list");
      if (node.attrs.open) details.setAttribute("open", "");

      details.addEventListener("toggle", () => {
        if (typeof getPos === "function") {
          const pos = getPos();
          if (pos != null) {
            editor.view.dispatch(
              editor.view.state.tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                open: details.open,
              })
            );
          }
        }
      });

      const contentDOM = document.createElement("div");
      contentDOM.classList.add("toggle-list-content");
      details.appendChild(contentDOM);

      return { dom: details, contentDOM };
    };
  },
});
