import ImageExplorer from '@/components/ImageExplorer';

// Separate page entry point; it deliberately renders the same explorer UI with the truck-plate API root.
export default function Index() {
    return <ImageExplorer imageModule="truck" />;
}
