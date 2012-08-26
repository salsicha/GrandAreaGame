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
// $target = $_GET['target'];
// $action = $_GET['action'];

// $selectedindex = $_GET['selectedindex'];

// Escape User Input to help prevent SQL Injection
// $player = mysql_real_escape_string($player);
// $target = mysql_real_escape_string($target);
// $action = mysql_real_escape_string($action);

// $selectedindex = mysql_real_escape_string($selectedindex);

//build query
$query = "SELECT * FROM indices";
	// $query .= " AND ae_target = '$target'";
	// $query .= " AND ae_action = '$action'";

//Execute query
$qry_result = mysql_query($query) or die(mysql_error());

//Build Result String
// $display_string = "<table>";
// $display_string .= "<tr>";
// $display_string .= "<th>country</th>";
// $display_string .= "<th>".$selectedindex."</th>";
// $display_string .= "<th>Target</th>";
// $display_string .= "<th>Action</th>";
// $display_string .= "</tr>";

$long_name_string = "";
$short_name_string = "";
$fuel_exports_string = "";
$total_wealth_string = "";
$gini_index_string = "";
$human_development_string = "";
$armed_forces_string = "";
$in_use_string = "";

// $array_string = "";

// Insert a new row in the table for each person returned
while($row = mysql_fetch_array($qry_result))
{
	// $display_string .= "<tr>";
	// $display_string .= "<td>$row[short_name]</td>";
	// $display_string .= "<td>$row[$selectedindex]</td>";
	// $display_string .= "<td>$row[ae_target]</td>";
	// $display_string .= "<td>$row[ae_action]</td>";
	// $display_string .= "</tr>";	

	$long_name_string .= $row["long_name"].",";
	$short_name_string .= $row["short_name"].",";
	$fuel_exports_string .= $row["fuel_exports"].",";
	$total_wealth_string .= $row["total_wealth"].",";
	$gini_index_string .= $row["gini_index"].",";
	$human_development_string .= $row["human_development"].",";
	$armed_forces_string .= $row["armed_forces"].",";
	$in_use_string .= $row["in_use"].",";
	
	
	// $array_string .= $row[$selectedindex].",";
}

// echo "Query: " . $query . "<br />";
// $display_string .= "</table>";

// $array_string .= "";
// echo $array_string;

echo $long_name_string."nnn";
echo $short_name_string."nnn";
echo $fuel_exports_string."nnn";
echo $total_wealth_string."nnn";
echo $gini_index_string."nnn";
echo $human_development_string."nnn";
echo $armed_forces_string."nnn";
echo $in_use_string."nnn";
?>
