import { Plus, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import type { TemplateVariable } from "../lib/api";

const VARIABLE_TYPES: TemplateVariable["type"][] = [
  "text",
  "color",
  "font",
  "number",
  "select",
];

interface VariableDefinitionEditorProps {
  variables: TemplateVariable[];
  onChange: (variables: TemplateVariable[]) => void;
}

export function VariableDefinitionEditor({
  variables,
  onChange,
}: VariableDefinitionEditorProps) {
  const addVariable = () => {
    onChange([
      ...variables,
      { name: "", label: "", type: "text", default: "" },
    ]);
  };

  const updateVariable = (
    index: number,
    updates: Partial<TemplateVariable>,
  ) => {
    const next = variables.map((v, i) =>
      i === index ? { ...v, ...updates } : v,
    );
    onChange(next);
  };

  const removeVariable = (index: number) => {
    onChange(variables.filter((_, i) => i !== index));
  };

  const updateOption = (varIndex: number, optIndex: number, value: string) => {
    const v = variables[varIndex];
    const opts = [...(v.options ?? [])];
    opts[optIndex] = value;
    updateVariable(varIndex, { options: opts });
  };

  const addOption = (varIndex: number) => {
    const v = variables[varIndex];
    updateVariable(varIndex, { options: [...(v.options ?? []), ""] });
  };

  const removeOption = (varIndex: number, optIndex: number) => {
    const v = variables[varIndex];
    updateVariable(varIndex, {
      options: (v.options ?? []).filter((_, i) => i !== optIndex),
    });
  };

  return (
    <div className="space-y-3">
      {variables.map((v, i) => (
        <div key={i} className="rounded-md border p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Input
              value={v.name}
              onChange={(e) => updateVariable(i, { name: e.target.value })}
              placeholder="name"
              className="h-7 flex-1 font-mono text-xs"
            />
            <Input
              value={v.label}
              onChange={(e) => updateVariable(i, { label: e.target.value })}
              placeholder="Label"
              className="h-7 flex-1 text-xs"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => removeVariable(i)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={v.type}
              onValueChange={(val: TemplateVariable["type"]) => {
                const updates: Partial<TemplateVariable> = { type: val };
                if (val === "select" && !v.options?.length) {
                  updates.options = [""];
                }
                if (val !== "select") {
                  updates.options = undefined;
                }
                updateVariable(i, updates);
              }}
            >
              <SelectTrigger className="h-7 w-24 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VARIABLE_TYPES.map((t) => (
                  <SelectItem key={t} value={t} className="text-xs">
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={v.default}
              onChange={(e) => updateVariable(i, { default: e.target.value })}
              placeholder="Default value"
              className="h-7 flex-1 text-xs"
              type={v.type === "color" ? "color" : v.type === "number" ? "number" : "text"}
            />
          </div>
          {v.type === "select" && (
            <div className="space-y-1 pl-2">
              <span className="text-xs text-muted-foreground">Options:</span>
              {(v.options ?? []).map((opt, oi) => (
                <div key={oi} className="flex items-center gap-1">
                  <Input
                    value={opt}
                    onChange={(e) => updateOption(i, oi, e.target.value)}
                    placeholder={`Option ${oi + 1}`}
                    className="h-6 flex-1 text-xs"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeOption(i, oi)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => addOption(i)}
              >
                <Plus className="mr-1 h-3 w-3" />
                Add option
              </Button>
            </div>
          )}
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full" onClick={addVariable}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Add Variable
      </Button>
    </div>
  );
}
