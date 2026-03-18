import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-2xl text-sm font-semibold tracking-[-0.01em] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "border border-primary/20 bg-[linear-gradient(180deg,rgba(83,136,255,0.96),rgba(47,109,246,0.96))] text-text-inverse shadow-[0_16px_28px_rgba(47,109,246,0.28)] hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(47,109,246,0.34)]",
        secondary:
          "border border-border bg-card-strong text-text-primary shadow-[0_10px_24px_rgba(109,132,176,0.12)] backdrop-blur-glass hover:-translate-y-0.5 hover:bg-hover",
        danger:
          "border border-priority-critical/20 bg-[linear-gradient(180deg,rgba(255,110,118,0.96),rgba(255,77,87,0.96))] text-text-inverse shadow-[0_16px_28px_rgba(255,77,87,0.22)] hover:-translate-y-0.5 hover:shadow-[0_20px_34px_rgba(255,77,87,0.28)]",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 px-3.5",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  ),
);

Button.displayName = "Button";

export { Button, buttonVariants };
