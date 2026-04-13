import { useState } from "react";
import { ChevronDown, ChevronRight, Palette } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { VariableControl } from "./variable-control";
import type {
  TemplateDetail,
  TemplateSummary,
} from "../lib/api";

interface TemplateControlsProps {
  templates: TemplateSummary[];
  selectedTemplateId: string | null;
  selectedTemplate: TemplateDetail | null;
  variables: Record<string, string>;
  onSelectTemplate: (templateId: string | null) => void;
  onVariableChange: (name: string, value: string) => void;
  loading?: boolean;
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
