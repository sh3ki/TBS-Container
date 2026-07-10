<?php

namespace App\Services;

use Illuminate\Support\Collection;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Font;

class ReportExportService
{
    protected Spreadsheet $spreadsheet;
    protected int $currentRow = 1;

    public function __construct()
    {
        $this->spreadsheet = new Spreadsheet();
    }

    /**
     * Export incoming report grouped by client to XLS
     *
     * @param Collection $data
     * @param string $dateFrom
     * @param string $dateTo
     * @return string Path to the exported file
     */
    public function exportIncomingReportByClient(Collection $data, string $dateFrom, string $dateTo): string
    {
        // Create fresh spreadsheet for this export
        $this->spreadsheet = new Spreadsheet();
        $sheet = $this->spreadsheet->getActiveSheet();
        $this->currentRow = 1;

        // Group data by client
        $groupedByClient = $data->groupBy(function ($item) {
            return $item->client ?? 'Unknown Client';
        });

        // Styles
        $boldStyle = [
            'font' => ['name' => 'Calibri', 'size' => 9, 'bold' => true, 'color' => ['rgb' => '333333']],
            'alignment' => ['wrap' => true, 'horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
            'borders' => ['outline' => ['style' => Border::BORDER_THIN, 'color' => ['rgb' => '333333']]],
        ];

        $headerStyle = [
            'font' => ['name' => 'Calibri', 'size' => 9, 'bold' => true, 'color' => ['rgb' => '333333']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'E8E8E8']],
            'alignment' => ['wrap' => true, 'horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
            'borders' => ['outline' => ['style' => Border::BORDER_THIN, 'color' => ['rgb' => '333333']]],
        ];

        $cellStyle = [
            'font' => ['name' => 'Calibri', 'size' => 9, 'color' => ['rgb' => '333333']],
            'alignment' => ['wrap' => true, 'horizontal' => Alignment::HORIZONTAL_LEFT, 'vertical' => Alignment::VERTICAL_CENTER],
            'borders' => ['outline' => ['style' => Border::BORDER_THIN, 'color' => ['rgb' => '333333']]],
        ];

        // Headers to display (all available fields)
        $headers = ['EIR', 'Date', 'Time', 'Container No', 'Size/Type', 'Status', 'Vessel', 'Voyage', 'Class', 'Date Manu', 'Ex-Consignee', 'Hauler', 'Plate No', 'Load', 'Origin', 'Chasis'];

        // Process each client
        foreach ($groupedByClient as $clientName => $clientData) {
            // Client Name
            $sheet->setCellValue('A' . $this->currentRow, $clientName);
            $sheet->getStyle('A' . $this->currentRow)->applyFromArray($boldStyle);
            $this->currentRow++;

            // Title
            $sheet->setCellValue('A' . $this->currentRow, "Incoming Container Report from $dateFrom to $dateTo");
            $sheet->getStyle('A' . $this->currentRow)->applyFromArray($boldStyle);
            $this->currentRow++;

            // Headers
            $col = 'A';
            foreach ($headers as $header) {
                $sheet->setCellValue($col . $this->currentRow, $header);
                $sheet->getStyle($col . $this->currentRow)->applyFromArray($headerStyle);
                $col++;
            }
            $this->currentRow++;

            // Data rows for this client
            foreach ($clientData as $row) {
                $col = 'A';
                $sheet->setCellValue($col . $this->currentRow, $row->eir_no ?? '');
                $sheet->getStyle($col . $this->currentRow)->applyFromArray($cellStyle);
                $col++;

                $sheet->setCellValue($col . $this->currentRow, $row->date ?? '');
                $sheet->getStyle($col . $this->currentRow)->applyFromArray($cellStyle);
                $col++;

                $sheet->setCellValue($col . $this->currentRow, $row->time ?? '');
                $sheet->getStyle($col . $this->currentRow)->applyFromArray($cellStyle);
                $col++;

                $sheet->setCellValue($col . $this->currentRow, $row->container_no ?? '');
                $sheet->getStyle($col . $this->currentRow)->applyFromArray($cellStyle);
                $col++;

                $sheet->setCellValue($col . $this->currentRow, $row->size_type ?? '');
                $sheet->getStyle($col . $this->currentRow)->applyFromArray($cellStyle);
                $col++;

                $sheet->setCellValue($col . $this->currentRow, $row->status ?? '');
                $sheet->getStyle($col . $this->currentRow)->applyFromArray($cellStyle);
                $col++;

                $sheet->setCellValue($col . $this->currentRow, $row->vessel ?? '');
                $sheet->getStyle($col . $this->currentRow)->applyFromArray($cellStyle);
                $col++;

                $sheet->setCellValue($col . $this->currentRow, $row->voyage ?? '');
                $sheet->getStyle($col . $this->currentRow)->applyFromArray($cellStyle);
                $col++;

                $sheet->setCellValue($col . $this->currentRow, $row->class ?? '');
                $sheet->getStyle($col . $this->currentRow)->applyFromArray($cellStyle);
                $col++;

                $sheet->setCellValue($col . $this->currentRow, $row->date_manufactured ?? '');
                $sheet->getStyle($col . $this->currentRow)->applyFromArray($cellStyle);
                $col++;

                $sheet->setCellValue($col . $this->currentRow, $row->ex_consignee ?? '');
                $sheet->getStyle($col . $this->currentRow)->applyFromArray($cellStyle);
                $col++;

                $sheet->setCellValue($col . $this->currentRow, $row->hauler ?? '');
                $sheet->getStyle($col . $this->currentRow)->applyFromArray($cellStyle);
                $col++;

                $sheet->setCellValue($col . $this->currentRow, $row->plate_no ?? '');
                $sheet->getStyle($col . $this->currentRow)->applyFromArray($cellStyle);
                $col++;

                $sheet->setCellValue($col . $this->currentRow, $row->load ?? '');
                $sheet->getStyle($col . $this->currentRow)->applyFromArray($cellStyle);
                $col++;

                $sheet->setCellValue($col . $this->currentRow, $row->origin ?? '');
                $sheet->getStyle($col . $this->currentRow)->applyFromArray($cellStyle);
                $col++;

                $sheet->setCellValue($col . $this->currentRow, $row->chasis ?? '');
                $sheet->getStyle($col . $this->currentRow)->applyFromArray($cellStyle);

                $this->currentRow++;
            }

            // Add blank row between clients
            $this->currentRow++;
        }

        // Auto-size columns
        foreach (range('A', 'P') as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }

        // Save file
        $filename = 'IncomingReport_' . $dateFrom . '_to_' . $dateTo . '.xlsx';
        $filepath = storage_path('app/public/exports/' . $filename);

        // Ensure directory exists
        if (!file_exists(dirname($filepath))) {
            mkdir(dirname($filepath), 0755, true);
        }

        $writer = new Xlsx($this->spreadsheet);
        $writer->save($filepath);

        return $filepath;
    }

    /**
     * Export outgoing report grouped by client to XLS
     *
     * @param Collection $data
     * @param string $dateFrom
     * @param string $dateTo
     * @return string Path to the exported file
     */
    public function exportOutgoingReportByClient(Collection $data, string $dateFrom, string $dateTo): string
    {
        // Create fresh spreadsheet for this export
        $this->spreadsheet = new Spreadsheet();
        $sheet = $this->spreadsheet->getActiveSheet();
        $this->currentRow = 1;

        // Group data by client
        $groupedByClient = $data->groupBy(function ($item) {
            return $item->client ?? 'Unknown Client';
        });

        // Styles
        $boldStyle = [
            'font' => ['name' => 'Calibri', 'size' => 9, 'bold' => true, 'color' => ['rgb' => '333333']],
            'alignment' => ['wrap' => true, 'horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
            'borders' => ['outline' => ['style' => Border::BORDER_THIN, 'color' => ['rgb' => '333333']]],
        ];

        $headerStyle = [
            'font' => ['name' => 'Calibri', 'size' => 9, 'bold' => true, 'color' => ['rgb' => '333333']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'E8E8E8']],
            'alignment' => ['wrap' => true, 'horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
            'borders' => ['outline' => ['style' => Border::BORDER_THIN, 'color' => ['rgb' => '333333']]],
        ];

        $cellStyle = [
            'font' => ['name' => 'Calibri', 'size' => 9, 'color' => ['rgb' => '333333']],
            'alignment' => ['wrap' => true, 'horizontal' => Alignment::HORIZONTAL_LEFT, 'vertical' => Alignment::VERTICAL_CENTER],
            'borders' => ['outline' => ['style' => Border::BORDER_THIN, 'color' => ['rgb' => '333333']]],
        ];

        // Headers to display
        $headers = ['EIR', 'Date', 'Time', 'Container No', 'Size/Type', 'Status', 'Vessel', 'Voyage', 'Shipper', 'Hauler', 'Booking', 'Destination', 'Plate No', 'Load', 'Chasis', 'Seal No'];

        // Process each client
        foreach ($groupedByClient as $clientName => $clientData) {
            // Client Name
            $sheet->setCellValue('A' . $this->currentRow, $clientName);
            $sheet->getStyle('A' . $this->currentRow)->applyFromArray($boldStyle);
            $this->currentRow++;

            // Title
            $sheet->setCellValue('A' . $this->currentRow, "Outgoing Container Report from $dateFrom to $dateTo");
            $sheet->getStyle('A' . $this->currentRow)->applyFromArray($boldStyle);
            $this->currentRow++;

            // Headers
            $col = 'A';
            foreach ($headers as $header) {
                $sheet->setCellValue($col . $this->currentRow, $header);
                $sheet->getStyle($col . $this->currentRow)->applyFromArray($headerStyle);
                $col++;
            }
            $this->currentRow++;

            // Data rows for this client
            foreach ($clientData as $row) {
                $col = 'A';
                $sheet->setCellValue($col . $this->currentRow, $row->eir_no ?? '');
                $sheet->getStyle($col . $this->currentRow)->applyFromArray($cellStyle);
                $col++;

                $sheet->setCellValue($col . $this->currentRow, $row->date ?? '');
                $sheet->getStyle($col . $this->currentRow)->applyFromArray($cellStyle);
                $col++;

                $sheet->setCellValue($col . $this->currentRow, $row->time ?? '');
                $sheet->getStyle($col . $this->currentRow)->applyFromArray($cellStyle);
                $col++;

                $sheet->setCellValue($col . $this->currentRow, $row->container_no ?? '');
                $sheet->getStyle($col . $this->currentRow)->applyFromArray($cellStyle);
                $col++;

                $sheet->setCellValue($col . $this->currentRow, $row->size_type ?? '');
                $sheet->getStyle($col . $this->currentRow)->applyFromArray($cellStyle);
                $col++;

                $sheet->setCellValue($col . $this->currentRow, $row->status ?? '');
                $sheet->getStyle($col . $this->currentRow)->applyFromArray($cellStyle);
                $col++;

                $sheet->setCellValue($col . $this->currentRow, $row->vessel ?? '');
                $sheet->getStyle($col . $this->currentRow)->applyFromArray($cellStyle);
                $col++;

                $sheet->setCellValue($col . $this->currentRow, $row->voyage ?? '');
                $sheet->getStyle($col . $this->currentRow)->applyFromArray($cellStyle);
                $col++;

                $sheet->setCellValue($col . $this->currentRow, $row->shipper ?? '');
                $sheet->getStyle($col . $this->currentRow)->applyFromArray($cellStyle);
                $col++;

                $sheet->setCellValue($col . $this->currentRow, $row->hauler ?? '');
                $sheet->getStyle($col . $this->currentRow)->applyFromArray($cellStyle);
                $col++;

                $sheet->setCellValue($col . $this->currentRow, $row->booking ?? '');
                $sheet->getStyle($col . $this->currentRow)->applyFromArray($cellStyle);
                $col++;

                $sheet->setCellValue($col . $this->currentRow, $row->destination ?? '');
                $sheet->getStyle($col . $this->currentRow)->applyFromArray($cellStyle);
                $col++;

                $sheet->setCellValue($col . $this->currentRow, $row->plate_no ?? '');
                $sheet->getStyle($col . $this->currentRow)->applyFromArray($cellStyle);
                $col++;

                $sheet->setCellValue($col . $this->currentRow, $row->load ?? '');
                $sheet->getStyle($col . $this->currentRow)->applyFromArray($cellStyle);
                $col++;

                $sheet->setCellValue($col . $this->currentRow, $row->chasis ?? '');
                $sheet->getStyle($col . $this->currentRow)->applyFromArray($cellStyle);
                $col++;

                $sheet->setCellValue($col . $this->currentRow, $row->seal_no ?? '');
                $sheet->getStyle($col . $this->currentRow)->applyFromArray($cellStyle);

                $this->currentRow++;
            }

            // Add blank row between clients
            $this->currentRow++;
        }

        // Auto-size columns
        foreach (range('A', 'P') as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }

        // Save file
        $filename = 'OutgoingReport_' . $dateFrom . '_to_' . $dateTo . '.xlsx';
        $filepath = storage_path('app/public/exports/' . $filename);

        // Ensure directory exists
        if (!file_exists(dirname($filepath))) {
            mkdir(dirname($filepath), 0755, true);
        }

        $writer = new Xlsx($this->spreadsheet);
        $writer->save($filepath);

        return $filepath;
    }
}
