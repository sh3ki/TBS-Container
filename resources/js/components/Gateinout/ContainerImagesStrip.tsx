import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Label } from '@/components/ui/label';

interface ContainerImage { src: string; name: string; }

interface ContainerImagesStripProps {
    open: boolean;
    containerNo?: string;
    dateAdded?: string | null;
    gateStatus: 'IN' | 'OUT';
}

const formatImageDate = (value: string): string => {
    const date = new Date(value.replace(' ', 'T'));
    if (Number.isNaN(date.getTime())) return '';
    return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${date.getFullYear()}`;
};

export default function ContainerImagesStrip({ open, containerNo, dateAdded, gateStatus }: ContainerImagesStripProps) {
    const [images, setImages] = useState<ContainerImage[]>([]);

    const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
        if (!event.shiftKey) return;
        event.preventDefault();
        event.currentTarget.scrollLeft += event.deltaY || event.deltaX;
    };

    useEffect(() => {
        let cancelled = false;
        setImages([]);
        const date = dateAdded ? formatImageDate(dateAdded) : '';
        if (!open || !containerNo || !date) return;

        void axios.get('/api/inventory/images', {
            params: { date, gate_status: gateStatus, container_no: containerNo },
        }).then((response) => {
            if (cancelled || !response.data?.success || !Array.isArray(response.data.data)) return;
            const normalized = response.data.data.map((image: Record<string, unknown>) => ({
                src: typeof image.url === 'string' && image.url
                    ? image.url
                    : `/api/inventory/images/file?path=${encodeURIComponent(String(image.relative_path || ''))}`,
                name: String(image.name || 'Container image'),
            })).filter((image: ContainerImage) => image.src && !image.src.endsWith('path='));
            setImages(normalized);
        }).catch(() => { if (!cancelled) setImages([]); });

        return () => { cancelled = true; };
    }, [open, containerNo, dateAdded, gateStatus]);

    if (images.length === 0) return null;

    return (
        <div className="mt-4 w-full min-w-0 max-w-full space-y-1 overflow-hidden">
            <Label className="text-xs uppercase text-gray-600">Images ({images.length})</Label>
            <div className="flex w-full min-w-0 max-w-full gap-2 overflow-x-auto py-2" onWheel={handleWheel}>
                {images.map((image, index) => (
                    <div key={`${image.src}-${index}`} className="relative h-20 w-28 shrink-0">
                        <img src={image.src} alt={image.name} className="h-full w-full rounded border object-cover" />
                        <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-xs font-semibold leading-none text-white">
                            {index + 1}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
