import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, placeholder as cmPlaceholder } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
} from "@codemirror/language";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";

const editorTheme = EditorView.theme({
  "&": { height: "100%", fontSize: "14px" },
  ".cm-editor": { height: "100%" },
  ".cm-scroller": {
    overflow: "auto",
    fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace",
  },
  ".cm-content": { padding: "16px", minHeight: "100%" },
  ".cm-focused": { outline: "none" },
  ".cm-line": { padding: "0 4px" },
  "&.cm-focused .cm-cursor": { borderLeftColor: "var(--foreground)" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "var(--accent) !important",
  },
  ".cm-gutters": { display: "none" },
});

const languageExtensions = {
  html: () => html(),
  css: () => css(),
} as const;

interface CodeEditorProps {
  initialValue: string;
  language: "html" | "css";
  onChange: (value: string) => void;
  placeholder?: string;
}

export function CodeEditor({
  initialValue,
  language,
  onChange,
  placeholder,
}: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current) return;

    const extensions = [
      languageExtensions[language](),
      syntaxHighlighting(defaultHighlightStyle),
      bracketMatching(),
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      editorTheme,
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChangeRef.current(update.state.doc.toString());
        }
      }),
    ];

    if (placeholder) {
      extensions.push(cmPlaceholder(placeholder));
    }

    const state = EditorState.create({ doc: initialValue, extensions });
    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className="min-h-0 flex-1" />;
}
