<?php
$dbhost = "mysql.grandareagame.com";
$dbuser = "gauser";
$dbpass = "gapass2";
$dbname = "grandarea_db";

//Connect to MySQL Server
mysql_connect($dbhost, $dbuser, $dbpass);

//Select Database
mysql_select_db($dbname) or die(mysql_error());

$selectedindex = $_GET['selectedindex'];

$selectedindex = mysql_real_escape_string($selectedindex);

//build query
$query = "SELECT * FROM cities";

//Execute query
$qry_result = mysql_query($query) or die(mysql_error());

$city_string = "";
$laty_string = "";
$lonx_string = "";

// Insert a new row in the table for each person returned
while($row = mysql_fetch_array($qry_result))
{
	$city_string .= $row["city_name"].",";
	$laty_string .= $row["lat_y"].",";
	$lonx_string .= $row["lon_x"].",";
}

echo $city_string;
echo "nnn";
echo $laty_string;
echo "nnn";
echo $lonx_string;
echo "nnn";
?>
