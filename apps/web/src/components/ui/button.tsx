import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Class names are exported so links can look like buttons: <Link className={buttonVariants()}>. */
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60 aria-busy:cursor-progress aria-busy:disabled:opacity-100 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary-hover',
        secondary: 'border border-input bg-card text-card-foreground hover:bg-accent',
        danger: 'bg-destructive text-destructive-foreground hover:bg-destructive-hover',
        ghost: 'text-foreground hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        default: 'min-h-11 px-4 py-2',
        sm: 'min-h-9 px-3 py-1.5',
        lg: 'min-h-12 px-6 py-3 text-base',
        icon: 'size-11',
      },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** Shows a spinner, sets aria-busy and blocks clicks while keeping the label visible. */
  loading?: boolean;
  /** Decorative icon rendered before the label (use aria-label for icon-only buttons). */
  icon?: ReactNode;
}

export function Button({
  variant,
  size,
  className,
  type = 'button',
  loading = false,
  icon,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 aria-hidden className="animate-spin" /> : icon}
      {children}
    </button>
  );
}
