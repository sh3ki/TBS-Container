<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

class ContainerImagesController extends Controller
{
    private string $prefix;

    // Use the public/container_pics path so files are web-accessible like other modules
    private const BASE_DIRECTORY = '/var/www/tbscontainermnl/public/container_pics';

    public function __construct()
    {
        $this->prefix = env('DB_PREFIX', 'fjp_');
    }

    public function list(Request $request)
    {
        $access = $this->getPageRecordAccessData();
        if (!$access['can_view']) {
            return response()->json([
                'success' => false,
                'message' => 'You do not have access to this page.'
            ], 403);
        }

        $relativePath = $this->normalizeRelativePath($request->query('path', ''));
        $fullPath = $this->toFullPath($relativePath);

        // If folder does not exist, return empty list (avoid 404 in UI). This is safer
        // for environments where the server folder is not present yet.
        if (!File::exists($fullPath) || !File::isDirectory($fullPath)) {
            return response()->json([
                'success' => true,
                'data' => [
                    'current_path' => $relativePath,
                    'items' => [],
                    'module_edit' => $access['module_edit'],
                    'module_delete' => $access['module_delete'],
                    'can_view' => $access['can_view'],
                ],
                'message' => 'Folder not found',
            ]);
        }

        $directories = collect(File::directories($fullPath))
            ->map(function ($directory) use ($relativePath) {
                $name = basename($directory);
                $itemRelativePath = ltrim($relativePath . '/' . $name, '/');

                return [
                    'name' => $name,
                    'relative_path' => $itemRelativePath,
                    'type' => 'directory',
                    'size' => null,
                    'modified_at' => date('Y-m-d H:i:s', filemtime($directory)),
                    'is_image' => false,
                ];
            })
            ->sortBy('name', SORT_NATURAL | SORT_FLAG_CASE)
            ->values();

        $files = collect(File::files($fullPath))
            ->map(function ($file) use ($relativePath) {
                $name = $file->getFilename();
                $itemRelativePath = ltrim($relativePath . '/' . $name, '/');

                return [
                    'name' => $name,
                    'relative_path' => $itemRelativePath,
                    'type' => 'file',
                    'size' => $file->getSize(),
                    'modified_at' => date('Y-m-d H:i:s', $file->getMTime()),
                    'is_image' => $this->isImageFile($name),
                ];
            })
            ->sortBy('name', SORT_NATURAL | SORT_FLAG_CASE)
            ->values();

        $items = $directories->merge($files)->values();

        return response()->json([
            'success' => true,
            'data' => [
                'current_path' => $relativePath,
                'items' => $items,
                'module_edit' => $access['module_edit'],
                'module_delete' => $access['module_delete'],
                'can_view' => $access['can_view'],
            ],
        ]);
    }

    public function upload(Request $request)
    {
        $access = $this->getPageRecordAccessData();
        if (!$access['module_edit']) {
            return response()->json([
                'success' => false,
                'message' => 'You do not have upload permission.'
            ], 403);
        }

        $validated = $request->validate([
            'path' => ['nullable', 'string'],
            'files' => ['required', 'array', 'min:1'],
            'files.*' => ['required', 'file', 'mimes:jpg,jpeg,png,gif,webp,bmp', 'max:10240'],
        ]);

        $relativePath = $this->normalizeRelativePath($validated['path'] ?? '');
        $targetDir = $this->toFullPath($relativePath);

        if (!File::exists($targetDir)) {
            return response()->json([
                'success' => false,
                'message' => 'Target folder does not exist.'
            ], 404);
        }

        if (!File::isDirectory($targetDir)) {
            return response()->json([
                'success' => false,
                'message' => 'Target path is not a folder.'
            ], 400);
        }

        $uploaded = [];

        foreach ($request->file('files', []) as $file) {
            $originalName = $file->getClientOriginalName();
            $name = $this->sanitizeFileName(pathinfo($originalName, PATHINFO_FILENAME));
            $extension = strtolower($file->getClientOriginalExtension());
            $finalName = $this->resolveAvailableFileName($targetDir, $name, $extension);

            $file->move($targetDir, $finalName);
            $uploaded[] = $finalName;
        }

        $this->logAudit('ADD', '[CONTAINER IMAGES] Uploaded ' . count($uploaded) . ' file(s) in "' . ($relativePath ?: '/') . '"');

        return response()->json([
            'success' => true,
            'message' => 'Upload successful.',
            'uploaded' => $uploaded,
        ]);
    }

