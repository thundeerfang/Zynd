"use client";

import * as React from "react";
import { XIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ClearableInputProps = React.ComponentProps<typeof Input> & {
  onClear?: () => void;
};

function ClearableInput({
  className,
  value,
  onClear,
  onChange,
  ...props
}: ClearableInputProps) {
  const stringValue = typeof value === "string" ? value : String(value ?? "");
  const showClear = stringValue.length > 0;

  const handleClear = () => {
    if (onClear) {
      onClear();
      return;
    }
    onChange?.({
      target: { value: "" },
    } as React.ChangeEvent<HTMLInputElement>);
  };

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={onChange}
        className={cn(showClear && "pr-8", className)}
        {...props}
      />
      {showClear ? (
        <button
          type="button"
          aria-label="Clear input"
          onClick={handleClear}
          className="absolute top-1/2 right-0 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
        >
          <XIcon className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

export { ClearableInput };
