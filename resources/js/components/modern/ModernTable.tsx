import React from 'react';
import { colors } from '@/lib/colors';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Column<T = unknown> {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  width?: string;
  sortable?: boolean;
  render?: (item: T) => React.ReactNode;
}

interface Pagination {
  currentPage: number;
  totalPages: number;
  total: number;
  perPage: number;
  onPageChange: (page: number) => void;
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
}

export const ModernTable = <T extends Record<string, unknown>>({
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
}: ModernTableProps<T>) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: colors.brand.primary }}></div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: colors.table.border }}>
        <table className="w-full border-collapse">
          <thead>
            <tr style={{ backgroundColor: colors.table.header }}>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-6 py-4 text-left text-sm font-semibold uppercase tracking-wider ${column.sortable && onSort ? 'cursor-pointer hover:bg-opacity-90' : ''}`}
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
              data.map((item, index) => (
                <tr
                  key={index}
                  className={`transition-colors duration-150 ${onRowClick ? 'cursor-pointer' : ''}`}
                  style={{
                    backgroundColor: index % 2 === 0 ? colors.table.row : colors.table.rowAlt,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = colors.table.hover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = index % 2 === 0 ? colors.table.row : colors.table.rowAlt;
                  }}
                  onClick={() => onRowClick?.(item)}
                >
                  {renderRow ? (
                    renderRow(item, index)
                  ) : (
                    columns.map((column) => (
                      <td
                        key={column.key}
                        className="px-6 py-4 text-sm"
                        style={{
                          color: colors.text.primary,
                          textAlign: column.align || 'left',
                        }}
                      >
                        {column.render ? column.render(item) : String(item[column.key] ?? '')}
                      </td>
                    ))
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: colors.table.border }}>
          <div className="text-sm" style={{ color: colors.text.secondary }}>
            Showing {((pagination.currentPage - 1) * pagination.perPage) + 1} to {Math.min(pagination.currentPage * pagination.perPage, pagination.total)} of {pagination.total} results
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => pagination.onPageChange(pagination.currentPage - 1)}
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
              onClick={() => pagination.onPageChange(pagination.currentPage + 1)}
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
