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

//build query
$query = "SELECT * FROM defaults WHERE short_name='".$player."'";

//Execute query
$qry_result = mysql_query($query) or die(mysql_error());

//Build Result String
$results = mysql_fetch_array($qry_result);
$long_name_string = $results["long_name"];
$short_name_string = $results["short_name"];
$fuel_exports_string = $results["fuel_exports"];
$total_wealth_string = $results["total_wealth"];
$gini_index_string = $results["gini_index"];
$human_development_string = $results["human_development"];
$armed_forces_string = $results["armed_forces"];

echo $long_name_string."nnn";
echo $short_name_string."nnn";
echo $fuel_exports_string."nnn";
echo $total_wealth_string."nnn";
echo $gini_index_string."nnn";
echo $human_development_string."nnn";
echo $armed_forces_string."nnn";

?>
