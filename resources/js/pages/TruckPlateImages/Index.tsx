import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import { ArrowLeft, Calendar, Download, Edit, Grid, List, RefreshCw, Search, Trash2, Truck, Upload } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import ImageViewerModal from '@/components/ImageViewerModal';
import { ModernButton, ModernConfirmDialog, ToastContainer, useModernToast } from '@/components/modern';
import { Input } from '@/components/ui/input';

interface PlateImage { name: string; relative_path: string; size: number; modified_at: string; is_image: boolean; }
const apiRoot = '/api/truckplateimages';
const manilaToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
const displayDate = (value: string) => value ? `${value.slice(5, 7)}/${value.slice(8, 10)}/${value.slice(0, 4)}` : '';

function DateFilterField({ label, value, min, max, onChange }: { label: string; value: string; min?: string; max?: string; onChange: (value: string) => void }) {
    return <div><label className="mb-2 block text-sm font-semibold text-gray-900">{label}</label><div className="relative mt-1.5"><Input type="text" inputMode="numeric" maxLength={10} value={displayDate(value)} readOnly className="pr-10" placeholder="mm/dd/yyyy" /><Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" /><input type="date" tabIndex={-1} aria-label={label} value={value} min={min} max={max} onChange={(event) => onChange(event.target.value)} className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 cursor-pointer opacity-0" /></div></div>;
}

