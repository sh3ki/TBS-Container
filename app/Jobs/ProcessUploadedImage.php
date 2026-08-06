<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ProcessUploadedImage implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tmpPath;
    public $finalPath;
    public $width;
    public $height;
    public $quality;

    /**
     * Create a new job instance.
     * @param string $tmpPath absolute path to uploaded temp file
     * @param string $finalPath absolute path where processed image should be saved
     * @param int $width desired width (480)
     * @param int $height desired height (640)
     * @param int $quality jpeg quality
     */
    public function __construct($tmpPath, $finalPath, $width = 480, $height = 640, $quality = 72)
    {
        $this->tmpPath = $tmpPath;
        $this->finalPath = $finalPath;
        $this->width = (int) $width;
        $this->height = (int) $height;
        $this->quality = (int) $quality;
    }

    /**
     * Execute the job.
     */
    public function handle()
    {
        try {
            if (!file_exists($this->tmpPath)) {
                return;
            }

            $destW = $this->width;
            $destH = $this->height;
            $jpegQuality = $this->quality;

            // Prefer Imagick if available for speed and quality
            if (class_exists('Imagick')) {
                $img = new \Imagick($this->tmpPath);
                // Flatten multi-frame images
                if ($img->getNumberImages() > 1) {
                    $img = $img->coalesceImages();
                    $img = $img->getImage();
                }
                $img->stripImage();

                // Compute resize to fit within destW x destH preserving aspect ratio
                $srcW = $img->getImageWidth();
                $srcH = $img->getImageHeight();
                $scale = min($destW / $srcW, $destH / $srcH, 1);
                $newW = max(1, (int) round($srcW * $scale));
                $newH = max(1, (int) round($srcH * $scale));

                $img->resizeImage($newW, $newH, \Imagick::FILTER_LANCZOS, 1);

                // Create canvas and composite centered to avoid cropping
                $canvas = new \Imagick();
                $canvas->newImage($destW, $destH, new \ImagickPixel('white'));
                $canvas->setImageColorspace(\Imagick::COLORSPACE_RGB);
                $canvas->compositeImage($img, \Imagick::COMPOSITE_OVER, (int)(($destW - $newW) / 2), (int)(($destH - $newH) / 2));
                $canvas->setImageFormat('jpeg');
                $canvas->setImageCompression(\Imagick::COMPRESSION_JPEG);
                $canvas->setImageCompressionQuality($jpegQuality);
                if (defined('Imagick::INTERLACE_PLANE')) {
                    $canvas->setInterlaceScheme(\Imagick::INTERLACE_PLANE);
                }
                $canvas->stripImage();
                // Ensure directory exists
                $dir = dirname($this->finalPath);
                if (!is_dir($dir)) {
                    @mkdir($dir, 0755, true);
                }
                $canvas->writeImage($this->finalPath);
                $canvas->clear();
                $canvas->destroy();
                $img->clear();
                $img->destroy();
            } else {
                // GD fallback
                $info = @getimagesize($this->tmpPath);
                if ($info === false) {
                    @unlink($this->tmpPath);
                    return;
                }
                $srcW = $info[0];
                $srcH = $info[1];
                $mimeType = $info['mime'] ?? '';

                switch ($mimeType) {
                    case 'image/jpeg':
                    case 'image/pjpeg':
                        $srcImg = @imagecreatefromjpeg($this->tmpPath);
                        break;
                    case 'image/png':
                        $srcImg = @imagecreatefrompng($this->tmpPath);
                        break;
                    case 'image/gif':
                        $srcImg = @imagecreatefromgif($this->tmpPath);
                        break;
                    default:
                        $srcImg = null;
                }

                if (!$srcImg) {
                    @unlink($this->tmpPath);
                    return;
                }

                $scale = min($destW / $srcW, $destH / $srcH, 1);
                $newW = max(1, (int) round($srcW * $scale));
                $newH = max(1, (int) round($srcH * $scale));

                $dstImg = imagecreatetruecolor($destW, $destH);
                $white = imagecolorallocate($dstImg, 255, 255, 255);
                imagefilledrectangle($dstImg, 0, 0, $destW, $destH, $white);

                $dstX = (int) floor(($destW - $newW) / 2);
                $dstY = (int) floor(($destH - $newH) / 2);

                imagecopyresampled($dstImg, $srcImg, $dstX, $dstY, 0, 0, $newW, $newH, $srcW, $srcH);

                // Ensure directory exists
                $dir = dirname($this->finalPath);
                if (!is_dir($dir)) {
                    @mkdir($dir, 0755, true);
                }

                imageinterlace($dstImg, true);
                imagejpeg($dstImg, $this->finalPath, $jpegQuality);

                imagedestroy($srcImg);
                imagedestroy($dstImg);
            }

            // Remove temp file
            @unlink($this->tmpPath);
        } catch (\Exception $e) {
            // On failure, attempt to move original file to final location
            try {
                $dir = dirname($this->finalPath);
                if (!is_dir($dir)) {
                    @mkdir($dir, 0755, true);
                }
                @rename($this->tmpPath, $this->finalPath);
            } catch (\Exception $ex) {
                // log if needed
            }
        }
    }
}
