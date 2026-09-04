import { cn } from "@/lib/utils";

export function TableWrap({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto rounded-xl border border-line">{children}</div>;
}

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return <table className={cn("w-full min-w-max border-collapse text-[12.5px]", className)}>{children}</table>;
}

export function Thead({ children }: { children: React.ReactNode }) {
  return <thead className="bg-soft text-left text-[10.5px] font-bold uppercase tracking-wide text-faint">{children}</thead>;
}

export function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-3 py-2.5 font-bold", className)}>{children}</th>;
}

export function Tr({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        "border-t border-line bg-panel",
        onClick && "cursor-pointer hover:bg-soft",
        className,
      )}
    >
      {children}
    </tr>
  );
}

export function Td({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLTableCellElement>) => void;
}) {
  return (
    <td onClick={onClick} className={cn("px-3 py-2.5 align-middle", className)}>
      {children}
    </td>
  );
}
