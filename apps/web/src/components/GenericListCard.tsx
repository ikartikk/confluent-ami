import type { ReactNode } from "react";

type Props<T> = {
  title: string;
  items: T[];
  emptyLabel: string;
  renderItem: (item: T, index: number) => ReactNode;
};

export default function GenericListCard<T>({
  title,
  items,
  emptyLabel,
  renderItem
}: Props<T>) {
  return (
    <div className="rounded-2xl border border-panel-border bg-panel p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h3>
        <span className="text-xs text-muted">{items.length} events</span>
      </div>
      <div className="mt-4 max-h-64 space-y-3 overflow-y-auto text-sm">
        {items.length === 0 ? (
          <p className="text-sm text-muted">{emptyLabel}</p>
        ) : (
          items.map((item, index) => <div key={index}>{renderItem(item, index)}</div>)
        )}
      </div>
    </div>
  );
}
