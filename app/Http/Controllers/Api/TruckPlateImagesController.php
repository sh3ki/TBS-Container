<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

class TruckPlateImagesController extends Controller
{
    private function base(): string { return public_path('truck_plates'); }

    private function access(): array
    {
        $user = Auth::user();
        $page = DB::table('pages')->where('page', 'truckplateimages')->first('p_id');
        $row = $page ? DB::table('pages_access')->where(['page_id' => $page->p_id, 'privilege' => $user?->priv_id])->first(['acs_edit', 'acs_delete']) : null;
        $edit = (int) ($row->acs_edit ?? 0) > 0;
        $delete = (int) ($row->acs_delete ?? 0) > 0;
        if ((int) ($user?->priv_id ?? 0) === 1) $edit = $delete = true;
        return ['can_view' => $edit || $delete, 'module_edit' => $edit, 'module_delete' => $delete];
    }

    public function getPageRecordAccess() { return response()->json(['success' => true] + $this->access()); }

    public function list(Request $request)
    {
        $access = $this->access(); abort_unless($access['can_view'], 403);
        $dateFrom = (string) $request->query('date_from', Carbon::now('Asia/Manila')->format('Y-m-d'));
        $dateTo = (string) $request->query('date_to', $dateFrom);
        abort_unless((bool) preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateFrom) && (bool) preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateTo), 422, 'Invalid date range.');
        abort_if($dateTo < $dateFrom, 422, 'Date to cannot be earlier than date from.');
        $prefixFrom = Carbon::createFromFormat('Y-m-d', $dateFrom, 'Asia/Manila')->format('Ymd');
        $prefixTo = Carbon::createFromFormat('Y-m-d', $dateTo, 'Asia/Manila')->format('Ymd');
        $images = ['in' => [], 'out' => []];
        if (File::isDirectory($this->base())) {
            foreach (File::files($this->base()) as $file) {
                if (!preg_match('/^(\d{8})_\d{6}_(in|out)_/i', $file->getFilename(), $match)) continue;
                if ($match[1] < $prefixFrom || $match[1] > $prefixTo) continue;
                $direction = strtolower($match[2]);
                $images[$direction][] = [
                    'name' => $file->getFilename(),
                    'relative_path' => $file->getFilename(),
                    'type' => 'file',
                    'size' => $file->getSize(),
                    'modified_at' => date('Y-m-d H:i:s', $file->getMTime()),
                    'is_image' => $this->isImage($file->getFilename()),
                ];
            }
        }
        foreach ($images as &$directionImages) usort($directionImages, fn ($a, $b) => strnatcasecmp($b['name'], $a['name']));
        return response()->json(['success' => true, 'data' => ['date_from' => $dateFrom, 'date_to' => $dateTo, 'in' => $images['in'], 'out' => $images['out'], ...$access]]);
    }

    public function viewFile(Request $request) { abort_unless($this->access()['can_view'], 403); $file = $this->path($this->clean($request->query('path', ''))); abort_unless(File::isFile($file), 404); return response()->file($file); }

    public function upload(Request $request)
    {
        abort_unless($this->access()['module_edit'], 403);
        $data = $request->validate(['path' => ['nullable', 'string'], 'files' => ['required', 'array', 'min:1'], 'files.*' => ['required', 'file', 'mimes:jpg,jpeg,png,gif,webp,bmp', 'max:10240']]);
        $dir = $this->path($this->clean($data['path'] ?? '')); abort_unless(File::isDirectory($dir), 404);
        foreach ($request->file('files', []) as $file) $file->move($dir, $this->available($dir, $this->safe(pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME)), strtolower($file->getClientOriginalExtension())));
        return response()->json(['success' => true, 'message' => 'Upload successful.']);
    }

    public function createFolder(Request $request)
    {
        abort_unless($this->access()['module_edit'], 403); $data = $request->validate(['path' => ['nullable', 'string'], 'folder_name' => ['required', 'string', 'max:120']]);
        $dir = $this->path($this->clean($data['path'] ?? '')); $name = $this->safe($data['folder_name']); abort_unless(File::isDirectory($dir) && $name !== '', 422); File::makeDirectory($dir . DIRECTORY_SEPARATOR . $name, 0755, true); return response()->json(['success' => true]);
    }

    public function deleteItem(Request $request)
    {
        abort_unless($this->access()['module_delete'], 403); $data = $request->validate(['path' => ['required', 'string'], 'type' => ['required', 'in:file,directory']]); $path = $this->clean($data['path']); abort_if($path === '', 422); $full = $this->path($path); abort_unless(File::exists($full), 404); $data['type'] === 'directory' ? File::deleteDirectory($full) : File::delete($full); return response()->json(['success' => true, 'message' => 'Item deleted successfully.']);
    }

    public function deleteBulk(Request $request)
    {
        abort_unless($this->access()['module_delete'], 403); $data = $request->validate(['paths' => ['required', 'array', 'min:1'], 'paths.*' => ['required', 'string']]); $count = 0; foreach (array_unique($data['paths']) as $value) { $full = $this->path($this->clean($value)); if (File::isFile($full)) { File::delete($full); $count++; } elseif (File::isDirectory($full)) { File::deleteDirectory($full); $count++; } } return response()->json(['success' => true, 'message' => "Deleted {$count} item(s) successfully."]); 
    }

    public function rename(Request $request)
    {
        abort_unless($this->access()['module_edit'], 403); $data = $request->validate(['path' => ['required', 'string'], 'new_name' => ['required', 'string', 'max:255']]); $old = $this->clean($data['path']); $full = $this->path($old); abort_unless($old !== '' && File::exists($full), 404); $name = File::isFile($full) ? $this->safe(pathinfo($data['new_name'], PATHINFO_FILENAME)) . (pathinfo($full, PATHINFO_EXTENSION) ? '.' . pathinfo($full, PATHINFO_EXTENSION) : '') : $this->safe($data['new_name']); abort_unless($name !== '', 422); abort_if(File::exists(dirname($full) . DIRECTORY_SEPARATOR . $name), 409); File::move($full, dirname($full) . DIRECTORY_SEPARATOR . $name); return response()->json(['success' => true]);
    }

    public function download(Request $request)
    {
        abort_unless($this->access()['can_view'], 403); $path = $this->clean($request->query('path', '')); $full = $this->path($path); abort_unless(File::exists($full), 404);
        if (File::isFile($full)) return response()->download($full, basename($full));
        return $this->zipDownload($full, basename($path) . '.zip');
    }

    public function downloadBulk(Request $request)
    {
        abort_unless($this->access()['can_view'], 403); $data = $request->validate(['paths' => ['required', 'array', 'min:1'], 'paths.*' => ['required', 'string']]);
        $zipPath = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'truck_plate_images_' . md5(implode('|', $data['paths']) . microtime(true)) . '.zip'; abort_unless(class_exists('ZipArchive'), 500);
        $zip = new \ZipArchive(); abort_unless($zip->open($zipPath, \ZipArchive::CREATE) === true, 500); $added = 0;
        foreach (array_unique($data['paths']) as $value) { $full = $this->path($this->clean($value)); if (File::isFile($full)) { $zip->addFile($full, basename($full)); $added++; } elseif (File::isDirectory($full)) { foreach (File::allFiles($full) as $file) { $zip->addFile($file->getRealPath(), ltrim(substr($file->getRealPath(), strlen($this->base())), DIRECTORY_SEPARATOR)); $added++; } } }
        $zip->close(); if ($added === 0) { @unlink($zipPath); return response()->json(['success' => false, 'message' => 'No selected files were found.'], 404); } return response()->download($zipPath, 'truck-plate-images.zip')->deleteFileAfterSend(true);
    }

    private function zipDownload(string $directory, string $filename)
    {
        abort_unless(class_exists('ZipArchive'), 500); $zipPath = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'truck_plate_images_' . md5($directory . microtime(true)) . '.zip'; $zip = new \ZipArchive(); abort_unless($zip->open($zipPath, \ZipArchive::CREATE) === true, 500); foreach (File::allFiles($directory) as $file) $zip->addFile($file->getRealPath(), ltrim(substr($file->getRealPath(), strlen($directory)), DIRECTORY_SEPARATOR)); $zip->close(); return response()->download($zipPath, $filename)->deleteFileAfterSend(true);
    }

    private function clean(string $value): string { return implode('/', array_filter(explode('/', trim(str_replace('\\', '/', $value), '/')), fn ($part) => $part !== '.' && $part !== '..')); }
    private function path(string $relative): string { return rtrim($this->base(), DIRECTORY_SEPARATOR) . ($relative === '' ? '' : DIRECTORY_SEPARATOR . $relative); }
    private function safe(string $value): string { return trim(preg_replace('/[^A-Za-z0-9 _.-]/', '', str_replace(['/', '\\'], '', $value)) ?? '', '. '); }
    private function available(string $dir, string $base, string $ext): string { $name = $base . '.' . $ext; $i = 1; while (File::exists($dir . DIRECTORY_SEPARATOR . $name)) $name = $base . ' (' . $i++ . ').' . $ext; return $name; }
    private function isImage(string $name): bool { return in_array(strtolower(pathinfo($name, PATHINFO_EXTENSION)), ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'], true); }
}
