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
        
        /* EIR NO. - 2.2" from top, 6.75" from left */
        .eirno {
            top: 2.1in;
            left: 6.75in;
            font-size: 20px;
            letter-spacing: 5px;
            font-weight: bold;
        }
        
        /* GATE IN/OUT TEXT - 2.82" from top, 1" from left */
        .gate-status-text {
            top: 2.82in;
            left: 1in;
            font-size: 20px;
            letter-spacing: 7px;
            font-weight: bold;
        }
        
        /* DATE TIME - 2.82" from top, 6" from left */
        .datetime {
            top: 2.78in;
            left: 5.7in;
            font-size: 18px;
            letter-spacing: 2px;
        }
        
        /* Container NO. - 3.33" from top, 1.87" from left */
        .container-no {
            top: 3.27in;
            left: 1.76in;
            font-size: 18px;
            letter-spacing:2px;
        }
        
        /* Vessel - 3.75" from top, 1.87" from left */
        .vessel {
            top: 3.70in;
            left: 1.76in;
            font-size: 18px;
            letter-spacing: 2px;
        }
        
        /* Voyage - 4.2" from top, 1.87" from left */
        .voyage {
            top: 4.12in;
            left: 1.76in;
            font-size: 18px;
            letter-spacing: 2px;
        }
        
        /* Hauler - 4.65" from top, 1.87" from left */
        .hauler {
            top: 4.55in;
            left: 1.76in;
            font-size: 18px;
            letter-spacing: 2px;
        }
        
        /* Plate NO. - 5.07" from top, 1.87" from left */
        .plate-no {
            top: 4.95in;
            left: 1.76in;
            font-size: 18px;
            letter-spacing: 2px;
        }
        
        /* Chassis/Location - 5.47" from top, 1.87" from left */
        .chasis-location {
            top: 5.37in;
            left: 1.76in;
            font-size: 18px;
            letter-spacing: 2px;
        }
        
        /* Size/Type - 5.93" from top, 1.87" from left */
        .size-type {
            top: 5.81in;
            left: 1.76in;
            font-size: 18px;
            letter-spacing: 2px;
        }
        
        /* Status - 3.33" from top, 5.25" from left */
        .status {
            top: 3.27in;
            left: 4.78in;
            font-size: 18px;
            letter-spacing: 2px;
        }
        
        /* Destination - 3.75" from top, 5.25" from left */
        .destination {
            top: 3.70in;
            left: 4.78in;
            font-size: 18px;
            letter-spacing: 2px;
        }
        
        /* Load - 4.2" from top, 5.25" from left */
        .load {
            top: 4.12in;
            left: 4.78in;
            font-size: 18px;
            letter-spacing: 2px;
        }
        
        /* Booking - 4.65" from top, 5.25" from left */
        .booking {
            top: 4.55in;
            left: 4.78in;
            font-size: 18px;
            letter-spacing: 2px;
        }
        
        /* Seal NO. - 5.07" from top, 5.25" from left */
        .seal-no {
            top: 4.95in;
            left: 4.78in;
            font-size: 18px;
            letter-spacing: 2px;
        }
        
        /* Client - 5.47" from top, 5.25" from left */
        .client {
            top: 5.37in;
            left: 4.78in;
            font-size: 18px;
            letter-spacing: 2px;
        }
        
        /* Shipper/Consignee - 5.93" from top, 5.25" from left */
        .shipper-consignee {
            top: 5.81in;
            left: 4.78in;
            font-size: 18px;
            letter-spacing: 2px;
        }
        
        /* EIR Notes/Remarks - 6.4" from top, 1" from left */
        .remarks {
            top: 6.4in;
            left: 1in;
            width: 7in;
            font-size: 14px;
            letter-spacing: 2px;
            white-space: pre-wrap;
            word-break: break-word;
            max-height: 1in;
        }
        
        /* IN CHECKER text - 7.2" from top, 5" from left */
        .checker-label {
            top: 7.2in;
            left: 5in;
            font-size: 18px;
            letter-spacing: 5px;
        }
        
        /* Checker name - 7.5" from top, 5" from left */
        .checker-name {
            top: 7.5in;
            left: 5in;
            font-size: 18px;
            letter-spacing: 2px;
        }
        
        /* Hauler with license NO. - 10.05" from top, 1.75" from left */
        .hauler-license {
            top: 9.85in;
            left: 1.35in;
            font-size: 18px;
            letter-spacing: 2px;
        }
        
        /* Username/Full Name - 10.05" from top, 6.25" from left */
        .username-fullname {
            top: 9.85in;
            left: 6.25in;
            font-size: 18px;
            letter-spacing: 2px;
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
        
        // Auto-close tab after printing is done or cancelled
        window.addEventListener('afterprint', function() {
            setTimeout(function() {
                window.close();
            }, 300);
        });
    </script>
</body>
</html>
