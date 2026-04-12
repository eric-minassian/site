import { useCallback, useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, placeholder } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
} from "@codemirror/language";
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  Link,
  Image,
} from "lucide-react";
import { Button } from "./ui/button";

const editorTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "14px",
  },
  ".cm-editor": {
    height: "100%",
  },
  ".cm-scroller": {
    overflow: "auto",
    fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace",
  },
  ".cm-content": {
    padding: "16px",
    minHeight: "100%",
  },
  ".cm-focused": {
    outline: "none",
  },
  ".cm-line": {
    padding: "0 4px",
  },
  "&.cm-focused .cm-cursor": {
    borderLeftColor: "var(--foreground)",
  },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "var(--accent) !important",
  },
  ".cm-gutters": {
    display: "none",
  },
});

function wrapSelection(view: EditorView, before: string, after: string) {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);
  view.dispatch({
    changes: { from, to, insert: `${before}${selected}${after}` },
    selection: {
      anchor: from + before.length,
      head: to + before.length,
    },
  });
  view.focus();
}

function insertAtLineStart(view: EditorView, prefix: string) {
  const { from } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);
  view.dispatch({
    changes: { from: line.from, to: line.from, insert: prefix },
  });
  view.focus();
}

interface ToolbarAction {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  action: (view: EditorView) => void;
}

const toolbarActions: ToolbarAction[] = [
  {
    icon: Bold,
    label: "Bold",
    action: (view) => wrapSelection(view, "**", "**"),
  },
  {
    icon: Italic,
    label: "Italic",
    action: (view) => wrapSelection(view, "_", "_"),
  },
  {
    icon: Heading1,
    label: "Heading 1",
    action: (view) => insertAtLineStart(view, "# "),
  },
  {
    icon: Heading2,
    label: "Heading 2",
    action: (view) => insertAtLineStart(view, "## "),
  },
  {
    icon: Heading3,
    label: "Heading 3",
    action: (view) => insertAtLineStart(view, "### "),
  },
  {
    icon: Link,
    label: "Link",
    action: (view) => {
      const { from, to } = view.state.selection.main;
      const selected = view.state.sliceDoc(from, to);
      const text = selected || "text";
      view.dispatch({
        changes: { from, to, insert: `[${text}](url)` },
        selection: {
          anchor: from + text.length + 3,
          head: from + text.length + 6,
        },
      });
      view.focus();
    },
  },
  {
    icon: Image,
    label: "Image",
    action: (view) => {
      const { from, to } = view.state.selection.main;
      const selected = view.state.sliceDoc(from, to);
      const alt = selected || "alt text";
      view.dispatch({
        changes: { from, to, insert: `![${alt}](url)` },
        selection: {
          anchor: from + alt.length + 4,
          head: from + alt.length + 7,
        },
      });
      view.focus();
    },
  },
];

interface MarkdownEditorProps {
  initialValue: string;
  onChange: (value: string) => void;
}

export function MarkdownEditor({ initialValue, onChange }: MarkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: initialValue,
      extensions: [
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        syntaxHighlighting(defaultHighlightStyle),
        bracketMatching(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        placeholder("Start writing your site content in markdown..."),
        editorTheme,
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Only run on mount — initialValue is captured once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToolbarAction = useCallback((action: ToolbarAction) => {
    if (viewRef.current) {
      action.action(viewRef.current);
    }
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border">
      <div className="flex items-center gap-0.5 border-b bg-muted/50 px-2 py-1">
        {toolbarActions.map((action) => (
          <Button
            key={action.label}
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => handleToolbarAction(action)}
            title={action.label}
          >
            <action.icon className="h-4 w-4" />
          </Button>
        ))}
      </div>
      <div ref={containerRef} className="min-h-0 flex-1" />
    </div>
  );
}