    public function createFolder(Request $request)
    {
        $access = $this->getPageRecordAccessData();
        if (!$access['module_edit']) {
            return response()->json([
                'success' => false,
                'message' => 'You do not have permission to create folders.'
            ], 403);
        }

        $validated = $request->validate([
            'path' => ['nullable', 'string'],
            'folder_name' => ['required', 'string', 'max:120'],
        ]);

        $relativePath = $this->normalizeRelativePath($validated['path'] ?? '');
        $parentPath = $this->toFullPath($relativePath);

        if (!File::exists($parentPath) || !File::isDirectory($parentPath)) {
            return response()->json([
                'success' => false,
                'message' => 'Parent folder does not exist.'
            ], 404);
        }

        $folderName = $this->sanitizeFolderName($validated['folder_name']);
        if ($folderName === '') {
            return response()->json([
                'success' => false,
                'message' => 'Folder name is invalid.'
            ], 422);
        }

        $newFolderPath = $parentPath . DIRECTORY_SEPARATOR . $folderName;

        if (File::exists($newFolderPath)) {
            return response()->json([
                'success' => false,
                'message' => 'Folder already exists.'
            ], 409);
        }

        File::makeDirectory($newFolderPath, 0755, true);

        $this->logAudit('ADD', '[CONTAINER IMAGES] Created folder "' . ltrim($relativePath . '/' . $folderName, '/') . '"');

        return response()->json([
            'success' => true,
            'message' => 'Folder created successfully.',
        ]);
    }

    public function deleteItem(Request $request)
    {
        $access = $this->getPageRecordAccessData();
        if (!$access['module_delete']) {
            return response()->json([
                'success' => false,
                'message' => 'You do not have delete permission.'
            ], 403);
        }

        $validated = $request->validate([
            'path' => ['required', 'string'],
            'type' => ['required', 'in:file,directory'],
        ]);

        $relativePath = $this->normalizeRelativePath($validated['path']);

        if ($relativePath === '') {
            return response()->json([
                'success' => false,
                'message' => 'Deleting the root folder is not allowed.'
            ], 422);
        }

        $fullPath = $this->toFullPath($relativePath);

        if (!File::exists($fullPath)) {
            return response()->json([
                'success' => false,
                'message' => 'Item not found.'
            ], 404);
        }

        if ($validated['type'] === 'file') {
            if (!File::isFile($fullPath)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Requested item is not a file.'
                ], 400);
            }

