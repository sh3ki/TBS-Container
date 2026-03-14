<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<title>EIR Inventory</title>
</head>
<body>
<table width="980" border="0" align="center" cellpadding="0" cellspacing="0" style="border-right-width: 1px; border-left-width: 1px; border-right-style: solid; border-left-style: solid; border-right-color: #000000; border-left-color: #000000; border-top:#000000 solid 1px; border-bottom:#000000 solid 1px;">
  <caption>
  </caption>
  <tr>
    <td align="left" valign="top"><table width="100%" border="0" cellpadding="0" cellspacing="0" style="padding-bottom:10px;">
      <tr>
        <td height="3" colspan="2" bgcolor="#FFFFFF"><font face="Verdana" style="font-size: 9pt"></font></td>
      </tr>
      <tr>
        <td width="550" valign="top"><table width="100%" border="0" cellpadding="0" cellspacing="0" style="padding-left:15px; padding-top:15px; padding-right:100px;">
          <tr>
            <td valign="top"><strong>GATE IN</strong></td>
            <td>&nbsp;</td>
          </tr>
          <tr>
          <td align="left" valign="top">Pre-Date:</td>
            <td>{{ $data['ipredate'] }}</td>
          </tr>
          <tr>
            <td align="left" valign="top"  style="padding-bottom:50px;">Pre-Time:</td>
            <td valign="top">{{ $data['ipretime'] }}</td>
          </tr>
          <tr>
            <td valign="top"><strong>Container No.</strong></td>
            <td>{{ $data['icno'] }}</td>
          </tr>
          <tr>
            <td valign="top"><strong>Client</strong></td>
            <td>{{ $data['client'] }}</td>
          </tr>
          <tr>
            <td valign="top"><strong>Voyage</strong></td>
            <td>{{ $data['ivoyage'] }}</td>
          </tr>
           <tr>
            <td valign="top"><strong>Vessel</strong></td>
            <td>{{ $data['ivessel'] }}</td>
          </tr>
           <tr>
           <td valign="top"><strong>Hauler</strong></td>
            <td>{{ $data['ihau'] }}</td>
          </tr>
           <tr>
             <td valign="top"><strong>Plate No.</strong></td>
            <td>{{ $data['ipno'] }}</td>
          </tr>
           <tr>
           <td valign="top"><strong>Load</strong></td>
            <td>{{ $data['itype'] }}</td>
          </tr>
          <tr>
             <td valign="top"><strong>Date</strong></td>
            <td>{{ $data['idate'] }}</td>
          </tr>
          <tr>
          </tr>
        </table></td>
        <td valign="top" bgcolor="#FFFFFF"><table width="100%" border="0" cellspacing="0" cellpadding="0" style="padding-right:200px;">
          <tr>
            <td align="left" valign="top" style="padding-top:14px;">Date</td>
            <td style="padding-top:14px;">{{ $data['idate'] }}</td>
          </tr>
          <tr>
            <td align="left" valign="top">Time:</td>
            <td>{{ $data['itime'] }}</td>
          </tr>
          <tr>
            <td align="left" valign="top"  style="padding-bottom:20px;"><strong>EIR No.</strong></td>
            <td valign="top">{{ $data['ieirno'] }}</td>
          </tr>
          <tr>
            <td align="left" valign="top"  style="padding-bottom:10px;">&nbsp;</td>
            <td>&nbsp;</td>
          </tr>
        <tr>
            <td align="left" valign="top"><strong>Size/Type</strong></td>
            <td>{{ $data['isize_type'] }} - {{ $data['iiso'] }}</td>
          </tr>
          <tr>
            <td align="left" valign="top"><strong>Status</strong></td>
            <td>{{ $data['icontainer_status'] }}</td>
          </tr>
          <tr>
            <td align="left" valign="top"><strong>Checker</strong></td>
            <td>{{ $data['iorigin'] }}</td>
          </tr>
          <tr>
            <td align="left" valign="top"><strong>Consignee</strong></td>
            <td>{{ $data['iconsignee'] }}</td>
          </tr>
          <tr>
            <td align="left" valign="top"><strong>Driver</strong></td>
            <td>{{ $data['ihaud'] }}</td>
          </tr>
          <tr>
            <td align="left" valign="top"><strong>Chasis</strong></td>
            <td>{{ $data['ichasis'] }}</td>
          </tr>
          <tr>
            <td align="left" valign="top"><strong>Class</strong></td>
            <td>{{ $data['iclass'] }}</td>
          </tr>
        </table></td>
      </tr>
    </table></td>
  </tr>
    <tr>
    <td width="100%" style="padding-left:15px;border-bottom-color: #5a7700;"><strong>Damage Remarks: (Damage, Location, Material, Repair, Size, Quantity)</strong></td>
  </tr>
  <tr>
    <td height="200px" style="padding-left:15px;border-bottom-color: #5a7700;" valign="top"></td>
  </tr>
  <tr></tr>
