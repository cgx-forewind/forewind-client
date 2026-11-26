import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-5", {
  variants: {
    variant: {
      default: "bg-slate-100 text-slate-700",
      primary: "bg-primary-50 text-primary",
      ok: "bg-ok-soft text-ok-ink",
      warn: "bg-warn-soft text-warn-ink",
      crit: "bg-crit-soft text-crit-ink",
      ai: "bg-ai-soft text-ai-ink",
      outline: "border border-line text-muted bg-white",
    },
  },
  defaultVariants: { variant: "default" },
});
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}
export const Badge = ({ className, variant, ...p }: BadgeProps) => <span className={cn(badgeVariants({ variant }), className)} {...p} />;