export default function Index() {
    const { toasts, removeToast, error, success } = useModernToast();
    const [dateFrom, setDateFrom] = useState(manilaToday);
    const [dateTo, setDateTo] = useState(manilaToday);
    const [images, setImages] = useState<{ in: PlateImage[]; out: PlateImage[] }>({ in: [], out: [] });
    const [canEdit, setCanEdit] = useState(false);
    const [canDelete, setCanDelete] = useState(false);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'detail'>('grid');
    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerIndex, setViewerIndex] = useState(0);
    const [deleteTarget, setDeleteTarget] = useState<PlateImage | null>(null);
    const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const allImages = useMemo(() => [...images.in, ...images.out], [images]);
    const filtered = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return images;
        const match = (image: PlateImage) => image.name.toLowerCase().includes(term);
        return { in: images.in.filter(match), out: images.out.filter(match) };
    }, [images, searchTerm]);
    const viewerImages = useMemo(() => [...filtered.in, ...filtered.out], [filtered]);
    const visiblePaths = useMemo(() => viewerImages.map((image) => image.relative_path), [viewerImages]);
    const allVisibleSelected = visiblePaths.length > 0 && visiblePaths.every((path) => selectedPaths.includes(path));
    const toggleAllVisible = () => setSelectedPaths(allVisibleSelected ? [] : visiblePaths);
    const toggleSelected = (path: string) => setSelectedPaths((current) => current.includes(path) ? current.filter((item) => item !== path) : [...current, path]);

    const loadImages = async (from = dateFrom, to = dateTo) => {
        if (to < from) { error('Date to cannot be earlier than date from.'); return; }
        setLoading(true);
        try {
            const response = await axios.get(`${apiRoot}/list`, { params: { date_from: from, date_to: to } });
            const data = response.data?.data ?? {};
            setImages({ in: data.in ?? [], out: data.out ?? [] });
            setCanEdit(Boolean(data.module_edit));
            setCanDelete(Boolean(data.module_delete));
        } catch (exception: any) { error(exception?.response?.data?.message || 'Unable to load truck plate images.'); }
        finally { setLoading(false); }
    };

    useEffect(() => { void loadImages(); }, []);

    const openViewer = (image: PlateImage) => {
        const index = viewerImages.findIndex((item) => item.relative_path === image.relative_path);
        setViewerIndex(Math.max(0, index)); setViewerOpen(true);
    };
    const uploadImages = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files ?? []); event.target.value = '';
        if (!files.length) return;
        const form = new FormData(); files.forEach((file) => form.append('files[]', file));
        try { await axios.post(`${apiRoot}/upload`, form, { headers: { 'Content-Type': 'multipart/form-data' } }); success('Images uploaded successfully.'); await loadImages(); }
        catch (exception: any) { error(exception?.response?.data?.message || 'Upload failed.'); }
    };
    const renameImage = async (image: PlateImage) => {
        const newName = window.prompt('New image name', image.name); if (!newName || newName === image.name) return;
        try { await axios.post(`${apiRoot}/rename`, { path: image.relative_path, new_name: newName }); success('Image renamed successfully.'); await loadImages(); }
        catch (exception: any) { error(exception?.response?.data?.message || 'Rename failed.'); }
    };
    const deleteImage = async () => {
        if (!deleteTarget) return;
        try { await axios.post(`${apiRoot}/delete-item`, { path: deleteTarget.relative_path, type: 'file' }); success('Image deleted successfully.'); setDeleteTarget(null); await loadImages(); }
        catch (exception: any) { error(exception?.response?.data?.message || 'Delete failed.'); }
    };
    const imageUrl = (image: PlateImage) => `${apiRoot}/file?path=${encodeURIComponent(image.relative_path)}`;
    const downloadUrl = (image: PlateImage) => `${apiRoot}/download?path=${encodeURIComponent(image.relative_path)}`;

    const actions = (image: PlateImage) => <div className="flex shrink-0 items-center gap-1">
        <a href={downloadUrl(image)} className="rounded p-1 text-gray-500 hover:bg-gray-100" title="Download"><Download className="h-4 w-4" /></a>
        {canEdit && <button type="button" onClick={() => void renameImage(image)} className="rounded p-1 text-gray-500 hover:bg-gray-100" title="Rename"><Edit className="h-4 w-4" /></button>}
        {canDelete && <button type="button" onClick={() => setDeleteTarget(image)} className="rounded p-1 text-red-500 hover:bg-red-50" title="Delete"><Trash2 className="h-4 w-4" /></button>}
    </div>;

    const column = (title: string, direction: 'in' | 'out', values: PlateImage[]) => <section className="min-w-0 rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
        <div className="flex items-center justify-between rounded-t-xl bg-[#3E9AF4] px-5 py-3 text-white"><h2 className="text-lg font-bold">{title}</h2><span className="rounded-full bg-white/20 px-3 py-1 text-sm font-semibold">{values.length}</span></div>
        <div className="p-4">{values.length === 0 ? <div className="py-16 text-center text-sm text-gray-500">No {direction.toUpperCase()} images found.</div> : viewMode === 'grid' ? <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">{values.map((image) => <div key={image.relative_path} className="group relative min-w-0"><input type="checkbox" checked={selectedPaths.includes(image.relative_path)} onChange={() => toggleSelected(image.relative_path)} onClick={(event) => event.stopPropagation()} aria-label={`Select ${image.name}`} className="absolute left-2 top-2 z-10 h-4 w-4" /><button type="button" onClick={() => openViewer(image)} className="block w-full overflow-hidden rounded-lg bg-gray-100 ring-1 ring-gray-200"><img src={imageUrl(image)} alt={image.name} className="h-40 w-full object-cover transition group-hover:scale-105" /></button><div className="mt-2 flex items-start justify-between gap-1"><span className="min-w-0 truncate text-xs text-gray-700" title={image.name}>{image.name}</span>{actions(image)}</div></div>)}</div> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-xs uppercase text-gray-500"><th className="px-2 py-3">Select</th><th className="px-2 py-3">Image</th><th className="px-2 py-3">Name</th><th className="px-2 py-3">Modified</th><th className="px-2 py-3">Actions</th></tr></thead><tbody>{values.map((image) => <tr key={image.relative_path} className="border-b last:border-0"><td className="px-2 py-2"><input type="checkbox" checked={selectedPaths.includes(image.relative_path)} onChange={() => toggleSelected(image.relative_path)} /></td><td className="px-2 py-2"><button type="button" onClick={() => openViewer(image)}><img src={imageUrl(image)} alt={image.name} className="h-14 w-20 rounded object-cover" /></button></td><td className="max-w-xs truncate px-2 py-2 text-gray-700">{image.name}</td><td className="whitespace-nowrap px-2 py-2 text-gray-500">{image.modified_at}</td><td className="px-2 py-2">{actions(image)}</td></tr>)}</tbody></table></div>}</div>
    </section>;

    return <AuthenticatedLayout><Head title="Truck Plate Images" /><div className="p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><div className="rounded-xl bg-[#3E9AF4] p-3 text-white"><Truck className="h-7 w-7" /></div><div><h1 className="text-3xl font-bold text-gray-900">Truck Plate Images</h1><p className="mt-1 text-sm text-gray-600">Explore and manage truck plate images in the server</p></div></div></div>
        <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-200"><div className="flex flex-wrap items-center justify-between gap-3 bg-[#3E9AF4] px-6 py-4 text-white"><div><h2 className="text-xl font-bold">Explorer</h2><p className="text-sm text-white/90">Filter, upload, preview, and manage truck plate images</p></div><div className="flex items-center gap-2"><input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={uploadImages} />{canEdit && <ModernButton variant="success" size="sm" icon={<Upload className="h-4 w-4" />} onClick={() => fileInputRef.current?.click()}>Upload Images</ModernButton>}<ModernButton variant="secondary" size="sm" icon={<RefreshCw className="h-4 w-4" />} onClick={() => void loadImages()}>Refresh</ModernButton></div></div>
            <div className="space-y-4 p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div className="flex flex-wrap items-center gap-2"><button type="button" className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-gray-600" disabled><ArrowLeft className="h-4 w-4" /> Back</button><span className="text-sm font-medium text-[#3E9AF4]">Root / truck_plates</span></div><div className="flex flex-wrap items-end gap-3"><DateFilterField label="Date From" value={dateFrom} max={dateTo} onChange={(value) => { setDateFrom(value); if (value <= dateTo) void loadImages(value, dateTo); }} /><DateFilterField label="Date To" value={dateTo} min={dateFrom} onChange={(value) => { setDateTo(value); if (value >= dateFrom) void loadImages(dateFrom, value); }} /><div className="pb-0.5"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search images" className="w-56 pl-9" /></div></div><span className="pb-2 text-sm text-gray-500">{filtered.in.length + filtered.out.length} items</span>{visiblePaths.length > 0 && <ModernButton variant="secondary" size="sm" onClick={toggleAllVisible}>{allVisibleSelected ? 'Clear All' : 'Select All'}</ModernButton>}<ModernButton variant={viewMode === 'detail' ? 'primary' : 'secondary'} size="sm" icon={<List className="h-4 w-4" />} onClick={() => setViewMode('detail')} title="Detail view" /><ModernButton variant={viewMode === 'grid' ? 'primary' : 'secondary'} size="sm" icon={<Grid className="h-4 w-4" />} onClick={() => setViewMode('grid')} title="Grid view" /></div></div><div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">{column('IN', 'in', filtered.in)}{column('OUT', 'out', filtered.out)}</div></div>
        </div>
    </div><ImageViewerModal open={viewerOpen} onOpenChange={setViewerOpen} images={viewerImages.map((image) => ({ src: imageUrl(image), name: image.name, key: image.relative_path }))} currentIndex={viewerIndex} onIndexChange={setViewerIndex} /><ModernConfirmDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)} onConfirm={deleteImage} title="Delete Image" description={`Delete "${deleteTarget?.name || ''}"? This action cannot be undone.`} confirmText="Delete" cancelText="Cancel" type="danger" /><ToastContainer toasts={toasts} removeToast={removeToast} /></AuthenticatedLayout>;
}
