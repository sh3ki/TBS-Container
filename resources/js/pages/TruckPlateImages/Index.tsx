import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import { RefreshCw, Truck } from 'lucide-react';
import { useEffect, useState } from 'react';

interface TruckPlateImage {
    id: number;
    plate_no: string;
    direction: string;
    is_manual: boolean;
    captured_at: string;
    url: string;
}

export default function Index() {
    const [images, setImages] = useState<TruckPlateImage[]>([]);
    const [loading, setLoading] = useState(true);

    const loadImages = async () => {
        setLoading(true);
        try {
            const response = await axios.get('/api/truck-plate-images');
            setImages(response.data?.data ?? []);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadImages();
    }, []);

    return (
        <AuthenticatedLayout>
            <Head title="Truck Plate Images" />
            <div className="p-6">
                <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Truck className="h-7 w-7 text-blue-600" />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Truck Plate Images</h1>
                            <p className="text-sm text-gray-500">Images captured during truck plate scans.</p>
                        </div>
                    </div>
                    <button type="button" onClick={() => void loadImages()} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                        <RefreshCw className="h-4 w-4" /> Refresh
                    </button>
                </div>

                {loading ? (
                    <div className="rounded-xl bg-white p-10 text-center text-gray-500">Loading images...</div>
                ) : images.length === 0 ? (
                    <div className="rounded-xl bg-white p-10 text-center text-gray-500">No truck plate images found.</div>
                ) : (
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                        {images.map((image) => (
                            <div key={image.id} className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
                                <a href={image.url} target="_blank" rel="noreferrer">
                                    <img src={image.url} alt={`Truck plate ${image.plate_no}`} className="h-48 w-full object-cover" />
                                </a>
                                <div className="p-3">
                                    <div className="flex items-center justify-between font-semibold text-gray-900">
                                        <span>{image.plate_no}</span>
                                        <span className="text-xs text-gray-500">{image.direction}</span>
                                    </div>
                                    <p className="mt-1 text-xs text-gray-500">
                                        {image.is_manual ? 'Manual capture' : 'Automatic capture'}
                                        {image.captured_at ? ` · ${new Date(image.captured_at).toLocaleString()}` : ''}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
