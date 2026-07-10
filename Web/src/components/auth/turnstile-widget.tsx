"use client";

import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { useRef } from "react";

import { env } from "@/lib/env";
import { cn } from "@/lib/utils";

type TurnstileWidgetProps = {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  resetKey?: string | number;
  className?: string;
};

export function TurnstileWidget({
  onVerify,
  onExpire,
  resetKey,
  className,
}: TurnstileWidgetProps) {
  const ref = useRef<TurnstileInstance>(null);

  if (!env.turnstileSiteKey) {
    return null;
  }

  return (
    <div className={cn("flex min-h-[65px] justify-center", className)}>
      <Turnstile
        key={resetKey}
        ref={ref}
        siteKey={env.turnstileSiteKey}
        onSuccess={onVerify}
        onExpire={() => {
          onExpire?.();
          ref.current?.reset();
        }}
        options={{
          theme: "light",
          size: "flexible",
        }}
      />
    </div>
  );
}

export function isTurnstileRequired() {
  return Boolean(env.turnstileSiteKey);
}
