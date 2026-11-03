import { avatarSlot, initialsOf } from '@/lib/ui/avatar';
import { cn } from '@/lib/utils';

// Full class names so Tailwind can see them; slots match avatarSlot() (1..8).
const SLOT_CLASSES = [
    'bg-avatar-1 text-avatar-1-foreground',
    'bg-avatar-2 text-avatar-2-foreground',
    'bg-avatar-3 text-avatar-3-foreground',
    'bg-avatar-4 text-avatar-4-foreground',
    'bg-avatar-5 text-avatar-5-foreground',
    'bg-avatar-6 text-avatar-6-foreground',
    'bg-avatar-7 text-avatar-7-foreground',
    'bg-avatar-8 text-avatar-8-foreground',
] as const;

const SIZES = { sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-14 text-lg' } as const;

export interface AvatarProps {
    name: string;
    size?: keyof typeof SIZES;
    className?: string;
    /**
     * Set when the person's name is already printed next to the avatar: the initials are then
     * hidden from assistive technology instead of being read twice.
     */
    decorative?: boolean;
}

/** Circle with the person's initials and a colour that is stable for the same name. */
export function Avatar({ name, size = 'md', className, decorative = false }: AvatarProps) {
    return (
        <span
            role={decorative ? undefined : 'img'}
            aria-label={decorative ? undefined : name}
            aria-hidden={decorative || undefined}
            className={cn(
                'inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold',
                SIZES[size],
                SLOT_CLASSES[avatarSlot(name) - 1],
                className,
            )}
        >
            <span aria-hidden>{initialsOf(name)}</span>
        </span>
    );
}
