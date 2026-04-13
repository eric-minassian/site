import { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
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
  Loader2,
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
];

const IMAGE_ACCEPT = "image/png,image/jpeg,image/gif,image/webp,image/svg+xml";

function isImageFile(file: File): boolean {
  return IMAGE_ACCEPT.split(",").includes(file.type);
}

function insertImageMarkdown(view: EditorView, alt: string, url: string) {
  const { from } = view.state.selection.main;
  const insert = `![${alt}](${url})`;
  view.dispatch({ changes: { from, insert } });
  view.focus();
}

export interface MarkdownEditorHandle {
  /** Replace the entire editor content programmatically. */
  replaceAll: (content: string) => void;
}

interface MarkdownEditorProps {
  initialValue: string;
  onChange: (value: string) => void;
  onImageUpload?: (file: File) => Promise<string>;
}

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(function MarkdownEditor({
  initialValue,
  onChange,
  onImageUpload,
}: MarkdownEditorProps, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  const onImageUploadRef = useRef(onImageUpload);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  onChangeRef.current = onChange;
  onImageUploadRef.current = onImageUpload;

  useImperativeHandle(ref, () => ({
    replaceAll(content: string) {
      const view = viewRef.current;
      if (!view) return;
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: content },
      });
    },
  }));

  const handleUpload = useCallback(async (file: File) => {
    const view = viewRef.current;
    const uploadFn = onImageUploadRef.current;
    if (!view || !uploadFn) return;

    setUploading(true);
    setUploadError(null);
    try {
      const imageUrl = await uploadFn(file);
      const alt = file.name.replace(/\.[^.]+$/, "");
      insertImageMarkdown(view, alt, imageUrl);
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Image upload failed",
      );
      setTimeout(() => setUploadError(null), 4000);
    } finally {
      setUploading(false);
    }
  }, []);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      const imageFile = Array.from(files).find(isImageFile);
      if (imageFile) handleUpload(imageFile);
    },
    [handleUpload],
  );

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
        EditorView.domEventHandlers({
          drop(event) {
            const files = event.dataTransfer?.files;
            if (files && Array.from(files).some(isImageFile)) {
              event.preventDefault();
              const imageFile = Array.from(files).find(isImageFile);
              if (imageFile && onImageUploadRef.current) {
                // Use setTimeout to avoid calling setState during render
                setTimeout(() => {
                  const view = viewRef.current;
                  const uploadFn = onImageUploadRef.current;
                  if (!view || !uploadFn) return;
                  setUploading(true);
                  setUploadError(null);
                  uploadFn(imageFile)
                    .then((url) => {
                      const alt = imageFile.name.replace(/\.[^.]+$/, "");
                      insertImageMarkdown(view, alt, url);
                    })
                    .catch((err) => {
                      setUploadError(
                        err instanceof Error
                          ? err.message
                          : "Image upload failed",
                      );
                      setTimeout(() => setUploadError(null), 4000);
                    })
                    .finally(() => setUploading(false));
                }, 0);
              }
              return true;
            }
            return false;
          },
          paste(event) {
            const files = event.clipboardData?.files;
            if (files && Array.from(files).some(isImageFile)) {
              event.preventDefault();
              const imageFile = Array.from(files).find(isImageFile);
              if (imageFile && onImageUploadRef.current) {
                setTimeout(() => {
                  const view = viewRef.current;
                  const uploadFn = onImageUploadRef.current;
                  if (!view || !uploadFn) return;
                  setUploading(true);
                  setUploadError(null);
                  uploadFn(imageFile)
                    .then((url) => {
                      const alt = imageFile.name.replace(/\.[^.]+$/, "");
                      insertImageMarkdown(view, alt, url);
                    })
                    .catch((err) => {
                      setUploadError(
                        err instanceof Error
                          ? err.message
                          : "Image upload failed",
                      );
                      setTimeout(() => setUploadError(null), 4000);
                    })
                    .finally(() => setUploading(false));
                }, 0);
              }
              return true;
            }
            return false;
          },
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
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => fileInputRef.current?.click()}
          title="Upload image"
          disabled={uploading || !onImageUpload}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Image className="h-4 w-4" />
          )}
        </Button>
        {uploadError && (
          <span className="ml-2 text-xs text-destructive">{uploadError}</span>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <div ref={containerRef} className="min-h-0 flex-1" />
    </div>
  );
});
