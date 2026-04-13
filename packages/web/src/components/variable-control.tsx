import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import type { TemplateVariable } from "../lib/api";
import { FONT_OPTIONS } from "../lib/template-utils";

export function VariableControl({
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
            aria-label={variable.label}
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
