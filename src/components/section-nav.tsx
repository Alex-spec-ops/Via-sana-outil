/** In-page shortcuts for a long patient file; sticks under the app header while scrolling. */
export function SectionNav({ items }: { items: { id: string; label: string }[] }) {
  return (
    <nav
      aria-label="Sections du dossier"
      className="sticky top-[138px] z-10 -mx-4 flex gap-1 overflow-x-auto border-y border-border bg-background/95 px-4 py-2 text-sm backdrop-blur [scrollbar-width:none] sm:top-[86px] print:hidden"
    >
      {items.map((item) => (
        <a key={item.id} href={`#${item.id}`} className="shrink-0 rounded-md px-2.5 py-1 whitespace-nowrap text-muted hover:bg-surface hover:text-foreground">
          {item.label}
        </a>
      ))}
    </nav>
  );
}
