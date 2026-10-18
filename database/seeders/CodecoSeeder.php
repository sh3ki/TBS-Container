<?php

namespace Database\Seeders;

use App\Models\Codeco;
use Illuminate\Database\Seeder;

class CodecoSeeder extends Seeder
{
    public function run(): void
    {
        $segmentSource = 'https://service.unece.org/trade/untdid/d95b/trmd/codeco_s.htm';
        $valueSource = 'https://service.unece.org/trade/untdid/d95b/trmd/codeco_d.htm';

        // CODECO D95B segment structure and meanings from the official UNECE
        // message specification. Re-seeding is safe and updates corrections.
        $segments = [
            ['UNH', 'Message header', 'M', '1'], ['BGM', 'Beginning of message', 'M', '1'],
            ['FTX', 'Free text', 'C', '9'], ['RFF', 'Reference', 'C', '9'],
            ['TDT', 'Details of transport', 'C', '9'], ['LOC', 'Place/location identification', 'C', '9'],
            ['DTM', 'Date/time/period', 'C', '9'], ['NAD', 'Name and address', 'C', '9'],
            ['CTA', 'Contact information', 'C', '9'], ['COM', 'Communication contact', 'C', '9'],
            ['GID', 'Goods item details', 'C', '9999'], ['HAN', 'Handling instructions', 'C', '9'],
            ['PIA', 'Additional product id', 'C', '9'], ['MEA', 'Measurements', 'C', '9'],
            ['TMP', 'Temperature', 'C', '9'], ['RNG', 'Range details', 'C', '9'],
            ['SGP', 'Split goods placement', 'C', '9'], ['DGS', 'Dangerous goods', 'C', '9'],
            ['EQD', 'Equipment details', 'M', '9999'], ['TMD', 'Transport movement details', 'C', '9'],
            ['SEL', 'Seal number', 'C', '9'], ['EQA', 'Attached equipment', 'C', '9'],
            ['DAM', 'Damage', 'C', '9'], ['COD', 'Component details', 'C', '9'],
            ['CNT', 'Control total', 'C', '9'], ['UNT', 'Message trailer', 'M', '1'],
        ];

        foreach ($segments as $sequence => [$segment, $meaning, $usage, $repetition]) {
            Codeco::updateOrCreate(
                ['message_code' => 'CODECO', 'release' => 'D95B', 'record_type' => 'segment', 'segment_code' => $segment, 'element_code' => null, 'value_code' => null],
                compact('meaning', 'usage', 'repetition', 'sequence') + ['source_url' => $segmentSource, 'name' => $segment]
            );
        }

        // Officially defined CODECO qualifiers/values used by the message's
        // segment definitions. Keeping these in the same catalog makes them
        // available to the analyzer and mapping administration screens.
        $codes = [
            ['EQD', '8053', 'CN', 'Container', 'C'], ['EQD', '8053', 'CF', 'Container freight', 'C'],
            ['EQD', '8053', 'BB', 'Barge', 'C'], ['EQD', '8053', 'TE', 'Trailer', 'C'],
            ['EQD', '8249', '1', 'Full load', 'C'], ['EQD', '8249', '4', 'Empty', 'C'],
            ['EQD', '8169', '5', 'Containerised cargo', 'C'], ['EQD', '8169', '6', 'Non-containerised cargo', 'C'],
            ['TMD', '8341', 'FCL', 'Full container load', 'C'], ['TMD', '8341', 'LCL', 'Less than container load', 'C'],
            ['BGM', '1001', '34', 'Certificate of origin', 'C'], ['BGM', '1001', '45', 'Order', 'C'],
            ['BGM', '1001', '785', 'Container discharge/loading report', 'C'],
            ['RFF', '1153', 'BN', 'Booking reference number', 'C'], ['RFF', '1153', 'BM', 'Bill of lading number', 'C'],
            ['LOC', '3227', '9', 'Place of loading', 'C'], ['LOC', '3227', '11', 'Place of discharge', 'C'],
            ['LOC', '3227', '7', 'Place of delivery', 'C'], ['DTM', '2005', '7', 'Effective date/time', 'C'],
            ['DTM', '2005', '132', 'Arrival date/time', 'C'], ['DTM', '2005', '133', 'Departure date/time', 'C'],
            ['NAD', '3035', 'CA', 'Carrier', 'C'], ['NAD', '3035', 'MS', 'Document/message issuer/sender', 'C'],
            ['NAD', '3035', 'CN', 'Consignee', 'C'], ['SEL', '9303', 'CU', 'Customs seal', 'C'],
            ['SEL', '9303', 'SH', 'Shipper seal', 'C'], ['CNT', '6069', '16', 'Total number of equipment', 'C'],
        ];

        foreach ($codes as $sequence => [$segment, $element, $value, $meaning, $usage]) {
            Codeco::updateOrCreate(
                ['message_code' => 'CODECO', 'release' => 'D95B', 'record_type' => 'code', 'segment_code' => $segment, 'element_code' => $element, 'value_code' => $value],
                ['name' => $value, 'meaning' => $meaning, 'usage' => $usage, 'sequence' => $sequence, 'source_url' => $valueSource]
            );
        }
    }
}
