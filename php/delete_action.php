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
// $player = $_GET['player'];
$target = $_GET['target'];
$action = $_GET['action'];

// Escape User Input to help prevent SQL Injection
// $player = mysql_real_escape_string($player);
$target = mysql_real_escape_string($target);
$action = mysql_real_escape_string($action);

//build query
// $query = "DELETE FROM actions WHERE short_name='".$player."' AND target='".$target."' AND action='".$action."'";
// $query = "DELETE FROM actions WHERE target='".$target."' AND action='exploit'";
$query = "DELETE FROM actions WHERE target='".$target."' AND action='".$action."'";

//Execute query
$qry_result = mysql_query($query) or die(mysql_error());

?>
