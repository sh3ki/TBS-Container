<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>EIR - {{ $data['eirno'] ?? 'Print Document' }}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        @page {
            size: letter portrait;
            margin: 0;
            padding: 0;
        }
        
        html, body {
            width: 8.5in;
            height: 11in;
            margin: 0;
            padding: 0;
            font-family: Arial, Helvetica, sans-serif;
            background: white;
        }
        
        .print-container {
            position: relative;
            width: 8.5in;
            height: 11in;
            background: white;
        }
        
        /* Base styling for positioned elements */
        .print-field {
            position: absolute;
            font-family: Arial, Helvetica, sans-serif;
            white-space: nowrap;
            overflow: hidden;
        }
        
        /* EIR NO. - 2" from top, 6.75" from left */
        .eirno {
            top: 2in;
            left: 6.75in;
            font-size: 18px;
            letter-spacing: 7px;
            font-weight: normal;
        }
        
        /* GATE IN/OUT TEXT - 2.62" from top, 1" from left */
        .gate-status-text {
            top: 2.62in;
            left: 1in;
            font-size: 20px;
            letter-spacing: 7px;
            font-weight: bold;
        }
        
        /* DATE TIME - 2.62" from top, 6" from left */
        .datetime {
            top: 2.62in;
            left: 6in;
            font-size: 18px;
            letter-spacing: 5px;
        }
        
        /* Container NO. - 3.13" from top, 1.87" from left */
        .container-no {
            top: 3.13in;
            left: 1.87in;
            font-size: 18px;
            letter-spacing: 7px;
        }
        
        /* Vessel - 3.55" from top, 1.87" from left */
        .vessel {
            top: 3.55in;
            left: 1.87in;
            font-size: 18px;
            letter-spacing: 7px;
        }
        
        /* Voyage - 4" from top, 1.87" from left */
        .voyage {
            top: 4in;
            left: 1.87in;
            font-size: 18px;
            letter-spacing: 7px;
        }
        
        /* Hauler - 4.45" from top, 1.87" from left */
        .hauler {
            top: 4.45in;
            left: 1.87in;
            font-size: 18px;
            letter-spacing: 7px;
        }
        
        /* Plate NO. - 4.87" from top, 1.87" from left */
        .plate-no {
            top: 4.87in;
            left: 1.87in;
            font-size: 18px;
            letter-spacing: 7px;
        }
        
        /* Chassis/Location - 5.27" from top, 1.87" from left */
        .chasis-location {
            top: 5.27in;
            left: 1.87in;
            font-size: 18px;
            letter-spacing: 7px;
        }
        
        /* Size/Type - 5.73" from top, 1.87" from left */
        .size-type {
            top: 5.73in;
            left: 1.87in;
            font-size: 18px;
            letter-spacing: 7px;
        }
        
        /* Status - 3.13" from top, 5.25" from left */
        .status {
            top: 3.13in;
            left: 5.25in;
            font-size: 18px;
            letter-spacing: 7px;
        }
        
        /* Destination - 3.55" from top, 5.25" from left */
        .destination {
            top: 3.55in;
            left: 5.25in;
            font-size: 18px;
            letter-spacing: 7px;
        }
        
        /* Load - 4" from top, 5.25" from left */
        .load {
            top: 4in;
            left: 5.25in;
            font-size: 18px;
            letter-spacing: 7px;
        }
        
        /* Booking - 4.45" from top, 5.25" from left */
        .booking {
            top: 4.45in;
            left: 5.25in;
            font-size: 18px;
            letter-spacing: 7px;
        }
        
        /* Seal NO. - 4.87" from top, 5.25" from left */
        .seal-no {
            top: 4.87in;
            left: 5.25in;
            font-size: 18px;
            letter-spacing: 7px;
        }
        
        /* Client - 5.27" from top, 5.25" from left */
        .client {
            top: 5.27in;
            left: 5.25in;
            font-size: 18px;
            letter-spacing: 7px;
        }
        
        /* Shipper/Consignee - 5.73" from top, 5.25" from left */
        .shipper-consignee {
            top: 5.73in;
            left: 5.25in;
            font-size: 18px;
            letter-spacing: 7px;
        }
        
        /* EIR Notes/Remarks - 6.2" from top, 1" from left */
        .remarks {
            top: 6.2in;
            left: 1in;
            width: 6.5in;
            font-size: 14px;
            letter-spacing: 7px;
            white-space: pre-wrap;
            word-break: break-word;
            max-height: 0.8in;
            overflow: hidden;
        }
        
        /* IN CHECKER text - 7" from top, 5" from left */
        .checker-label {
            top: 7in;
            left: 5in;
            font-size: 18px;
            letter-spacing: 7px;
        }
        
        /* Checker name - 7.3" from top, 5" from left */
        .checker-name {
            top: 7.3in;
            left: 5in;
            font-size: 18px;
            letter-spacing: 7px;
        }
        
        /* Hauler with license NO. - 9.85" from top, 1.75" from left */
        .hauler-license {
            top: 9.85in;
            left: 1.75in;
            font-size: 18px;
            letter-spacing: 7px;
        }
        
        /* Username/Full Name - 9.85" from top, 6.25" from left */
        .username-fullname {
            top: 9.85in;
            left: 6.25in;
            font-size: 18px;
            letter-spacing: 7px;
        }
        
        /* Print-specific styles */
        @media print {
            * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            
            html, body {
                width: 100%;
                height: 100%;
                margin: 0;
                padding: 0;
            }
            
            .print-container {
                width: 100%;
                height: 100%;
                page-break-after: avoid;
            }
        }
    </style>