            File::delete($fullPath);
            $this->logAudit('DELETE', '[CONTAINER IMAGES] Deleted file "' . $relativePath . '"');
        } else {
            if (!File::isDirectory($fullPath)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Requested item is not a folder.'
                ], 400);
            }

            File::deleteDirectory($fullPath);
            $this->logAudit('DELETE', '[CONTAINER IMAGES] Deleted folder "' . $relativePath . '"');
        }

        return response()->json([
            'success' => true,
            'message' => 'Item deleted successfully.',
        ]);
    }

    public function viewFile(Request $request)
    {
        $access = $this->getPageRecordAccessData();
        if (!$access['can_view']) {
            return response()->json([
                'success' => false,
                'message' => 'You do not have access to this page.'
            ], 403);
        }

        $relativePath = $this->normalizeRelativePath($request->query('path', ''));
        if ($relativePath === '') {
            return response()->json([
                'success' => false,
                'message' => 'File path is required.'
            ], 422);
        }

        $fullPath = $this->toFullPath($relativePath);

        if (!File::exists($fullPath) || !File::isFile($fullPath)) {
            return response()->json([
                'success' => false,
                'message' => 'File not found.'
            ], 404);
        }

        return response()->file($fullPath);
    }

    public function getPageRecordAccess()
    {
        $access = $this->getPageRecordAccessData();

        return response()->json([
            'success' => true,
            'can_view' => $access['can_view'],
            'module_edit' => $access['module_edit'],
            'module_delete' => $access['module_delete'],
        ]);
    }

    private function getPageRecordAccessData(): array
    {
        $user = Auth::user();
        $privId = $user->priv_id ?? 0;

        if ((int)$privId === 1) {
            return [
                'can_view' => true,
                'module_edit' => true,
                'module_delete' => true,
            ];
        }

        $page = DB::selectOne(
            "SELECT p_id FROM {$this->prefix}pages WHERE page = 'containerimages' LIMIT 1"
        );

        if (!$page) {
            return [
                'can_view' => false,
                'module_edit' => false,
                'module_delete' => false,
            ];
        }

        $access = DB::selectOne(
            "SELECT acs_edit, acs_delete
             FROM {$this->prefix}pages_access
             WHERE privilege = :privilege AND page_id = :page_id
             LIMIT 1",
            [
                'privilege' => $privId,
                'page_id' => $page->p_id,
            ]
        );

        if (!$access) {
            return [
                'can_view' => false,
                'module_edit' => false,
                'module_delete' => false,
            ];
        }

        $moduleEdit = (bool)($access->acs_edit ?? 0);
        $moduleDelete = (bool)($access->acs_delete ?? 0);

        return [
            'can_view' => $moduleEdit || $moduleDelete,
            'module_edit' => $moduleEdit,
            'module_delete' => $moduleDelete,
        ];
    }

    private function normalizeRelativePath(string $path): string
    {
        $path = trim(str_replace('\\', '/', $path));
        $path = trim($path, '/');

        if ($path === '') {
            return '';
        }

        $segments = [];
        foreach (explode('/', $path) as $segment) {
            if ($segment === '' || $segment === '.') {
                continue;
            }

            if ($segment === '..') {
                continue;
            }

            $segments[] = $segment;
        }

        return implode('/', $segments);
    }

    private function toFullPath(string $relativePath): string
    {
        $base = rtrim(self::BASE_DIRECTORY, '/');

        if ($relativePath === '') {
            return $base;
        }

        return $base . '/' . $relativePath;
    }

    private function sanitizeFolderName(string $name): string
    {
        $clean = trim($name);
        $clean = str_replace(['/', '\\'], '', $clean);
        $clean = preg_replace('/[^A-Za-z0-9 _.-]/', '', $clean) ?? '';

        return trim($clean);
    }

    private function sanitizeFileName(string $name): string
    {
        $clean = trim($name);
        $clean = preg_replace('/[^A-Za-z0-9 _.-]/', '', $clean) ?? '';
        $clean = trim($clean, '. ');

        return $clean !== '' ? $clean : 'upload';
    }

    private function resolveAvailableFileName(string $directory, string $baseName, string $extension): string
    {
        $fileName = $baseName . '.' . $extension;
        $counter = 1;

        while (File::exists($directory . DIRECTORY_SEPARATOR . $fileName)) {
            $fileName = $baseName . ' (' . $counter . ').' . $extension;
            $counter++;
        }

        return $fileName;
    }

    private function isImageFile(string $fileName): bool
    {
        $extension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
        return in_array($extension, ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'], true);
    }

    private function logAudit(string $action, string $description): void
    {
        try {
            DB::table('audit_logs')->insert([
                'action' => $action,
                'description' => $description,
                'user_id' => Auth::user()->user_id ?? null,
                'date_added' => now(),
                'ip_address' => request()->ip(),
            ]);
        } catch (\Throwable $e) {
            // Do not fail the request when audit logging fails.
        }
    }
}
