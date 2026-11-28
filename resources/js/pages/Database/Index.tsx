import { Head } from '@inertiajs/react';
import axios from 'axios';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, Database as DatabaseIcon, Edit3, Filter, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ModernButton, ModernCard, ModernTable, ToastContainer, useModernToast } from '@/components/modern';
import { colors } from '@/lib/colors';

type Row = Record<string, unknown>;
type TableInfo = { name: string; label: string; rows: number };
type Access = { acs_edit: number; acs_delete: number };
type PaginationState = { current_page: number; last_page: number; per_page: number; total: number };
type ColumnDetails = { type: string; nullable: boolean; default: unknown; extra: string; enum_options: string[] };

export default function Index() {
    const { toasts, removeToast, success, error } = useModernToast();
    const [tables, setTables] = useState<TableInfo[]>([]);
    const [selectedTable, setSelectedTable] = useState('');
    const [columns, setColumns] = useState<string[]>([]);
    const [columnDetails, setColumnDetails] = useState<Record<string, ColumnDetails>>({});
    const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
    const [primaryKey, setPrimaryKey] = useState<string | null>(null);
    const [rows, setRows] = useState<Row[]>([]);
    const [access, setAccess] = useState<Access>({ acs_edit: 0, acs_delete: 0 });
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
    const [sort, setSort] = useState('');
    const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(25);
    const [pagination, setPagination] = useState<PaginationState>({ current_page: 1, last_page: 1, per_page: 25, total: 0 });
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [editing, setEditing] = useState<Row | null>(null);
    const [creating, setCreating] = useState(false);
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [showColumnsModal, setShowColumnsModal] = useState(false);
    const [showBackToTop, setShowBackToTop] = useState(false);
    const headerCheckboxRef = useRef<HTMLInputElement | null>(null);
    const visibleColumnsTableRef = useRef('');

    const loadTables = async () => {
        try {
            const response = await axios.get('/api/database/tables');
            const list = response.data.data ?? [];
            setTables(list);
            setAccess(response.data.access ?? { acs_edit: 0, acs_delete: 0 });
            if (!selectedTable && list[0]) setSelectedTable(list[0].name);
        } catch { error('Unable to load database tables.'); }
    };

    const loadRows = async (targetPage = page, overrides?: { search?: string; filters?: Record<string, string> }) => {
        if (!selectedTable) return;
        const requestedTable = selectedTable;
        setLoading(true);
        try {
            const response = await axios.get('/api/database/rows', { params: {
                table: selectedTable, page: targetPage, per_page: perPage,
                search: overrides?.search ?? search, sort: sort || undefined, direction,
                filters: JSON.stringify(overrides?.filters ?? columnFilters),
            } });
            if (selectedTable !== requestedTable) return;
            const data = response.data;
            const nextColumns: string[] = data.columns ?? [];
            setRows(data.data ?? []);
            setColumns(nextColumns);
            setColumnDetails(data.column_details ?? {});
            setPrimaryKey(data.primary_key ?? null);
            if (visibleColumnsTableRef.current !== requestedTable) {
                visibleColumnsTableRef.current = requestedTable;
                setVisibleColumns(nextColumns);
            } else {
                setVisibleColumns((current) => current.filter((column) => nextColumns.includes(column)));
            }
            setPagination(data.pagination ?? { current_page: 1, last_page: 1, per_page: perPage, total: 0 });
            setSelectedIds([]);
            if (!sort && data.primary_key) setSort(data.primary_key);
        } catch { error('Unable to load table records.'); }
        finally { setLoading(false); }
    };

    // Loaders intentionally run when the selected table/query state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { void loadTables(); }, []);
    useEffect(() => { setPage(1); setSearch(''); setColumnFilters({}); setSelectedIds([]); setSort(''); setDirection('desc'); }, [selectedTable]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { void loadRows(page); }, [selectedTable, page, perPage, sort, direction]);
    useEffect(() => {
        const handleScroll = () => setShowBackToTop(window.scrollY > 200);
        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll();
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const allSelected = rows.length > 0 && rows.every((row) => selectedIds.includes(String(row[primaryKey ?? ''])));
    const someSelected = selectedIds.length > 0 && !allSelected;
    const selectionCheckmark = (color: string) => `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='none' stroke='${color.replace('#', '%23')}' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m3 8 3 3 7-7'/%3E%3C/svg%3E")`;
    useEffect(() => {
        if (headerCheckboxRef.current) headerCheckboxRef.current.indeterminate = someSelected;
    }, [someSelected]);
    const toggleAll = () => setSelectedIds(allSelected ? [] : rows.map((row) => String(row[primaryKey ?? ''])));
    const toggleId = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
    const displayColumns = useMemo(() => visibleColumns.filter((column) => columns.includes(column)), [visibleColumns, columns]);
    const runSearch = () => { setPage(1); void loadRows(1); };
    const resetSearch = () => { setSearch(''); setPage(1); void loadRows(1, { search: '' }); };
    const resetFilters = () => { setColumnFilters({}); setPage(1); void loadRows(1, { filters: {} }); };
    const resetColumns = () => setVisibleColumns([...columns]);

    const openCreate = () => {
        const initial = columns.reduce<Row>((values, column) => {
            const meta = columnDetails[column];
            values[column] = meta?.default ?? (/^(tinyint\(1\)|boolean|bool)$/.test(meta?.type ?? '') ? '0' : '');
            return values;
        }, {});
        setCreating(true);
        setEditing(initial);
    };

    const deleteRow = async (row: Row) => {
        if (!primaryKey || !selectedTable || !confirm('Delete this record? This action cannot be undone.')) return;
        try {
            await axios.delete('/api/database/rows', { data: { table: selectedTable, ids: [row[primaryKey]] } });
            success('Record deleted.');
            void loadRows(page);
        } catch (err: unknown) {
            const response = (err as { response?: { data?: { message?: string } } }).response;
            error(response?.data?.message ?? 'Unable to delete record.');
        }
    };

    const deleteSelected = async () => {
        if (!selectedTable || !selectedIds.length || !confirm(`Delete ${selectedIds.length} selected record(s)?`)) return;
        try { await axios.delete('/api/database/rows', { data: { table: selectedTable, ids: selectedIds } }); success('Records deleted.'); void loadRows(page); }
        catch { error('Unable to delete selected records.'); }
    };

    const saveRow = async () => {
        if (!editing || (!creating && !primaryKey)) return;
        try {
            if (creating) {
                await axios.post('/api/database/row', { table: selectedTable, values: editing });
                success('Record added.');
            } else {
                await axios.put('/api/database/row', { table: selectedTable, id: editing[primaryKey], values: editing });
                success('Record updated.');
            }
            setEditing(null); setCreating(false); void loadRows(page);
        } catch (err: unknown) {
            const response = (err as { response?: { data?: { message?: string } } }).response;
            error(response?.data?.message ?? 'Unable to update record.');
        }
    };

    const inputType = (column: string) => {
        const type = columnDetails[column]?.type ?? '';
        if (type.includes('date') && !type.includes('datetime')) return 'date';
        if (type.includes('datetime') || type.includes('timestamp')) return 'datetime-local';
        if (type.includes('time')) return 'time';
        if (/^(tinyint|smallint|mediumint|int|bigint|decimal|numeric|float|double)/.test(type)) return 'number';
        return 'text';
    };

    const inputValue = (column: string, value: unknown) => {
        if (value == null) return '';
        if (inputType(column) === 'datetime-local') return String(value).replace(' ', 'T').slice(0, 19);
        return String(value);
    };

    const updateEditingValue = (column: string, value: string | boolean) => {
        setEditing((current) => {
            if (!current) return current;
            const type = columnDetails[column]?.type ?? '';
            const normalized = typeof value === 'string' && (type.includes('datetime') || type.includes('timestamp')) ? value.replace('T', ' ') : value;
            return { ...current, [column]: normalized };
        });
    };

    const tableColumns = [
        { key: '_select', label: '', width: '110px', disableRowClick: true, headerRender: () => <div className="flex items-center gap-2 normal-case tracking-normal"><input ref={headerCheckboxRef} aria-label="Select all records" type="checkbox" checked={allSelected} onChange={toggleAll} onClick={(event) => event.stopPropagation()} className="h-4 w-4 appearance-none rounded border border-gray-600 bg-gray-100 bg-center bg-no-repeat checked:bg-white" style={{ backgroundColor: allSelected || someSelected ? '#ffffff' : '#f3f4f6', backgroundImage: allSelected || someSelected ? selectionCheckmark('#2563eb') : 'none' }} /><span className="whitespace-nowrap text-xs font-semibold">{selectedIds.length}/{rows.length}</span></div>, render: (row: Row) => { const selected = selectedIds.includes(String(row[primaryKey ?? ''])); return <input aria-label="Select record" type="checkbox" checked={selected} onChange={() => toggleId(String(row[primaryKey ?? '']))} onClick={(event) => event.stopPropagation()} className="h-4 w-4 appearance-none rounded border border-gray-600 bg-gray-100 bg-center bg-no-repeat checked:bg-blue-600" style={{ backgroundImage: selected ? selectionCheckmark('#ffffff') : 'none' }} />; } },
        ...displayColumns.map((column) => ({ key: column, label: column.replaceAll('_', ' '), sortable: true, render: (row: Row) => <span className="block max-w-[280px] truncate text-gray-900" title={String(row[column] ?? '')}>{row[column] === null ? <em className="text-gray-500">NULL</em> : String(row[column])}</span> })),
        { key: '_actions', label: 'Actions', width: access.acs_delete > 0 && primaryKey ? '190px' : '100px', disableRowClick: true, render: (row: Row) => <div className="flex items-center gap-2">{primaryKey && <ModernButton variant="secondary" size="sm" icon={<Edit3 className="h-4 w-4" />} onClick={() => { setCreating(false); setEditing({ ...row }); }}>Edit</ModernButton>}{access.acs_delete > 0 && primaryKey && <ModernButton variant="delete" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => void deleteRow(row)}>Delete</ModernButton>}</div> },
    ];

    return <AuthenticatedLayout>
        <Head title="Database" />
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="rounded-xl p-3" style={{ backgroundColor: colors.brand.primary }}><DatabaseIcon className="h-6 w-6 text-white" /></div>
                <div><h1 className="text-3xl font-bold text-gray-900">Database</h1><p className="mt-1 text-sm text-gray-700">Browse and manage database records</p></div>
            </div>

            <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
                <ModernCard className="flex h-full min-h-0 flex-col lg:sticky lg:top-6 lg:h-[calc(100vh-8rem)] lg:min-h-[calc(100vh-8rem)] lg:max-h-[calc(100vh-8rem)] [&>div:last-child]:min-h-0 [&>div:last-child]:flex-1" title="Database Tables" subtitle="Choose a table" icon={<DatabaseIcon className="h-5 w-5" />}>
                    <div className="database-table-scrollbar h-full min-h-[260px] overflow-y-auto overflow-x-hidden pr-1 lg:min-h-0"><div className="space-y-1">
                        {tables.map((table) => <button key={table.name} onClick={() => setSelectedTable(table.name)} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${selectedTable === table.name ? 'bg-blue-50 font-semibold text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}><span className="truncate">{table.label}</span><span className="ml-2 text-xs text-gray-500">{table.rows}</span></button>)}
                    </div></div>
                </ModernCard>

                <div className="min-w-0 space-y-4">
                    <ModernCard title={selectedTable ? tables.find((table) => table.name === selectedTable)?.label : 'Select a table'} subtitle="Add, edit, or delete records only. Database structure cannot be changed here." icon={<DatabaseIcon className="h-5 w-5" />} headerAction={<div className="flex items-center gap-2"><ModernButton variant="add" size="sm" icon={<Plus className="h-4 w-4" />} onClick={openCreate} disabled={!selectedTable || access.acs_edit <= 0}>Add</ModernButton><ModernButton variant="secondary" size="sm" icon={<RefreshCw className="h-4 w-4" />} onClick={() => void loadRows(page)}>Refresh</ModernButton></div>}>
                        <div className="flex flex-wrap items-end gap-3">
                            <div className="min-w-[240px] flex-1"><label className="mb-1 block text-xs font-semibold uppercase text-gray-700">Search all columns</label><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" /><Input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') runSearch(); }} placeholder="Search records..." className="border-gray-300 pl-9 text-gray-900 placeholder:text-gray-500" /></div></div>
                            <ModernButton variant="primary" icon={<Search className="h-4 w-4" />} onClick={runSearch}>Search</ModernButton>
                            <button type="button" onClick={resetSearch} title="Reset search" aria-label="Reset search" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 shadow-sm transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"><RefreshCw className="h-4 w-4" /></button>
                            <div className="flex items-center gap-2"><ModernButton variant="secondary" icon={<Filter className="h-4 w-4" />} onClick={() => setShowFilterModal(true)}>Filters</ModernButton><button type="button" onClick={resetFilters} title="Reset filters" aria-label="Reset filters" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 shadow-sm transition-colors hover:bg-gray-100"><RefreshCw className="h-4 w-4" /></button></div>
                            <div className="flex items-center gap-2"><ModernButton variant="secondary" onClick={() => setShowColumnsModal(true)}>Columns</ModernButton><button type="button" onClick={resetColumns} title="Reset columns" aria-label="Reset columns" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 shadow-sm transition-colors hover:bg-gray-100"><RefreshCw className="h-4 w-4" /></button></div>
                        </div>
                    </ModernCard>

                    {selectedIds.length > 0 && <div className="flex items-center gap-2 rounded-lg border bg-blue-50 px-3 py-2" style={{ borderColor: colors.brand.primary }}><span className="mr-2 text-sm font-medium text-gray-900">{selectedIds.length} selected</span>{access.acs_delete > 0 && primaryKey && <ModernButton variant="delete" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => void deleteSelected()}>Delete</ModernButton>}</div>}
                    {columns.length > 0 && <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white"><div className="min-w-[900px]"><ModernTable data={rows} columns={tableColumns} loading={loading} onSort={(column) => { if (column === '_select' || column === '_actions') return; setDirection(sort === column && direction === 'asc' ? 'desc' : 'asc'); setSort(column); }} sortColumn={sort} sortDirection={direction} emptyMessage="No records found." pagination={{ currentPage: pagination.current_page, totalPages: Math.max(1, pagination.last_page), perPage: pagination.per_page ?? perPage, total: pagination.total, onPageChange: setPage, onPerPageChange: setPerPage, rowsOptions: [10, 25, 50, 100] }} /></div></div>}
                </div>
            </div>
        </div>

        <Dialog open={showFilterModal} onOpenChange={setShowFilterModal}>
            <DialogContent className="max-h-[90vh] !w-[90vw] !max-w-6xl overflow-y-auto bg-white">
                <DialogHeader><DialogTitle className="text-2xl font-bold text-gray-900">Filter {selectedTable || 'records'}</DialogTitle><DialogDescription className="text-gray-600">Filter individual columns, then press Apply filters to refresh the table.</DialogDescription></DialogHeader>
                <div className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{columns.map((column) => <label key={column} className="space-y-1 text-sm"><span className="block font-medium capitalize text-gray-700">{column.replaceAll('_', ' ')}</span><Input value={columnFilters[column] ?? ''} onChange={(event) => setColumnFilters((current) => ({ ...current, [column]: event.target.value }))} placeholder={`Filter ${column}`} className="border-gray-300 bg-white text-gray-900 placeholder:text-gray-500" /></label>)}</div>
                <DialogFooter className="gap-2"><ModernButton variant="secondary" onClick={() => setColumnFilters({})}>Clear filters</ModernButton><ModernButton variant="primary" onClick={() => { setShowFilterModal(false); runSearch(); }}>Apply filters</ModernButton></DialogFooter>
            </DialogContent>
        </Dialog>

        <button type="button" aria-label="Back to top" title="Back to top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="fixed bottom-6 right-5 z-[9999] h-11 w-11 items-center justify-center rounded-lg bg-gray-900 text-white shadow-lg transition-opacity hover:bg-gray-700" style={{ display: showBackToTop ? 'flex' : 'none' }}><ArrowUp className="h-5 w-5" /></button>

        <Dialog open={showColumnsModal} onOpenChange={setShowColumnsModal}>
            <DialogContent className="max-h-[90vh] !w-[90vw] !max-w-5xl overflow-y-auto bg-white">
                <DialogHeader><DialogTitle className="text-2xl font-bold text-gray-900">Choose visible columns</DialogTitle><DialogDescription className="text-gray-600">Select the columns to display in the data table.</DialogDescription></DialogHeader>
                <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-4"><ModernButton variant="secondary" size="sm" onClick={() => setVisibleColumns([...columns])}>Select all</ModernButton><ModernButton variant="secondary" size="sm" onClick={() => setVisibleColumns([])}>Clear all</ModernButton></div>
                <div className="grid grid-cols-1 gap-3 py-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{columns.map((column) => { const selected = visibleColumns.includes(column); return <label key={column} className={`flex min-w-0 items-start gap-3 rounded-lg border p-3 text-sm text-gray-800 transition-colors hover:bg-gray-50 ${selected ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'}`}><input className="mt-0.5 h-4 w-4 shrink-0 appearance-none rounded border border-gray-600 bg-gray-100 bg-center bg-no-repeat checked:bg-blue-600" style={{ backgroundImage: selected ? selectionCheckmark('#ffffff') : 'none' }} type="checkbox" checked={selected} onChange={() => setVisibleColumns((current) => current.includes(column) ? current.filter((value) => value !== column) : [...current, column])} /><span className="break-words font-medium">{column}</span></label>; })}</div>
                <DialogFooter><ModernButton variant="primary" onClick={() => setShowColumnsModal(false)}>Done</ModernButton></DialogFooter>
            </DialogContent>
        </Dialog>

        {editing && (creating || primaryKey) && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white shadow-xl"><div className="flex items-center justify-between border-b p-5"><div><h2 className="text-lg font-semibold text-gray-900">{creating ? 'Add record' : 'Edit record'}</h2><p className="text-sm text-gray-600">{selectedTable}{!creating && primaryKey ? ` - ${primaryKey}: ${String(editing[primaryKey])}` : ''}</p></div><button aria-label="Close edit dialog" onClick={() => { setEditing(null); setCreating(false); }}><X className="h-5 w-5 text-gray-500" /></button></div><div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">{columns.map((column) => { const meta = columnDetails[column]; const type = meta?.type ?? ''; const readOnly = (!creating && column === primaryKey) || (creating && Boolean(meta?.extra && (meta.extra.includes('auto_increment') || meta.extra.includes('generated')))) || access.acs_edit <= 0; const isBoolean = /^(tinyint\(1\)|boolean|bool)$/.test(type); const enumOptions = meta?.enum_options ?? []; return <label key={column} className="text-sm"><span className="mb-1 block font-medium text-gray-700">{column}{column === primaryKey && ' (primary key)'}{meta?.extra && <span className="ml-1 text-xs font-normal text-gray-500">({meta.extra})</span>}</span>{enumOptions.length > 0 ? <select disabled={readOnly} value={String(editing[column] ?? '')} onChange={(event) => updateEditingValue(column, event.target.value)} className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 disabled:bg-gray-100"><option value="">{meta?.nullable ? 'NULL' : 'Select value'}</option>{enumOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select> : isBoolean ? <div className="flex h-10 items-center gap-2 rounded-md border border-gray-300 px-3 text-gray-900"><input type="checkbox" disabled={readOnly} checked={Boolean(editing[column]) && String(editing[column]) !== '0'} onChange={(event) => updateEditingValue(column, event.target.checked ? '1' : '0')} className="h-4 w-4" /><span>{Boolean(editing[column]) && String(editing[column]) !== '0' ? 'Enabled' : 'Disabled'}</span></div> : type.includes('text') || type.includes('json') || type.includes('blob') ? <textarea disabled={readOnly} value={inputValue(column, editing[column])} onChange={(event) => updateEditingValue(column, event.target.value)} className="min-h-24 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 disabled:bg-gray-100" /> : <Input disabled={readOnly} type={inputType(column)} value={inputValue(column, editing[column])} onChange={(event) => updateEditingValue(column, event.target.value)} className="border-gray-300 text-gray-900 disabled:bg-gray-100" />}</label>; })}</div><div className="flex justify-end gap-2 border-t p-5"><ModernButton variant="secondary" onClick={() => { setEditing(null); setCreating(false); }}>Cancel</ModernButton><ModernButton variant="primary" onClick={() => void saveRow()} disabled={access.acs_edit <= 0}>{creating ? 'Add record' : 'Save changes'}</ModernButton></div></div></div>}
    </AuthenticatedLayout>;
}