</head>
<body>
    <div class="print-container">
        <!-- EIR NO. -->
        <div class="print-field eirno">{{ $data['eirno'] ?? '' }}</div>
        
        <!-- GATE IN/OUT STATUS TEXT -->
        <div class="print-field gate-status-text">GATE {{ $data['gate_status'] ?? 'IN' }}</div>
        
        <!-- DATE and TIME -->
        <div class="print-field datetime">{{ $data['date'] ?? '' }} {{ $data['time'] ?? '' }}</div>
        
        <!-- LEFT COLUMN (1.87" from left) -->
        <div class="print-field container-no">{{ $data['container_no'] ?? '' }}</div>
        <div class="print-field vessel">{{ $data['vessel'] ?? '' }}</div>
        <div class="print-field voyage">{{ $data['voyage'] ?? '' }}</div>
        <div class="print-field hauler">{{ $data['hauler'] ?? '' }}</div>
        <div class="print-field plate-no">{{ $data['plate_no'] ?? '' }}</div>
        <div class="print-field chasis-location">
            {{ $data['chasis'] ?? '' }}
            @if (!empty($data['location']) && ($data['gate_status'] ?? '') === 'IN')
                /{{ $data['location'] }}
            @endif
        </div>
        <div class="print-field size-type">{{ $data['size_type'] ?? '' }} - {{ $data['iso_code'] ?? $data['iso'] ?? '' }}</div>
        
        <!-- RIGHT COLUMN (5.25" from left) -->
        <div class="print-field status">{{ $data['container_status'] ?? '' }}</div>
        <div class="print-field destination">{{ ($data['gate_status'] ?? '') === 'OUT' ? ($data['location'] ?? '') : '' }}</div>
        <div class="print-field load">{{ $data['load_type'] ?? $data['type'] ?? '' }}</div>
        <div class="print-field booking">{{ $data['booking'] ?? '' }}</div>
        <div class="print-field seal-no">{{ $data['seal_no'] ?? '' }}</div>
        <div class="print-field client">{{ substr($data['client_code'] ?? $data['client'] ?? '', 0, 18) }}</div>
        <div class="print-field shipper-consignee">
            @if (($data['gate_status'] ?? '') === 'IN')
                {{ substr($data['ex_consignee'] ?? '', 0, 18) }}
            @else
                {{ substr($data['shipper'] ?? '', 0, 18) }}
            @endif
        </div>
        
        <!-- EIR NOTES / REMARKS -->
        <div class="print-field remarks">{{ $data['remarks'] ?? '' }}</div>
        
        <!-- CHECKER SECTION -->
        <div class="print-field checker-label">{{ ($data['gate_status'] ?? '') === 'IN' ? 'IN CHECKER' : 'OUT CHECKER' }}</div>
        <div class="print-field checker-name">{{ $data['checker'] ?? $data['origin'] ?? '' }}</div>
        
        <!-- HAULER WITH LICENSE NO. AND USER FULLNAME -->
        <div class="print-field hauler-license">{{ $data['hauler_driver'] ?? $data['haud'] ?? '' }}/{{ $data['license_no'] ?? $data['lno'] ?? '' }}</div>
        <div class="print-field username-fullname">{{ $data['user_full_name'] ?? $data['fn'] ?? '' }}</div>
    </div>
    
    <script type="text/javascript">
        // Auto-print on load
        window.addEventListener('load', function() {
            setTimeout(function() {
                window.print();
            }, 500);
        });
    </script>
</body>
</html>
