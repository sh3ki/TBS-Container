<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<title>EIR Print Out Form - Gate {{ $data['gate_status'] }}</title>
</head>
<body style="margin:0 !important;">
<table width="1280" border="0" align="center" cellpadding="0" cellspacing="0">
<tr>
<td width="100%" align="left" valign="top"><table width="100%" border="0" cellpadding="0" cellspacing="0" style="padding-bottom:10px; font-size: 18px; font-family:Arial, Helvetica, sans-serif;">
<tr>
<td align="right" height="3" colspan="2" bgcolor="#FFFFFF"><table width="100%" border="0" cellspacing="0" cellpadding="0">
<tr>
<td width="50%" height="150">&nbsp;</td>
<td align="right" valign="bottom" style="font-size: 18px; font-family:Arial, Helvetica, sans-serif; letter-spacing: 7px;">{{ $data['eirno'] }}</td>
</tr>
</table></td>
</tr>
<tr>
<td><table width="100%" border="0" cellspacing="0" cellpadding="0">
<tr>
<td width="50%" height="70" valign="bottom" style="font-size: 20px; font-family:Arial, Helvetica, sans-serif; letter-spacing: 7px;"><strong>GATE {{ $data['gate_status'] }}</strong></td>
<td width="50%" valign="bottom" align="right" style="font-size: 18px; font-family:Arial, Helvetica, sans-serif; letter-spacing:5px;">{{ $data['date'] }} <span style="font-size:18px">{{ $data['time'] }}</span></td>
</tr>
</table></td>
</tr>
<tr></tr>
<td width="550" valign="top"><table width="100%" border="0" cellpadding="0" cellspacing="0" style="padding-left:15px; padding-top:15px; padding-right:100px; font-family:Arial, Helvetica, sans-serif; font-size:18px; letter-spacing: 7px;">
<tr><td style="padding-top:15px;"></td></tr>
<tr>
<td width="15%" height="48" valign="bottom"  >&nbsp;</td>
<td width="20%" valign="top"  >{{ $data['container_no'] }}</td>
<td width="20%" valign="top"  >&nbsp;</td>
<td width="25%" valign="top"  >{{ $data['container_status'] }}</td>
</tr>
<tr>
<td height="43" valign="bottom"  >&nbsp;</td>
<td width="25%" valign="top"  >{{ $data['vessel'] }}</td>
<td valign="top"  >&nbsp;</td>
<td width="25%" valign="top"  >{{ $data['gate_status'] == 'OUT' ? $data['location'] : '' }}</td>
</tr>
<tr>
<td height="43" valign="bottom"  >&nbsp;</td>
<td width="25%" valign="top"  >{{ $data['voyage'] }}</td>
<td valign="top"  >&nbsp;</td>
<td width="25%" valign="top"  >{{ $data['load_type'] }}</td>
</tr>
<tr>
<td height="44" valign="bottom"  >&nbsp;</td>
<td width="25%" valign="top"  >{{ $data['hauler'] }}</td>
<td valign="top"  >&nbsp;</td>
<td width="25%" valign="top"  >{{ $data['booking'] ?? '' }}</td>	
</tr>
<tr>
<td height="46" valign="bottom"  >&nbsp;</td>
<td width="25%" valign="top"  >{{ $data['plate_no'] }}</td>
<td valign="top"  >&nbsp;</td>
<td width="25%" valign="top"  >{{ $data['seal_no'] ?? '' }}</td>
</tr>
<tr>
<td height="44" valign="bottom"  >&nbsp;</td>
<td width="25%" valign="top"  >{{ $data['chasis'] }}{{ (!empty($data['location']) && $data['gate_status'] == 'IN') ? '/' . $data['location'] : '' }}</td>
<td valign="top"  >&nbsp;</td>
<td width="25%" valign="top"  >{{ substr($data['client_code'], 0, 18) }}</td>
</tr>
<tr>
<td height="53" valign="bottom"  >&nbsp;</td>
<td width="25%" valign="top"  >{{ $data['size_type'] }} - {{ $data['iso_code'] }}</td>
<td valign="top"  >&nbsp;</td>
<td width="25%" valign="top"  >{{ $data['gate_status'] == 'IN' ? substr($data['ex_consignee'], 0, 18) : substr($data['shipper'] ?? '', 0, 18) }}</td>
</tr>
<tr>
<td colspan="4" valign="top" style="padding:10px;"><table width="100%" border="0" cellspacing="0" cellpadding="8">
<tr>
<td colspan="4" valign="top" height="140" style="font-family:Arial, Helvetica, sans-serif; font-size:14px; letter-spacing:7px;">{{ $data['remarks'] }}</td>
</tr>
<tr>
<td height="53" valign="bottom"  >&nbsp;</td>
<td width="25%" valign="top" align="right">{{ $data['gate_status'] }} CHECKER {{ $data['checker'] }}</td>
<td valign="top"  >&nbsp;</td>
<td width="25%" valign="top"  ></td>
</tr>
<tr>
<td height="53" valign="bottom"  >&nbsp;</td>
<td width="25%" valign="top"  ></td>
<td valign="top"  >&nbsp;</td>
<td width="25%" valign="top"  ></td>
</tr>
<tr>
<td height="53" valign="bottom" align="center">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{{ $data['hauler_driver'] }}/{{ $data['license_no'] }}</td>
<td width="25%" valign="top"  ></td>
<td valign="top"  >&nbsp;</td>
<td width="25%" valign="bottom" align="right">{{ $data['user_full_name'] }}</td>
</tr>
</table></td>
</tr>
<tr></tr>
</table></td>
<tr><td></td></tr>
<td valign="top" bgcolor="#FFFFFF"><table width="100%" border="0" cellspacing="0" cellpadding="0" style="padding-right:200px;">
</table></td>
</tr>
</table></td>
</tr></td>
</tr>
</table>
</td>
</tr>
</table>
<script type="text/javascript">window.print();</script>
</body>
</html>
