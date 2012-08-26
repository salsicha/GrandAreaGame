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
$index = $_GET['index'];
$value = $_GET['value'];

// Escape User Input to help prevent SQL Injection
$player = mysql_real_escape_string($player);
$index = mysql_real_escape_string($index);
$value = mysql_real_escape_string($value);

//build query
// $query = "INSERT INTO actions (short_name, action, target) VALUES ('".$player."', '".$action."', '".$target."')";
$query = "UPDATE indices SET ".$index."='".$value."' WHERE short_name='".$player."'";

//Execute query
$qry_result = mysql_query($query) or die(mysql_error());

// echo $qry_result;
?>
