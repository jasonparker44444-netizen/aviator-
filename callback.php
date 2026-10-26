<?php
$data = file_get_contents('php://input');
file_put_contents('mpesa_log.txt', date('Y-m-d H:i:s')." ".$data.PHP_EOL, FILE_APPEND);
$json = json_decode($data, true);
if(isset($json['Body']['stkCallback']['ResultCode']) && $json['Body']['stkCallback']['ResultCode']==0){
  $meta = $json['Body']['stkCallback']['CallbackMetadata']['Item'];
  $amount = 0; $phone = '';
  foreach($meta as $item){ 
    if($item['Name']=='Amount') $amount=$item['Value']; 
    if($item['Name']=='PhoneNumber') $phone=$item['Value']; 
  }
  // Here you can credit user balance in DB - money already in Till 5259614
  file_put_contents('payments.txt', "$phone paid $amount to Till 5259614".PHP_EOL, FILE_APPEND);
}
echo json_encode(["ResultCode"=>0,"ResultDesc"=>"Success"]);
?>