</table>

@if(!empty($data['oeirno']))
<table width="980" border="0" align="center" cellpadding="0" cellspacing="0" style="border-right-width: 1px; border-left-width: 1px; border-right-style: solid; border-left-style: solid; border-right-color: #000000; border-left-color: #000000; border-top:#000000 solid 1px; border-bottom:#000000 solid 1px;">
  <caption>
  </caption>
  <tr>
    <td align="left" valign="top"><table width="100%" border="0" cellpadding="0" cellspacing="0" style="padding-bottom:10px;">
      <tr>
        <td height="3" colspan="2" bgcolor="#FFFFFF"><font face="Verdana" style="font-size: 9pt"></font></td>
      </tr>
      <tr>
        <td width="550" valign="top"><table width="100%" border="0" cellpadding="0" cellspacing="0" style="padding-left:15px; padding-top:15px; padding-right:100px;">

         <tr>
            <td valign="top"><strong>GATE OUT</strong></td>
            <td>&nbsp;</td>
          </tr>
           <tr>
          <td align="left" valign="top">Pre-Date:</td>
            <td>{{ $data['opredate'] }}</td>
          </tr>
          <tr>
            <td align="left" valign="top"  style="padding-bottom:50px;">Pre-Time:</td>
            <td valign="top">{{ $data['opretime'] }}</td>
          </tr>
          <tr>
          <tr>
            <td valign="top"><strong>Vessel</strong></td>
            <td>{{ $data['ovessel'] }}</td>
          </tr>
          <tr>
            <td valign="top"><strong>Voyage</strong></td>
            <td>{{ $data['ovoyage'] }}</td>
          </tr>
           <tr>
            <td valign="top"><strong>Hauler</strong></td>
            <td>{{ $data['ohau'] }}</td>
          </tr>
           <tr>
            <td valign="top"><strong>Plate No.</strong></td>
            <td>{{ $data['opno'] }}</td>
          </tr>
           <tr>
            <td valign="top"><strong>Chasis</strong></td>
            <td>{{ $data['ochasis'] }}</td>
          </tr>
          <tr>
            <td valign="top"><table width="100%" border="0" cellspacing="10" cellpadding="0">
            </table></td>
          </tr>
          <tr></tr>
        </table></td>
        <td valign="top" bgcolor="#FFFFFF"><table width="100%" border="0" cellspacing="0" cellpadding="0" style="padding-right:200px;">
          <tr>
            <td align="left" valign="top" style="padding-top:14px;">Date</td>
            <td style="padding-top:14px;">{{ $data['odate'] }}</td>
          </tr>
          <tr>
            <td align="left" valign="top">Time:</td>
            <td>{{ $data['otime'] }}</td>
          </tr>
          <tr>
            <td align="left" valign="top"  style="padding-bottom:20px;"><strong>EIR No. </strong></td>
            <td valign="top" >{{ $data['oeirno'] }}</td>
          </tr>
          <tr>
            <td align="left" valign="top"  style="padding-bottom:10px;">&nbsp;</td>
            <td>&nbsp;</td>
          </tr>
          <tr>
            <td align="left" valign="top"><strong>Status</strong></td>
            <td>{{ $data['ocontainer_status'] }}</td>
          </tr>
          <tr>
            <td align="left" valign="top"><strong>Checker</strong></td>
            <td>{{ $data['oorigin'] }}</td>
          </tr>
          <tr>
            <td align="left" valign="top"><strong>Destination</strong></td>
            <td>{{ $data['olocation'] }}</td>
          </tr>
          <tr>
            <td align="left" valign="top"><strong>Load</strong></td>
            <td>{{ $data['otype'] }}</td>
          </tr>
          <tr>
            <td align="left" valign="top"><strong>Booking</strong></td>
            <td>{{ $data['obooking'] }}</td>
          </tr>
          <tr>
            <td align="left" valign="top"><strong>Seal No.</strong></td>
            <td>{{ $data['oseal_no'] }}</td>
          </tr>
          <tr>
            <td align="left" valign="top"><strong>Shipper</strong></td>
            <td>{{ $data['oshipper'] }}</td>
          </tr>
        </table></td>
      </tr>
    </table></td>
  </tr>
  <tr>
    <td width="100%" style="padding-left:15px;border-bottom-color: #5a7700;"><strong>Remarks: </strong></td>
  </tr>
  <tr>
    <td  height="200px" style="padding-left:15px;border-bottom-color: #5a7700;" valign="top">{{ $data['oremarks'] }}</td>
  </tr>
  <tr></tr>
</table>
@endif
</body>
</html>
