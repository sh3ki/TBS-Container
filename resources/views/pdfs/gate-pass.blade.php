<html xmlns="http://www.w3.org/1999/xhtml"><head>
				<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
				<title>EIR Print Out Form - Gate In</title>
				</head>
				<body style="margin:0 !important;">
				<table width="1280" cellspacing="0" cellpadding="0" border="0" align="center">
				<tbody><tr>
				<td width="100%" valign="top" align="left"><table style="padding-bottom:10px; font-size: 18px; font-family:Arial, Helvetica, sans-serif;" width="100%" cellspacing="0" cellpadding="0" border="0">
				<tbody><tr>
				<td colspan="2" height="3" bgcolor="#FFFFFF" align="right"><table width="100%" cellspacing="0" cellpadding="0" border="0">
				<tbody><tr>
				<td width="50%" height="150">&nbsp;</td>
				<td style="font-size: 18px; font-family:Arial, Helvetica, sans-serif; letter-spacing: 7px;" valign="bottom" align="right">{{ $data['eirno'] }}</td>
				</tr>
				</tbody></table></td>
				</tr>
				<tr>
				<td><table width="100%" cellspacing="0" cellpadding="0" border="0">
				<tbody><tr>
				<td style="font-size: 20px; font-family:Arial, Helvetica, sans-serif; letter-spacing: 7px;" width="50%" valign="bottom" height="70"><strong>GATE {{ $data['gate_status'] }}</strong></td>
				<td style="font-size: 18px; font-family:Arial, Helvetica, sans-serif; letter-spacing:5px;" width="50%" valign="bottom" align="right">{{ $data['date'] }} <span style="font-size:18px">{{ $data['time'] }}</span></td>
				</tr>
				</tbody></table></td>
				</tr>
				<tr></tr>
				<tr><td width="550" valign="top"><table style="padding-left:15px; padding-top:15px; padding-right:100px; font-family:Arial, Helvetica, sans-serif; font-size:18px; letter-spacing: 7px;" width="100%" cellspacing="0" cellpadding="0" border="0">
				<tbody><tr><td style="padding-top:15px;"></td></tr>
				<tr>
				<td width="15%" valign="bottom" height="48">&nbsp;</td>
				<td width="20%" valign="top">{{ $data['container_no'] }}</td>
				<td width="20%" valign="top">&nbsp;</td>
				<td width="25%" valign="top">{{ $data['container_status'] }}</td>
				</tr>
				<tr>
				<td valign="bottom" height="43">&nbsp;</td>
				<td width="25%" valign="top">{{ $data['vessel'] }}</td>
				<td valign="top">&nbsp;</td>
				<td width="25%" valign="top">{{ $data['gate_status'] == 'OUT' ? $data['location'] : '' }}</td>
				</tr>
				<tr>
				<td valign="bottom" height="43">&nbsp;</td>
				<td width="25%" valign="top">{{ $data['voyage'] }}</td>
				<td valign="top">&nbsp;</td>
				<td width="25%" valign="top">{{ $data['load_type'] }}</td>
				</tr>
				<tr>
				<td valign="bottom" height="44">&nbsp;</td>
				<td width="25%" valign="top">{{ $data['hauler'] }}</td>
				<td valign="top">&nbsp;</td>
				<td width="25%" valign="top">{{ $data['booking'] ?? '' }}</td>	
				</tr>
				<tr>
				<td valign="bottom" height="46">&nbsp;</td>
				<td width="25%" valign="top">{{ $data['plate_no'] }}</td>
				<td valign="top">&nbsp;</td>
				<td width="25%" valign="top">{{ $data['seal_no'] ?? '' }}</td>
				</tr>
				<tr>
				<td valign="bottom" height="44">&nbsp;</td>
				<td width="25%" valign="top">{{ $data['chasis'] }}{{ (!empty($data['location']) && $data['gate_status'] == 'IN') ? '/' . $data['location'] : '' }}</td>
				<td valign="top">&nbsp;</td>
				<td width="25%" valign="top">{{ substr($data['client_code'], 0, 18) }}</td>
				</tr>
				<tr>
				<td valign="bottom" height="53">&nbsp;</td>
				<td width="25%" valign="top">{{ $data['size_type'] }} - {{ $data['iso_code'] }}</td>
				<td valign="top">&nbsp;</td>
				<td width="25%" valign="top">{{ $data['gate_status'] == 'IN' ? substr($data['ex_consignee'], 0, 18) : substr($data['shipper'] ?? '', 0, 18) }}</td>
				</tr>
				<tr>
				<td colspan="4" style="padding:10px;" valign="top"><table width="100%" cellspacing="0" cellpadding="8" border="0">
				<tbody><tr>
				<td colspan="4" style="font-family:Arial, Helvetica, sans-serif; font-size:14px; letter-spacing:7px; white-space: pre-line;" valign="top" height="140">{{ $data['remarks'] }}</td>
				</tr>
				<tr>
				<td valign="bottom" height="53">&nbsp;</td>
				<td width="25%" valign="top" align="right">{{ $data['gate_status'] }} CHECKER {{ $data['checker'] }}</td>
				<td valign="top">&nbsp;</td>
				<td width="25%" valign="top"></td>
				</tr>
				<tr>
				<td valign="bottom" height="53">&nbsp;</td>
				<td width="25%" valign="top"></td>
				<td valign="top">&nbsp;</td>
				<td width="25%" valign="top"></td>
				</tr>
				<tr>
				<td valign="bottom" height="53" align="center">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{{ $data['hauler_driver'] }}/{{ $data['license_no'] }}</td>
				<td width="25%" valign="top"></td>
				<td valign="top">&nbsp;</td>
				<td width="25%" valign="bottom" align="right">{{ $data['user_full_name'] }}</td>
				</tr>
				</tbody></table></td>
				</tr>
				<tr></tr>
				</tbody></table></td>
				</tr><tr><td></td></tr>
				<tr><td valign="top" bgcolor="#FFFFFF"><table style="padding-right:200px;" width="100%" cellspacing="0" cellpadding="0" border="0">
				</table></td>
				</tr>
				</tbody></table></td>
				</tr>
                
				</tbody></table>
                
                
                
				<!-- <script type="text/javascript">window.print();</script> -->
                
				</body></html>
