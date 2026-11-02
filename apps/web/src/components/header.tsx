import Link from 'next/link';

export function Header() {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-page py-3">
        <Link href="/" className="text-lg font-bold text-brand-700">
          Split&amp;Go
        </Link>
      </div>
    </header>
  );
}
