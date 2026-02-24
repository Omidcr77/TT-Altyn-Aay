import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  useReactTable
} from "@tanstack/react-table";
import { useState } from "react";

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  getRowClassName?: (row: TData) => string | undefined;
}

export function DataTable<TData>({ columns, data, getRowClassName }: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting },
    onSortingChange: setSorting
  });

  return (
    <div className="overflow-x-auto border border-slate-200 rounded-lg">
      <table className="w-full min-w-[920px] text-sm">
        <thead className="bg-slate-100 sticky top-0 z-10">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="text-right p-2 font-semibold whitespace-nowrap"
                  aria-sort={
                    header.column.getIsSorted() === "asc"
                      ? "ascending"
                      : header.column.getIsSorted() === "desc"
                        ? "descending"
                        : "none"
                  }
                >
                  {header.isPlaceholder ? null : (
                    <button
                      className="inline-flex items-center gap-1 disabled:cursor-default"
                      onClick={header.column.getToggleSortingHandler()}
                      disabled={!header.column.getCanSort()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === "asc" && "↑"}
                      {header.column.getIsSorted() === "desc" && "↓"}
                    </button>
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className={`border-t border-slate-200 ${getRowClassName?.(row.original) || ""}`}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="p-2 align-top">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
          {!table.getRowModel().rows.length && (
            <tr>
              <td className="p-6 text-center text-slate-500" colSpan={columns.length}>
                اطلاعات موجود نیست
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
