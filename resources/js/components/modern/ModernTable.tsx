import React from 'react';
import { colors } from '@/lib/colors';
import { ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';

interface Column<T = unknown> {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  width?: string;
  sortable?: boolean;
  disableRowClick?: boolean;
  render?: (item: T) => React.ReactNode;
}

interface Pagination {
  currentPage: number;
  totalPages: number;
  total: number;
  perPage: number;
  onPageChange: (page: number) => void;
  onPerPageChange?: (perPage: number) => void;
  rowsOptions?: number[];
}

interface ModernTableProps<T = unknown> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  renderRow?: (item: T, index: number) => React.ReactNode;
  onRowClick?: (item: T) => void;
  onSort?: (column: string) => void;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  pagination?: Pagination;
  paginationPosition?: 'top' | 'bottom' | 'both';
  onReachEnd?: () => void;
  scrollable?: boolean;
  virtualized?: boolean;
  rowHeight?: number;
  useWindowScroll?: boolean;
  /** Optional render key for content that changes without changing the rows. */
  contentKey?: string;
  /** Scroll the window to this row when using window-scroll virtualization. */
  scrollToIndex?: number;
}

const ModernTableBase = <T extends Record<string, unknown>>({
  columns,
  data,
  loading = false,
  emptyMessage = 'No data available',
  renderRow,
  onRowClick,
  onSort,
  sortColumn,
  sortDirection,
  pagination,
  paginationPosition = 'bottom',
  onReachEnd,
  scrollable = false,
  virtualized = false,
  rowHeight = 128,
  useWindowScroll = false,
  contentKey,
  scrollToIndex,
}: ModernTableProps<T>) => {
  const [scrollTop, setScrollTop] = React.useState(0);
  const viewportRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!virtualized || !useWindowScroll) return;

    const updateWindowScroll = () => {
      const element = viewportRef.current;
      if (!element) return;
      const tableTop = element.getBoundingClientRect().top + window.scrollY;
      setScrollTop(Math.max(0, window.scrollY - tableTop));
      if (onReachEnd && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 500) {
        onReachEnd();
      }
    };

    updateWindowScroll();
    window.addEventListener('scroll', updateWindowScroll, { passive: true });
    window.addEventListener('resize', updateWindowScroll);
    return () => {
      window.removeEventListener('scroll', updateWindowScroll);
      window.removeEventListener('resize', updateWindowScroll);
    };
  }, [virtualized, useWindowScroll, onReachEnd]);

  React.useEffect(() => {
    if (!virtualized || !useWindowScroll || scrollToIndex === undefined || scrollToIndex < 0) return;
    const element = viewportRef.current;
    if (!element) return;

    const tableTop = element.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({
      top: Math.max(0, tableTop + scrollToIndex * rowHeight),
      behavior: 'smooth',
    });
  }, [scrollToIndex, rowHeight, virtualized, useWindowScroll]);
  const virtualStart = virtualized ? Math.max(0, Math.floor(scrollTop / rowHeight) - 5) : 0;
  const virtualEnd = virtualized
    ? Math.min(data.length, virtualStart + Math.ceil(700 / rowHeight) + 10)
    : data.length;
  const rowsToRender = virtualized ? data.slice(virtualStart, virtualEnd) : data;
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: colors.brand.primary }}></div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div 
        ref={viewportRef}
        className={`${scrollable && !useWindowScroll ? 'max-h-[70vh] overflow-auto' : 'overflow-x-auto'} rounded-lg border`}
        onScroll={(event) => {
          if (useWindowScroll) return;
          const element = event.currentTarget;
          if (virtualized) {
            setScrollTop(element.scrollTop);
          }
          if (onReachEnd && element.scrollTop + element.clientHeight >= element.scrollHeight - 500) {
            onReachEnd();
          }
        }}
        style={{ 
          borderColor: colors.table.border,
          scrollbarWidth: 'thin',
          scrollbarColor: '#cbd5e1 #f1f5f9'
        }}
      >
        <style>{`
          /* Chrome / Safari / Edge – custom scrollbar */
          .overflow-x-auto::-webkit-scrollbar {
            height: 8px;
          }
          .overflow-x-auto::-webkit-scrollbar-track {
            background: #f1f5f9;
            border-radius: 4px;
          }
          .overflow-x-auto::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 4px;
          }
          .overflow-x-auto::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
          }
          /* Firefox – custom scrollbar (overrides scrollbarColor on the inline style
             only if a more specific scrollbar-color is needed per table instance;
             the inline scrollbarWidth/scrollbarColor handle this already) */
        `}</style>
        <table className="w-full border-collapse">
          <thead>
            <tr style={{ backgroundColor: colors.table.header }}>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-6 py-4 text-left text-sm font-semibold uppercase tracking-wider ${virtualized ? 'sticky top-0 z-10' : ''} ${column.sortable && onSort ? 'cursor-pointer hover:bg-opacity-90' : ''}`}
                  style={{
                    color: colors.table.headerText,
                    textAlign: column.align || 'left',
                    width: column.width,
                  }}
                  onClick={() => column.sortable && onSort && onSort(column.key)}
                >
                  <div className="flex items-center gap-2">
                    {column.label}
                    {column.sortable && sortColumn === column.key && (
                      <span className="text-white">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                    {column.sortable && onSort && sortColumn !== column.key && (
                      <span className="inline-flex text-white" aria-hidden="true">
                        <ArrowUpDown className="h-4 w-4 opacity-90" />
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y" style={{ backgroundColor: colors.main }}>
            {data.length === 0 ? (
              <tr>
                <td 
                  colSpan={columns.length} 
                  className="px-6 py-12 text-center"
                  style={{ color: colors.text.secondary }}
                >
                  <div className="flex flex-col items-center gap-2">
                    <svg className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm font-medium">{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              <>
                {virtualized && virtualStart > 0 && (
                  <tr aria-hidden="true">
                    <td colSpan={columns.length} style={{ height: virtualStart * rowHeight, padding: 0, border: 0 }} />
                  </tr>
                )}
                {rowsToRender.map((item, localIndex) => {
                  const index = virtualized ? virtualStart + localIndex : localIndex;
                  return (
                <tr
                  key={index}
                  className={`transition-colors duration-150 ${onRowClick ? 'cursor-pointer' : ''}`}
                  style={{
                    backgroundColor: index % 2 === 0 ? colors.table.row : colors.table.rowAlt,
                    height: virtualized ? rowHeight : undefined,
                    verticalAlign: 'top',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = colors.table.hover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = index % 2 === 0 ? colors.table.row : colors.table.rowAlt;
                  }}
                  onClick={(e) => {
                    const targetNode = e.target as Node | null;
                    const targetElement = targetNode instanceof Element ? targetNode : targetNode?.parentElement ?? null;
                    if (targetElement?.closest('[data-row-click="ignore"]')) return;
                    onRowClick?.(item);
                  }}
                >
                  {renderRow ? (
                    renderRow(item, index)
                  ) : (
                    columns.map((column) => (
                      <td
                        key={column.key}
                        className="px-6 py-4 text-sm"
                        data-row-click={column.disableRowClick ? 'ignore' : undefined}
                        style={{
                          color: colors.text.primary,
                          textAlign: column.align || 'left',
                          width: column.width,
                        }}
                      >
                        {column.render ? column.render(item) : String(item[column.key] ?? '')}
                      </td>
                    ))
                  )}
                </tr>
                  );
                })}
                {virtualized && virtualEnd < data.length && (
                  <tr aria-hidden="true">
                    <td colSpan={columns.length} style={{ height: (data.length - virtualEnd) * rowHeight, padding: 0, border: 0 }} />
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      {pagination && (
        <div className={`${paginationPosition === 'top' ? 'mb-4' : 'mt-4'} flex items-center justify-between px-4 py-3 border-t`} style={{ borderColor: colors.table.border }}>
          <div className="flex items-center gap-3">
            {pagination.rowsOptions && pagination.rowsOptions.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Rows:</label>
                <select
                  value={String(pagination.perPage)}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (pagination.onPerPageChange) pagination.onPerPageChange(val);
                  }}
                  className="h-9 px-3 rounded-md border bg-white text-sm"
                  style={{ borderColor: colors.table.border, color: colors.text.secondary }}
                >
                  {pagination.rowsOptions!.map((opt) => (
                    <option key={String(opt)} value={String(opt)}>
                      {String(opt)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="text-sm" style={{ color: colors.text.secondary }}>
              Showing {pagination.total === 0 ? 0 : ((pagination.currentPage - 1) * pagination.perPage) + 1} to {Math.min(pagination.currentPage * pagination.perPage, pagination.total)} of {pagination.total} results
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => pagination.onPageChange(Math.max(1, pagination.currentPage - 1))}
              disabled={pagination.currentPage === 1}
              className="px-3 py-1.5 rounded-lg border flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:bg-gray-50"
              style={{ borderColor: colors.table.border, color: colors.text.secondary }}
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>
            <span className="text-sm px-3" style={{ color: colors.text.secondary }}>
              Page {pagination.currentPage} of {pagination.totalPages}
            </span>
            <button
              onClick={() => pagination.onPageChange(Math.min(pagination.totalPages, pagination.currentPage + 1))}
              disabled={pagination.currentPage === pagination.totalPages}
              className="px-3 py-1.5 rounded-lg border flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:bg-gray-50"
              style={{ borderColor: colors.table.border, color: colors.text.secondary }}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Modal state changes in the parent inventory page must not rebuild thousands
// of table rows. The data/loading/streaming inputs are the only inputs that
// should invalidate the table itself; action callback closures are intentionally
// handled by the row event targets and do not affect layout.
export const ModernTable = React.memo(
  ModernTableBase,
  (previous, next) =>
    previous.data === next.data &&
    previous.loading === next.loading &&
    previous.scrollable === next.scrollable &&
    previous.onReachEnd === next.onReachEnd &&
    previous.pagination === next.pagination &&
    previous.sortColumn === next.sortColumn &&
    previous.sortDirection === next.sortDirection &&
    previous.contentKey === next.contentKey &&
    previous.scrollToIndex === next.scrollToIndex,
) as typeof ModernTableBase;
