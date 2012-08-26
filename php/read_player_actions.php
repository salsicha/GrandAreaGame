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
$action = $_GET['action'];

// Escape User Input to help prevent SQL Injection
$player = mysql_real_escape_string($player);
$action = mysql_real_escape_string($action);

//build query
$query = "SELECT * FROM actions WHERE short_name='".$player."' AND action='".$action."'";

//Execute query
$qry_result = mysql_query($query) or die(mysql_error());

//Build Result String
$player_string = "";
$target_string = "";
$action_string = "";

// Insert a new row in the table for each person returned
while($row = mysql_fetch_array($qry_result))
{
	$player_string .= $row["short_name"].",";
	$target_string .= $row["target"].",";
	$action_string .= $row["action"].",";
}

echo $player_string;
echo "nnn";
echo $target_string;
echo "nnn";
echo $action_string;
echo "nnn";

?>


