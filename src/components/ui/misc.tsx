import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={cn("h-9 w-full rounded-lg border border-line bg-white px-3 text-sm text-navy placeholder:text-slate-400 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent", className)} {...p} />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => (
  <textarea ref={ref} className={cn("w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-navy placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent", className)} {...p} />
));
Textarea.displayName = "Textarea";

export const Skeleton = ({ className }: { className?: string }) => <div aria-hidden className={cn("animate-pulse rounded-md bg-slate-200/70", className)} />;

export const Progress = ({ value, className, color = "#0057B8" }: { value: number; className?: string; color?: string }) => (
  <div role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100} className={cn("h-1.5 w-full overflow-hidden rounded-full bg-slate-100", className)}>
    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }} />
  </div>
);

export const Switch = React.forwardRef<React.ElementRef<typeof SwitchPrimitive.Root>, React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>>(({ className, ...p }, ref) => (
  <SwitchPrimitive.Root ref={ref} className={cn("peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full bg-slate-300 transition data-[state=checked]:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent", className)} {...p}>
    <SwitchPrimitive.Thumb className="block h-4 w-4 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[18px]" />
  </SwitchPrimitive.Root>
));
Switch.displayName = "Switch";

export const Tabs = TabsPrimitive.Root;
export const TabsList = ({ className, ...p }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>) => (
  <TabsPrimitive.List className={cn("inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1", className)} {...p} />
);
export const TabsTrigger = ({ className, ...p }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) => (
  <TabsPrimitive.Trigger className={cn("rounded-md px-3 py-1.5 text-xs font-medium text-muted transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent data-[state=active]:bg-white data-[state=active]:text-navy data-[state=active]:shadow-card", className)} {...p} />
);
export const TabsContent = ({ className, ...p }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>) => (
  <TabsPrimitive.Content className={cn("mt-4 focus-visible:outline-none animate-fadeIn", className)} {...p} />
);

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;
export const DialogContent = ({ className, children, side = "center", ...p }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { side?: "center" | "right" | "left" }) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-navy/40 backdrop-blur-[2px] animate-fadeIn" />
    <DialogPrimitive.Content
      className={cn(
        "fixed z-50 bg-white shadow-pop focus-visible:outline-none animate-slideUp",
        side === "center" && "left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl p-5",
        side === "right" && "right-0 top-0 h-full w-full max-w-md border-l border-line",
        side === "left" && "left-0 top-0 h-full w-72 border-r border-line",
        className,
      )}
      {...p}
    >
      {children}
      {side === "center" && (
        <DialogPrimitive.Close aria-label="Close" className="absolute right-3 top-3 rounded-md p-1 text-muted hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-accent">
          <X className="h-4 w-4" />
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
);

export const DropdownMenu = DropdownPrimitive.Root;
export const DropdownTrigger = DropdownPrimitive.Trigger;
export const DropdownContent = ({ className, ...p }: React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Content>) => (
  <DropdownPrimitive.Portal>
    <DropdownPrimitive.Content sideOffset={6} align="end" className={cn("z-50 min-w-[14rem] rounded-xl border border-line bg-white p-1.5 shadow-pop animate-slideUp", className)} {...p} />
  </DropdownPrimitive.Portal>
);
export const DropdownItem = ({ className, ...p }: React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Item>) => (
  <DropdownPrimitive.Item className={cn("flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-navy outline-none data-[highlighted]:bg-slate-100", className)} {...p} />
);
export const DropdownLabel = ({ className, ...p }: React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Label>) => (
  <DropdownPrimitive.Label className={cn("px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted", className)} {...p} />
);
export const DropdownSep = () => <DropdownPrimitive.Separator className="my-1 h-px bg-line" />;

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverContent = ({ className, ...p }: React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content sideOffset={8} align="end" className={cn("z-50 rounded-xl border border-line bg-white shadow-pop animate-slideUp focus-visible:outline-none", className)} {...p} />
  </PopoverPrimitive.Portal>
);
