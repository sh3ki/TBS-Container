<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('booking_scraping_shipping_line_matches', function (Blueprint $table): void {
            $table->id();
            $table->string('shipping_line', 255)->unique();
            $table->unsignedBigInteger('client_id');
            $table->timestamps();
        });

        Schema::create('booking_scraping_size_type_matches', function (Blueprint $table): void {
            $table->id();
            $table->string('size_type', 255)->unique();
            $table->unsignedBigInteger('size_type_id');
            $table->timestamps();
        });

        $shippingLines = [
            ['ASIAN HARVEST', 63], ['ASJS TRDG. & LOGS. PTE LTD', 43], ['ATIKO TRANS INC.', 82],
            ['BLPL', 32], ['BLUE WATER LINES PTE. LTD.', 52], ['BRIDGEHEAD CONTAINER', 26],
            ['CARPENTERS SHIPPING LINES', 81], ['CEEKAY LINE PTE LTD', 46], ['CEL LOGISTICS INC.', 65],
            ['CK LINES', 77], ['COLLYER PTE LTD', 40], ['CONCORDE', 102], ['COSCO', 18],
            ['COTS FREIGHT', 59], ['ELAN INTERNATIONAL SDN', 101], ['ENTERPHIL CONTAINER VAN TRADING', 72],
            ['EW LOGISTICS SHIPPING LINE', 103], ['FEDERATED CARGO', 79], ['FESCO', 109], ['HAMBURG SUD', 16],
            ['HANJIN SHIPPING CO., LTD', 8], ['HARBOUR-LINK LINES SDN. BHD.', 64],
            ['HYUNDAI MERCHANT MARINE (PHILIPPINES) CO. INC.', 75],
            ['INTERASIA FREIGHT CONNECTION PHILS., INC.', 93], ['JARDINE / CCNI', 23], ['KANWAY SHIPPING LTD.', 13],
            ['KERRY PACIFIC SINGAPORE PTE. LTD. /BLEIC', 58], ['KONTAINER MATE INC.', 94], ['KYOWA LINE CONTAINERS', 70],
            ['LANCER SHIPPING LINE', 89], ['MACRO OCEAN PHILS. INC.', 84], ['MARIANA EXPRESS LINE PTE. LTD', 9],
            ['MS TRIUMPH', 96], ['MSC', 67], ['NAMSUNG', 104], ['NEW ZEALAND', 80],
            ['OMNI CONTAINERS SOLUTIONS PTE. LTD.', 6], ['PACIFIC INTERNATIONAL LINES (PTE) LTD.', 44],
            ['PAN OCEAN CO. LTD.', 69], ['RCL', 7], ['SAMUDERA', 78], ['SINOKOR MERCHANT MARINE CO. LTD.', 39],
            ['SWIRE / NGPL -THE CHINA NAVIGATION CO. PTE. (SORIAMONT)', 10], ['TAEWOONG LOGISTICS', 99],
        ];
        foreach ($shippingLines as [$shippingLine, $clientId]) {
            DB::table('booking_scraping_shipping_line_matches')->insert([
                'shipping_line' => $shippingLine, 'client_id' => $clientId,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        $sizeTypes = [
            ['20 FT. FLAT RACK', 73], ['20 FT. OPEN TOP', 67], ['20 FT. STANDARD DRY CONTAINER', 58],
            ['20 FT. STANDARD REEFER CONTAINER', 62], ['20 RH', 63], ['40 FT. FLAT RACK', 68],
            ['40 FT. HIGH CUBE DRY CONTAINER', 60], ['40 FT. HIGH CUBE REEFER CONTAINER', 61],
            ['40 FT. OPEN TOP', 66], ['40 FT. STANDARD DRY CONTAINER', 59],
            ['40 FT. STANDARD REEFER CONTAINER', 78], ['45 FT. HIGH CUBE DRY CONTAINER', 64],
        ];
        foreach ($sizeTypes as [$sizeType, $sizeTypeId]) {
            DB::table('booking_scraping_size_type_matches')->insert([
                'size_type' => $sizeType, 'size_type_id' => $sizeTypeId,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_scraping_size_type_matches');
        Schema::dropIfExists('booking_scraping_shipping_line_matches');
    }
};
