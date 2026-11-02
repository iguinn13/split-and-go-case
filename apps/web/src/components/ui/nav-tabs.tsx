import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface NavTabItem {
  id: string;
  label: string;
  href: string;
  icon?: ReactNode;
}

/**
 * Link-based tabs for URL-driven navigation (`?tab=`). It is a server component: each tab is a
 * plain link and the current one carries `aria-current="page"`, so it works without JavaScript
 * and keeps the browser history. Tabs share the width equally (icon above the label on narrow
 * screens), so all of them are visible at 360 px without scrolling.
 */
export function NavTabs({
  label,
  items,
  activeId,
}: {
  label: string;
  items: readonly NavTabItem[];
  activeId: string;
}) {
  return (
    <nav
      aria-label={label}
      className="-mx-page border-b border-border bg-card sm:mx-0 sm:rounded-t-lg"
    >
      <ul className="flex overflow-x-auto">
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <li key={item.id} className="min-w-fit flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 border-b-2 px-0.5 py-1.5 text-[0.6875rem] font-semibold focus-visible:-outline-offset-2 sm:flex-row sm:gap-2 sm:text-sm [&_svg]:size-5 sm:[&_svg]:size-4',
                  active
                    ? 'border-primary text-link'
                    : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {item.icon}
                <span className="max-w-full">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
