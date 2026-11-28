<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

class TruckPlateImagesController extends Controller
{
    public function list(Request $request)
    {
        $canView = DB::table('pages_access')
            ->join('pages', 'pages_access.page_id', '=', 'pages.p_id')
            ->where('pages.page', 'truckplateimages')
            ->where('pages_access.privilege', $request->user()->priv_id)
            ->exists();

        abort_unless($canView, 403);

        $images = DB::table('queue_entries')
            ->whereNotNull('plate_path')
            ->where('plate_path', 'like', 'truck_plates/%')
            ->orderByDesc('id')
            ->limit(200)
            ->get(['id', 'plate_no', 'direction', 'plate_path', 'is_manual', 'created_at', 'updated_at'])
            ->filter(fn ($entry) => File::isFile(public_path($entry->plate_path)))
            ->map(fn ($entry) => [
                'id' => $entry->id,
                'plate_no' => $entry->plate_no,
                'direction' => $entry->direction,
                'is_manual' => (bool) $entry->is_manual,
                'captured_at' => $entry->updated_at ?? $entry->created_at,
                'url' => asset($entry->plate_path),
            ])
            ->values();

        return response()->json(['success' => true, 'data' => $images]);
    }
}
