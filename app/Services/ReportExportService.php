<?php

namespace App\Services;

use Illuminate\Support\Collection;
use Carbon\Carbon;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Writer\Xls;
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

    /**
     * Export DMR (Daily Monitoring Report) - Aging Report to XLS
     *
     * @param Collection $data
     * @param string $date
     * @param string $clientName
     * @return string Path to the exported file
     */
    public function exportDmrReportByClient(Collection $data, string $date, string $clientName): string
    {
        // Create fresh spreadsheet for this export
        $this->spreadsheet = new Spreadsheet();
        $sheet = $this->spreadsheet->getActiveSheet();
        $this->currentRow = 1;

        // Styles
        $titleStyle = [
            'font' => ['name' => 'Calibri', 'size' => 11, 'bold' => true, 'color' => ['rgb' => '000000']],
            'alignment' => ['wrap' => true, 'horizontal' => Alignment::HORIZONTAL_LEFT, 'vertical' => Alignment::VERTICAL_CENTER],
        ];

        $subtitleStyle = [
            'font' => ['name' => 'Calibri', 'size' => 10, 'bold' => true, 'color' => ['rgb' => '000000']],
            'alignment' => ['wrap' => true, 'horizontal' => Alignment::HORIZONTAL_LEFT, 'vertical' => Alignment::VERTICAL_CENTER],
        ];

        $headerStyle = [
            'font' => ['name' => 'Calibri', 'size' => 9, 'bold' => true, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '366092']],
            'alignment' => ['wrap' => true, 'horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
            'borders' => ['outline' => ['style' => Border::BORDER_THIN, 'color' => ['rgb' => '000000']]],
        ];

        $cellStyle = [
            'font' => ['name' => 'Calibri', 'size' => 9, 'color' => ['rgb' => '000000']],
            'alignment' => ['wrap' => true, 'horizontal' => Alignment::HORIZONTAL_LEFT, 'vertical' => Alignment::VERTICAL_CENTER],
            'borders' => ['outline' => ['style' => Border::BORDER_THIN, 'color' => ['rgb' => '000000']]],
        ];

        $subtotalStyle = [
            'font' => ['name' => 'Calibri', 'size' => 9, 'bold' => true, 'color' => ['rgb' => '000000']],
            'alignment' => ['wrap' => true, 'horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
            'borders' => ['outline' => ['style' => Border::BORDER_THIN, 'color' => ['rgb' => '000000']]],
        ];

        // Title
        $sheet->setCellValue('A' . $this->currentRow, 'TBS CONTAINER YARD OPC, INC');
        $sheet->getStyle('A' . $this->currentRow)->applyFromArray($titleStyle);
        $this->currentRow++;

        // Subtitle
        $sheet->setCellValue('A' . $this->currentRow, 'INVENTORY REPORT AS OF ' . $date . ' FOR ' . strtoupper($clientName));
        $sheet->getStyle('A' . $this->currentRow)->applyFromArray($subtitleStyle);
        $this->currentRow += 2;

        // Headers
        $headers = ['NO.', 'CONTAINER NO.', 'SIZE/TYPE', 'DATE IN', 'AGE', 'STATUS', 'CLASS', 'DMF'];
        $col = 'A';
        foreach ($headers as $header) {
            $sheet->setCellValue($col . $this->currentRow, $header);
            $sheet->getStyle($col . $this->currentRow)->applyFromArray($headerStyle);
            $col++;
        }
        $this->currentRow++;

        // Group data by size_type
        $groupedBySizeType = $data->groupBy('size_type');
        $rowNumber = 1;
        $totalUnits = 0;

        foreach ($groupedBySizeType as $sizeType => $sizeTypeData) {
            $sizeTypeCount = 0;
            
            // Data rows for this size type
            foreach ($sizeTypeData as $row) {
                $col = 'A';
                
                // NO.
                $sheet->setCellValue($col . $this->currentRow, $rowNumber);
                $sheet->getStyle($col . $this->currentRow)->applyFromArray($cellStyle);
                $col++;

                // CONTAINER NO.
                $sheet->setCellValue($col . $this->currentRow, $row->container_no ?? '');
                $sheet->getStyle($col . $this->currentRow)->applyFromArray($cellStyle);
                $col++;

                // SIZE/TYPE
                $sheet->setCellValue($col . $this->currentRow, $row->size_type ?? '');
                $sheet->getStyle($col . $this->currentRow)->applyFromArray($cellStyle);
                $col++;

                // DATE IN
                $sheet->setCellValue($col . $this->currentRow, $row->date_in ?? '');
                $sheet->getStyle($col . $this->currentRow)->applyFromArray($cellStyle);
                $col++;

                // AGE
                $sheet->setCellValue($col . $this->currentRow, $row->age ?? '');
                $sheet->getStyle($col . $this->currentRow)->applyFromArray($cellStyle);
                $col++;

                // STATUS
                $sheet->setCellValue($col . $this->currentRow, $row->status ?? '');
                $sheet->getStyle($col . $this->currentRow)->applyFromArray($cellStyle);
                $col++;

                // CLASS
                $sheet->setCellValue($col . $this->currentRow, $row->class ?? '');
                $sheet->getStyle($col . $this->currentRow)->applyFromArray($cellStyle);
                $col++;

                // DMF
                $sheet->setCellValue($col . $this->currentRow, $row->dmf ?? '');
                $sheet->getStyle($col . $this->currentRow)->applyFromArray($cellStyle);

                $this->currentRow++;
                $rowNumber++;
                $sizeTypeCount++;
            }

            // Subtotal row
            $sheet->setCellValue('C' . $this->currentRow, $sizeTypeCount);
            $sheet->getStyle('C' . $this->currentRow)->applyFromArray($subtotalStyle);
            $sheet->setCellValue('D' . $this->currentRow, 'UNITS');
            $sheet->getStyle('D' . $this->currentRow)->applyFromArray($subtotalStyle);
            $this->currentRow += 2;

            $totalUnits += $sizeTypeCount;
        }

        // Add spacing
        $this->currentRow += 3;

        // Total row
        $sheet->setCellValue('B' . $this->currentRow, 'TOTAL NO. OF UNITS');
        $sheet->getStyle('B' . $this->currentRow)->applyFromArray($subtotalStyle);
        $sheet->setCellValue('D' . $this->currentRow, $totalUnits);
        $sheet->getStyle('D' . $this->currentRow)->applyFromArray($subtotalStyle);

        // Auto-size columns
        foreach (range('A', 'H') as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }

        // Save file
        $filename = 'DMR_Report_' . $date . '.xlsx';
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
     * Export DCR (Daily Container Report) - Summary report by container size
     *
     * @param array $dcrData Contains: clients, twoin, fourin, twoout, fourout, teusList
     * @param string $date
     * @return string Path to the exported file
     */
    public function exportDcrReportByDate(array $dcrData, string $date): string
    {
        // Create fresh spreadsheet for this export
        $this->spreadsheet = new Spreadsheet();
        $sheet = $this->spreadsheet->getActiveSheet();
        
        // Minimal styles

        $count = 1;

        // ========== TITLE SECTION ==========
        $sheet->setCellValue('D' . $count, 'FJP WAREHOUSING & LOGISTICS');
        $sheet->mergeCells('D' . $count . ':H' . $count);
        $count++;

        $sheet->setCellValue('E' . $count, 'DAILY CONTAINER REPORT');
        $sheet->mergeCells('E' . $count . ':G' . $count);
        $count++;

        $sheet->setCellValue('D' . $count, 'DATE:');
        $sheet->setCellValue('E' . $count, Carbon::parse($date)->format('d-M-y'));
        $count += 2;

        $sheet->setCellValue('D' . $count, 'IN');
        $sheet->setCellValue('G' . $count, 'OUT');
        $sheet->mergeCells('D' . $count . ':E' . $count);
        $sheet->mergeCells('G' . $count . ':H' . $count);
        $count++;

        $sheet->setCellValue('D' . $count, "20'");
        $sheet->setCellValue('E' . $count, "40'");
        $sheet->setCellValue('G' . $count, "20'");
        $sheet->setCellValue('H' . $count, "40'");
        $count += 2;

        // ========== CLIENT DATA SECTION ==========
        $clientList = $dcrData['clients'] ?? [];
        $twoin = $dcrData['twoin'] ?? [];
        $fourin = $dcrData['fourin'] ?? [];
        $twoout = $dcrData['twoout'] ?? [];
        $fourout = $dcrData['fourout'] ?? [];

        $count_ti = 0;
        $count_fi = 0;
        $count_to = 0;
        $count_fo = 0;

        $total_ti = 0;
        $total_fi = 0;
        $total_to = 0;
        $total_fo = 0;
        


        foreach ($clientList as $cl) {
            $it = 0;
            $fi = 0;
            $ot = 0;
            $fo = 0;
            $has_rec = 0;

            // 20' IN
            if ($count_ti < count($twoin) && $cl->c_id == $twoin[$count_ti]->c_id) {
                $it = (int)$twoin[$count_ti]->num;
                $sheet->setCellValue('D' . $count, $it);
                $count_ti++;
                $total_ti += $it;
                $has_rec = 1;
            } else {
                $sheet->setCellValue('D' . $count, 0);
            }

            // 40' IN
            if ($count_fi < count($fourin) && $cl->c_id == $fourin[$count_fi]->c_id) {
                $fi = (int)$fourin[$count_fi]->num;
                $sheet->setCellValue('E' . $count, $fi);
                $count_fi++;
                $total_fi += $fi;
                $has_rec = 1;
            } else {
                $sheet->setCellValue('E' . $count, 0);
            }

            // 20' OUT
            if ($count_to < count($twoout) && $cl->c_id == $twoout[$count_to]->c_id) {
                $ot = (int)$twoout[$count_to]->num;
                $sheet->setCellValue('G' . $count, $ot);
                $count_to++;
                $total_to += $ot;
                $has_rec = 1;
            } else {
                $sheet->setCellValue('G' . $count, 0);
            }

            // 40' OUT
            if ($count_fo < count($fourout) && $cl->c_id == $fourout[$count_fo]->c_id) {
                $fo = (int)$fourout[$count_fo]->num;
                $sheet->setCellValue('H' . $count, $fo);
                $count_fo++;
                $total_fo += $fo;
                $has_rec = 1;
            } else {
                $sheet->setCellValue('H' . $count, 0);
            }

            if ($has_rec == 1) {
                $sheet->setCellValue('A' . $count, $cl->client_name);
                $count++;
            }
        }

        // Totals row
        $sheet->setCellValue('D' . $count, $total_ti);
        $sheet->setCellValue('E' . $count, $total_fi);
        $sheet->setCellValue('F' . $count, $total_ti + $total_fi);
        $sheet->setCellValue('G' . $count, $total_to);
        $sheet->setCellValue('H' . $count, $total_fo);
        $sheet->setCellValue('I' . $count, $total_to + $total_fo);

        $count += 4;

        // ========== TEUS SECTION ==========
        $sheet->setCellValue('A' . $count, 'TEUS');
        $count += 2;

        $teusList = $dcrData['teusList'] ?? [];
        $total_iin = 0;
        $total_iout = 0;
        $total_tsf = 0;

        foreach ($teusList as $t) {
            $iin = (int)($t->iin ?? 0);
            $iout = (int)($t->iout ?? 0);

            if ($iin > 0 || $iout > 0) {
                $sheet->setCellValue('A' . $count, $t->client_name);
                $sheet->setCellValue('D' . $count, $iin);
                $sheet->setCellValue('E' . $count, $iout);
                
                $total_ts = $iin + ($iout * 2);
                $sheet->setCellValue('G' . $count, $total_ts);
                
                $total_iin += $iin;
                $total_iout += $iout;
                $total_tsf += $total_ts;
                
                $count++;
            }
        }

        // TEUS totals
        $sheet->setCellValue('D' . $count, $total_iin);
        $sheet->setCellValue('E' . $count, $total_iout);
        $sheet->setCellValue('G' . $count, $total_tsf);
        $count++;

        // ========== BILLING SECTION (starts at K5, right side) ==========
        $billingData = $dcrData['billingData'] ?? [];
        
        $inCount = (int)($billingData['incoming_count'] ?? 0);
        $inRate = (int)($billingData['incoming_rate'] ?? 1200);
        $inTotal = $inCount * $inRate;
        
        $outCount = (int)($billingData['outgoing_count'] ?? 0);
        $outRate = (int)($billingData['outgoing_rate'] ?? 1000);
        $outTotal = $outCount * $outRate;
        
        $billRow = 5;

        // TOTAL AMOUNT header
        $sheet->setCellValue('K' . $billRow, 'TOTAL AMOUNT');
        $billRow += 2;

        // IN section
        $sheet->setCellValue('K' . $billRow, 'IN');
        $billRow += 2;

        $sheet->setCellValue('K' . $billRow, $inCount);
        $sheet->setCellValue('L' . $billRow, $inRate);
        $sheet->setCellValue('M' . $billRow, $inTotal);
        $billRow += 3;

        // IN summary
        $sheet->setCellValue('K' . $billRow, $inCount);
        $sheet->setCellValue('M' . $billRow, $inTotal);
        $sheet->setCellValue('O' . $billRow, $inTotal);
        $billRow += 2;

        // OUT section
        $sheet->setCellValue('K' . $billRow, 'OUT');
        $billRow += 2;

        $sheet->setCellValue('K' . $billRow, $outCount);
        $sheet->setCellValue('L' . $billRow, $outRate);
        $sheet->setCellValue('M' . $billRow, $outTotal);
        $billRow += 3;

        // OUT summary
        $sheet->setCellValue('K' . $billRow, $outCount);
        $sheet->setCellValue('M' . $billRow, $outTotal);
        $sheet->setCellValue('O' . $billRow, $outTotal);
        $billRow += 2;

        // GRAND TOTAL
        $grandTotal = $inTotal + $outTotal;
        $sheet->setCellValue('K' . $billRow, $inCount + $outCount);
        $sheet->setCellValue('M' . $billRow, $grandTotal);
        $sheet->setCellValue('O' . $billRow, $grandTotal);

        // ========== SET FIXED COLUMN WIDTHS (faster than auto-size) ==========
        $sheet->getColumnDimension('A')->setWidth(30);
        $sheet->getColumnDimension('B')->setWidth(2);
        $sheet->getColumnDimension('C')->setWidth(2);
        $sheet->getColumnDimension('D')->setWidth(10);
        $sheet->getColumnDimension('E')->setWidth(10);
        $sheet->getColumnDimension('F')->setWidth(10);
        $sheet->getColumnDimension('G')->setWidth(10);
        $sheet->getColumnDimension('H')->setWidth(10);
        $sheet->getColumnDimension('I')->setWidth(10);
        $sheet->getColumnDimension('J')->setWidth(2);
        $sheet->getColumnDimension('K')->setWidth(15);
        $sheet->getColumnDimension('L')->setWidth(12);
        $sheet->getColumnDimension('M')->setWidth(15);
        $sheet->getColumnDimension('O')->setWidth(15);

        // ========== SAVE FILE ==========
        $filename = 'DCR ' . Carbon::parse($date)->format('M d Y') . '.xlsx';
        $filepath = storage_path('app/public/exports/' . $filename);

        if (!file_exists(dirname($filepath))) {
            mkdir(dirname($filepath), 0755, true);
        }

        $writer = new Xlsx($this->spreadsheet);
        $writer->save($filepath);

        return $filepath;
    }
}
