<?php
$dbhost = "mysql.grandareagame.com";
$dbuser = "gauser";
$dbpass = "gapass2";
$dbname = "grandarea_db";

//Connect to MySQL Server
mysql_connect($dbhost, $dbuser, $dbpass);

//Select Database
mysql_select_db($dbname) or die(mysql_error());

// Retrieve data from Query String
$player = $_GET['player'];
$target = $_GET['target'];
$action = $_GET['action'];

// Escape User Input to help prevent SQL Injection
$player = mysql_real_escape_string($player);
$target = mysql_real_escape_string($target);
$action = mysql_real_escape_string($action);



// randomly adjust the indices of all non-player countries by small amounts
// the more countries that sanction or exploit a country the more likely it will revolt (total collapse)
// A country at 50% it's wealth revolts, or 150% human dev revolutes
// poverty gets too bad (total wealth goes down by half) and the country automatically goes into protect mode, cancelling all exploits
// human development gets high enough and the country becomes socialist and becomes immune to exploits, coups, and sanctions, and its gini index drops down to almost zero




//read from database
// $query = "SELECT * FROM actions WHERE short_name='".$player."' OR target='".$player."'";
// $qry_result = mysql_query($query) or die(mysql_error());

//write to database
// $query = "INSERT INTO actions (short_name, action, target) VALUES ('".$player."', '".$action."', '".$target."')";
// $qry_result = mysql_query($query) or die(mysql_error());

// $to = "salsicha@gmail.com";
// $subject = " test execute script";
// $message = "test ";
// $from = "noreply@presentcreative.com";
// $headers = "From: $from";
// mail($to,$subject,$message,$headers);

// echo "done!";
?>
