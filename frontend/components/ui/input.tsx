import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex h-11 w-full rounded-2xl border border-border bg-card-strong px-4 py-2 text-sm text-text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] outline-none transition-all duration-200 placeholder:text-text-secondary focus:border-primary focus:bg-white/88 focus:shadow-[0_0_0_4px_rgba(47,109,246,0.08)] backdrop-blur-glass",
      className,
    )}
    {...props}
  />
));

Input.displayName = "Input";

export { Input };
