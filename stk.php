<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
$consumerKey = "0WddkJqmTDgTvNgZwSFegUKVA2jqhOKALPsGOnE1YJp1a6FC";
$consumerSecret = "XIv74OxG3JC4TtWT8u2usnJ4Os1TReqUZPlkGPF1XRk9HwnwGVyvzIhpowflaPIY";
$BusinessShortCode = "8033859";
$Passkey = "8f3c14409d470e6279b1f4bae8c83e9e825f373e949901a28205319069e83a2b";
$TillNumber = "5259614";
$CallBackURL = "https://aviator-fly.page.gd/callback.php";

if(isset($_GET['test'])){
  $cred = base64_encode("$consumerKey:$consumerSecret");
  $ch = curl_init("https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials");
  curl_setopt_array($ch, [
    CURLOPT_HTTPHEADER => ["Authorization: Basic $cred"],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_USERAGENT => "Mozilla/5.0",
    CURLOPT_TIMEOUT => 20
  ]);
  $r = curl_exec($ch);
  echo $r;
  exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$phone = preg_replace('/[^0-9]/','',$input['phone'] ?? '');
$amount = intval($input['amount'] ?? 0);
if($phone && $phone[0]=='0') $phone = '254'.substr($phone,1);

$now = new DateTime('now', new DateTimeZone('Africa/Nairobi'));
$Timestamp = $now->format('YmdHis');
$Password = base64_encode($BusinessShortCode.$Passkey.$Timestamp);

$cred = base64_encode("$consumerKey:$consumerSecret");
$ch = curl_init("https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials");
curl_setopt_array($ch, [
  CURLOPT_HTTPHEADER => ["Authorization: Basic $cred"],
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_SSL_VERIFYPEER => false,
  CURLOPT_SSL_VERIFYHOST => false,
  CURLOPT_USERAGENT => "Mozilla/5.0",
  CURLOPT_TIMEOUT => 20,
  CURLOPT_FOLLOWLOCATION => true
]);
$resp = curl_exec($ch);
$tokenData = json_decode($resp, true);
$token = $tokenData['access_token'] ?? '';
curl_close($ch);

if(!$token){
  echo json_encode(["ResponseCode"=>"1","errorMessage"=>"TOKEN FAILED","raw"=>$resp,"hint"=>"Go live: Daraja -> Lipa na Mpesa Production -> Go Live"]);
  exit;
}

$payload = [
 "BusinessShortCode"=>$BusinessShortCode,
 "Password"=>$Password,
 "Timestamp"=>$Timestamp,
 "TransactionType"=>"CustomerBuyGoodsOnline",
 "Amount"=>$amount,
 "PartyA"=>$phone,
 "PartyB"=>$TillNumber,
 "PhoneNumber"=>$phone,
 "CallBackURL"=>$CallBackURL,
 "AccountReference"=>"AVIATOR",
 "TransactionDesc"=>"Deposit"
];

$ch = curl_init("https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest");
curl_setopt_array($ch, [
  CURLOPT_HTTPHEADER => ["Content-Type: application/json","Authorization: Bearer $token"],
  CURLOPT_POST => true,
  CURLOPT_POSTFIELDS => json_encode($payload),
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_SSL_VERIFYPEER => false,
  CURLOPT_SSL_VERIFYHOST => false,
  CURLOPT_TIMEOUT => 30
]);
$result = curl_exec($ch);
curl_close($ch);
echo $result;
?>