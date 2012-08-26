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

// Escape User Input to help prevent SQL Injection
$player = mysql_real_escape_string($player);

//build query
$query = "DELETE FROM actions WHERE target='$player' AND action='lock'";

//Execute query
$qry_result = mysql_query($query) or die(mysql_error());
?>
