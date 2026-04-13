import { useState } from "react";
import { ChevronDown, ChevronRight, Palette } from "lucide-react";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import type {
  TemplateDetail,
  TemplateSummary,
  TemplateVariable,
} from "../lib/api";

const FONT_OPTIONS = [
  { value: "system-ui, sans-serif", label: "System Default" },
  { value: "Arial, sans-serif", label: "Arial" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "'Times New Roman', serif", label: "Times New Roman" },
  { value: "'Courier New', monospace", label: "Courier New" },
  { value: "Verdana, sans-serif", label: "Verdana" },
  { value: "'Trebuchet MS', sans-serif", label: "Trebuchet MS" },
  { value: "Palatino, serif", label: "Palatino" },
  { value: "Garamond, serif", label: "Garamond" },
  { value: "'Segoe UI', sans-serif", label: "Segoe UI" },
  { value: "Tahoma, sans-serif", label: "Tahoma" },
  { value: "'Lucida Console', monospace", label: "Lucida Console" },
];

interface TemplateControlsProps {
  templates: TemplateSummary[];
  selectedTemplateId: string | null;
  selectedTemplate: TemplateDetail | null;
  variables: Record<string, string>;
  onSelectTemplate: (templateId: string | null) => void;
  onVariableChange: (name: string, value: string) => void;
  loading?: boolean;
}

function VariableControl({
  variable,
  value,
  onChange,
}: {
  variable: TemplateVariable;
  value: string;
  onChange: (value: string) => void;
}) {
  const current = value || variable.default;

  switch (variable.type) {
    case "color":
      return (
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={current}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 w-8 shrink-0 cursor-pointer rounded border border-input"
          />
          <Input
            value={current}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 font-mono text-xs"
          />
        </div>
      );

    case "font":
      return (
        <Select value={current} onValueChange={onChange}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONT_OPTIONS.map((font) => (
              <SelectItem key={font.value} value={font.value} className="text-xs">
                <span style={{ fontFamily: font.value }}>{font.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case "number":
      return (
        <Input
          type="number"
          value={current}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 text-xs"
        />
      );

    case "select":
      return (
        <Select value={current} onValueChange={onChange}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(variable.options ?? []).map((opt) => (
              <SelectItem key={opt} value={opt} className="text-xs">
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case "text":
    default:
      return (
        <Input
          type="text"
          value={current}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 text-xs"
          placeholder={variable.default}
        />
      );
  }
}

export function TemplateControls({
  templates,
  selectedTemplateId,
  selectedTemplate,
  variables,
  onSelectTemplate,
  onVariableChange,
  loading,
}: TemplateControlsProps) {
  const [expanded, setExpanded] = useState(true);

  const templateVariables = selectedTemplate?.variables ?? [];
  const hasVariables = templateVariables.length > 0;

  return (
    <div className="shrink-0 border-b">
      <button
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:bg-muted/50"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        )}
        <Palette className="h-3.5 w-3.5 shrink-0" />
        <span>Template</span>
        {selectedTemplate && !expanded && (
          <span className="truncate text-foreground">
            {selectedTemplate.name}
          </span>
        )}
      </button>

      {expanded && (
        <div className="space-y-3 px-3 pb-3">
          <Select
            value={selectedTemplateId ?? "none"}
            onValueChange={(val) =>
              onSelectTemplate(val === "none" ? null : val)
            }
            disabled={loading}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="No template" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="text-xs">
                No template
              </SelectItem>
              {templates.map((t) => (
                <SelectItem
                  key={t.templateId}
                  value={t.templateId}
                  className="text-xs"
                >
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasVariables && (
            <div className="space-y-2">
              {templateVariables.map((v) => (
                <div key={v.name}>
                  <label className="mb-1 block text-xs text-muted-foreground">
                    {v.label}
                  </label>
                  <VariableControl
                    variable={v}
                    value={variables[v.name] ?? ""}
                    onChange={(val) => onVariableChange(v.name, val)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
