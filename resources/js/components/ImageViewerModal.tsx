import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Minus, Plus, RotateCcw } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

export interface ImageViewerItem {
    src: string;
    name: string;
    key?: string;
}

interface ImageViewerModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    images: ImageViewerItem[];
    currentIndex: number;
    onIndexChange: (index: number) => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

export default function ImageViewerModal({
    open,
    onOpenChange,
    images,
    currentIndex,
    onIndexChange,
}: ImageViewerModalProps) {
    const [zoom, setZoom] = useState(MIN_ZOOM);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const thumbnailContainerRef = useRef<HTMLDivElement | null>(null);
    const currentImage = images[currentIndex] ?? null;
    const viewerFrameWidth = 'min(92vw, calc((94vh - 220px) * 4 / 3))';

    const resetZoom = () => {
        setZoom(MIN_ZOOM);
        setPan({ x: 0, y: 0 });
    };

    const changeZoom = (nextZoom: number) => {
        const boundedZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
        setZoom(boundedZoom);
        if (boundedZoom === MIN_ZOOM) setPan({ x: 0, y: 0 });
    };

    const moveImage = (deltaX: number, deltaY: number) => {
        if (zoom <= MIN_ZOOM) return;
        setPan((current) => ({ x: current.x + deltaX, y: current.y + deltaY }));
    };

    useEffect(() => {
        resetZoom();
        setIsLoading(Boolean(currentImage));
    }, [currentIndex, open]);

    useEffect(() => {
        if (!thumbnailContainerRef.current || !currentImage) return;
        const element = thumbnailContainerRef.current.querySelector(`[data-index="${currentIndex}"]`) as HTMLElement | null;
        element?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, [currentIndex, currentImage]);

    useEffect(() => {
        if (!open || images.length === 0) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                onIndexChange((currentIndex - 1 + images.length) % images.length);
            } else if (event.key === 'ArrowRight') {
                event.preventDefault();
                onIndexChange((currentIndex + 1) % images.length);
            } else if (event.key === '+' || event.key === '=') {
                event.preventDefault();
                changeZoom(zoom + ZOOM_STEP);
            } else if (event.key === '-') {
                event.preventDefault();
                changeZoom(zoom - ZOOM_STEP);
            } else if (event.key === '0') {
                event.preventDefault();
                resetZoom();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, images.length, currentIndex, onIndexChange, zoom]);

    const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
        event.preventDefault();
        changeZoom(zoom + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP));
    };

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        if (zoom <= MIN_ZOOM) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        dragStart.current = { x: event.clientX - pan.x, y: event.clientY - pan.y };
        setDragging(true);
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!dragging) return;
        setPan({ x: event.clientX - dragStart.current.x, y: event.clientY - dragStart.current.y });
    };

    const stopDragging = (event: React.PointerEvent<HTMLDivElement>) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        setDragging(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="!w-fit !max-w-[96vw] max-h-[94vh] p-4 sm:p-5 flex items-center justify-center overflow-hidden">
                <div className="flex w-fit max-h-[90vh] flex-col items-center gap-3 overflow-hidden">
                    {currentImage && <div className="pt-2 text-center font-medium">{currentImage.name}</div>}

                    <div className="flex items-center justify-center">
                        <div
                            className={`relative aspect-[4/3] overflow-hidden rounded-md bg-black/5 ${zoom > 1 ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'}`}
                            style={{ width: viewerFrameWidth, touchAction: 'none' }}
                            onWheel={handleWheel}
                            onPointerDown={handlePointerDown}
                            onPointerMove={handlePointerMove}
                            onPointerUp={stopDragging}
                            onPointerCancel={stopDragging}
                        >
                            {currentImage && (
                                <div className="flex h-full w-full items-center justify-center">
                                    <img
                                        src={currentImage.src}
                                        alt={currentImage.name}
                                        onLoad={() => setIsLoading(false)}
                                        className={`max-h-full max-w-full select-none object-contain ${isLoading ? 'opacity-0' : 'opacity-100'}`}
                                        style={{
                                            display: 'block',
                                            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                                            transition: dragging ? 'none' : 'transform 120ms ease-out',
                                        }}
                                        draggable={false}
                                    />
                                </div>
                            )}

                            {images.length > 1 && (
                                <>
                                    <button type="button" onClick={() => onIndexChange((currentIndex - 1 + images.length) % images.length)} className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 shadow hover:bg-white" aria-label="Previous image">
                                        <ChevronLeft className="h-5 w-5 text-black" />
                                    </button>
                                    <button type="button" onClick={() => onIndexChange((currentIndex + 1) % images.length)} className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 shadow hover:bg-white" aria-label="Next image">
                                        <ChevronRight className="h-5 w-5 text-black" />
                                    </button>
                                </>
                            )}

                            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/65 p-1 text-white shadow-lg">
                                <button type="button" onClick={() => changeZoom(zoom - ZOOM_STEP)} disabled={zoom <= MIN_ZOOM} className="rounded-full p-2 hover:bg-white/20 disabled:opacity-40" aria-label="Zoom out"><Minus className="h-4 w-4" /></button>
                                <span className="min-w-12 text-center text-xs font-medium">{Math.round(zoom * 100)}%</span>
                                <button type="button" onClick={() => changeZoom(zoom + ZOOM_STEP)} disabled={zoom >= MAX_ZOOM} className="rounded-full p-2 hover:bg-white/20 disabled:opacity-40" aria-label="Zoom in"><Plus className="h-4 w-4" /></button>
                                <button type="button" onClick={resetZoom} disabled={zoom === MIN_ZOOM && pan.x === 0 && pan.y === 0} className="rounded-full p-2 hover:bg-white/20 disabled:opacity-40" aria-label="Reset zoom"><RotateCcw className="h-4 w-4" /></button>
                            </div>
                        </div>
                    </div>

                    <div style={{ width: viewerFrameWidth }}>
                        <div ref={thumbnailContainerRef} className="flex items-center justify-start gap-2 overflow-x-auto px-1 py-1 sm:px-2">
                            {images.map((image, index) => (
                                <button key={image.key || `${image.src}-${index}`} type="button" data-index={index} onClick={() => onIndexChange(index)} className={`flex-none rounded p-1 ${index === currentIndex ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}`}>
                                    <img src={image.src} alt={image.name} className="aspect-[4/3] w-24 rounded object-cover sm:w-28" />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
