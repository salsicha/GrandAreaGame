/////

function BlockMove(event)
{
	// Tell Safari not to move the window.
	event.preventDefault() ;
}


function fireEvent(element,event)
{
    if (document.createEventObject){
        // dispatch for IE
        var evt = document.createEventObject();
        return element.fireEvent('on'+event,evt)
    }
    else{
        // dispatch for firefox + others
        var evt = document.createEvent("HTMLEvents");
        evt.initEvent(event, true, true ); // event type,bubbling,cancelable
        return !element.dispatchEvent(evt);
    }
}

function exploit(player,target)
{
	// add exploit action to action array
	// display exploit alert
	// delete any sanction actions from the attacker
	// update the sanction effect on sanctioned countries
	
	
}

function sanction(player,target)
{	
	// check to see if target can be sanctioned
	// add sanction action
	// check sanction strength
	// if country crumbles, apply exploit


}

function invade(player,target,playerCountryNumber,targetCountryNumber)
{	
	// compute distance
	// compare relative strengths
	// show invasion animation
	// if successfull, call exploit
	// update data
	
	
}

function coup(player,target,targetCountryNumber)
{	
	// compare family wealth
	// if successful, apply exploit
	// update data
	
}

function support(player,target,playerCountryNumber,targetCountryNumber)
{
	// add action to action array
	// update data
}


function countrySelector()
{

}

function lon2x(lon)
{
	var xfactor = 2.6938;
	var xoffset = 465.4;	
	
	var x = (lon * xfactor) + xoffset;
	
	return x;
}

function lat2y(lat)
{
	var yfactor = -2.6938;
	var yoffset = 227.066;
	
	var y = (lat * yfactor) + yoffset;

	return y;
}

function hex2num(hex)
{
	if(hex.charAt(0) == "#")
	{ 
		hex = hex.slice(1);
	}
	hex = hex.toUpperCase();
	var hex_alphabets = "0123456789ABCDEF";
	var value = new Array(3);
	var k = 0;
	var int1,int2;
	for(var i=0;i<6;i+=2)
	{
		int1 = hex_alphabets.indexOf(hex.charAt(i));
		int2 = hex_alphabets.indexOf(hex.charAt(i+1));
		value[k] = (int1 * 16) + int2;
 		k++;
	}
	return(value);
}

function num2hex(triplet)
{
	var hex_alphabets = "0123456789ABCDEF";
	var hex = "#";
	var int1,int2;
	for(var i=0;i<3;i++)
	{
		int1 = triplet[i] / 16;
		int2 = triplet[i] % 16;

		hex += hex_alphabets.charAt(int1) + hex_alphabets.charAt(int2);
	}
	return(hex);
}

function updateMap(indexToMap)
{
	var mapNames = "";
	var colors = "";
	var mapcounter = 0;
	
	if (indexToMap == "total_wealth")
	{
		index_data = total_wealth;
	} else if (indexToMap == "gini_index")
	{
		index_data = gini_index;
	} else if (indexToMap == "family_wealth")
	{
		index_data = family_wealth;
	} else if (indexToMap == "human_development")
	{
		index_data = human_development;
	} else if (indexToMap == "armed_forces")
	{
		index_data = armed_forces;
	} else if (indexToMap == "fuel_exports")
	{
		index_data = fuel_exports;
	}
	
	for (var state in worldmap) 
	{	
		var start = hex2num("#000000");
		for(var i=0;i<3;i++) 
		{
			start[i] = Number(start[i]);
		}
		
		for (var i in short_name)
		{	
			if (state == short_name[i])
			{
				// start[2] += index_data[i]*255;
				
				// state and fuel_exports have to be objects
				// var hello = 'god';
				// ({hello:2})['hello'] // 2
				
				// var myStr = window['str'+i];
				
				// alert(state);
				// alert(window['data.' + state + '.fuel_exports']);
				// alert(data[state][indexToMap]);
				// alert(eval('data.' + state + '.fuel_exports'));
				
				start[2] += data[state][indexToMap]*255;
				var finish_hex = num2hex(start);

				worldmap[state].animate({fill: "#333", stroke: "#888"}, 300);
				worldmap[state].animate({fill: finish_hex, stroke: "#ccc"}, 300);

				mapNames = mapNames + state + " " + short_name[i] + " " + i + " " + mapcounter + " " + index_data[i]*255 + ", ";
			}
		}
		mapcounter++;
	}				
	var ajaxDisplay = document.getElementById('ajaxDiv');
};

function clearMap()
{
	for (var state in worldmap) 
	{	
		worldmap[state].animate({fill: "#333", stroke: "#888"}, 300);
	}				
}

function showAction(player, target, place, type)
{
	var startx = 0;
	var starty = 0;
	var endx = 0;
	var endy = 0;
	var size = 8;
	
	if (target)
	{
		for (counter in short_name)
		{
			// console.log(data[short_name[counter]]["city_x"]);
			
			if (short_name[counter] == target)
			{
				endx = lon2x(data[short_name[counter]]["city_y"]);
				endy = lat2y(data[short_name[counter]]["city_x"]);
				
			}
		
			if (short_name[counter] == player)
			{
				startx = lon2x(data[short_name[counter]]["city_y"]);
				starty = lat2y(data[short_name[counter]]["city_x"]);
				
			}
		}
	
		if (place == 0)
		{
			for (counter in attackPath)
			{
				if (attackPath[counter])
				{
					if (counter >= 0)
					{
						attackPath[counter].remove();
					}
				}
			}
		} 
		
		if (type == "invade" || type == "sanction" || type == "coup" || type == "exploit" || type == "support")
		{
			var xdif = startx - endx;
			var ydif = starty - endy;
			
			angle = Math.atan2(endy-starty,startx-endx);
			angle = (2*Math.PI-angle-Math.PI);
			
			var newx1 = size*Math.cos(angle+2.5);
			var newx2 = size*Math.cos(angle-2.5);
			var newy1 = size*Math.sin(angle+2.5);
			var newy2 = size*Math.sin(angle-2.5);
			
			var linecolor = "#ff0000";
			
			if (type == "invade")
			{
				linecolor = "#ff0000";
			}
			else if (type == "coup")
			{
				linecolor = "#ffa000";
			}
			else if (type == "exploit")
			{
				linecolor = "#00ff00";
			} 
			else if (type == "sanction")
			{
				linecolor = "#ffff00";
			}
			else if (type == "support")
			{
				linecolor = "#ffffff";
			}
			
			arrowLength = Math.sqrt(xdif*xdif+ydif*ydif)/700;
			arrowLength = arrowLength.toFixed(5);
			// document.getElementById('arrowlength').innerHTML = arrowLength;

			attackPath[place] = R.path("M"+startx+" "+starty+" L"+endx+" "+endy+" L"+(endx+newx1)+" "+(endy+newy1)+" L"+(endx+newx2)+" "+(endy+newy2)+" L"+endx+" "+endy).attr({stroke: linecolor});
		} 
	}
}

function showAllActions(player, target, place, type)
{

}

function showActionsByCountry(state)
{

}

function roundNumbers(myNum)
{
	myNum = myNum*100000;
	myNum = Math.ceil(myNum);
	myNum = myNum/100000;
	return myNum;
}


function commitAction()
{	
	var ajaxRequest = new XMLHttpRequest();
	
	var player = document.getElementById('playerspan').innerHTML;
	var target = document.getElementById('targetspan').innerHTML;
	var action = document.getElementById('actions').options[document.getElementById('actions').selectedIndex].value;

	var queryString = "";
	
	var playerCountryNumber = 0;
	var targetCountryNumber = 0;
	for (counter in short_name)
	{
		if (player == short_name[counter])
		{
			playerCountryNumber = counter;
		}
		if (target == short_name[counter])
		{
			targetCountryNumber = counter;
		}
	}
	

	if (action == "invade")
	{
		if (target == "")
		{
			alert("please select a target");
		} else
		{
			invade(player,target,playerCountryNumber,targetCountryNumber);
		}
	} 
	else if (action == "support")
	{
		support(player,target,playerCountryNumber,targetCountryNumber);
	}
	else if (action == "sanction")
	{
		if (target == "")
		{
			alert("please select a target");
		} else
		{
			readPlayerTargets(player,"sanction",target);
		}
	} 
	else if (action == "coup")
	{
		if (target == "")
		{
			alert("please select a target");
		} else
		{
			debug==true ? document.getElementById('debug').innerHTML += "coup attempt: attacker family wealth = " + family_wealth[playerCountryNumber] + ", defender family wealth = " + family_wealth[targetCountryNumber] + "<br>" : debug=false;
			
			if (family_wealth[playerCountryNumber] > family_wealth[targetCountryNumber])
			{
				coup(player,target,targetCountryNumber);
			}
			else
			{
				alert("Failure, you are not rich enough to alter their elections.");
			}
		}
	}				
	else if (action == "protect")
	{
		protect(player,playerCountryNumber);
	}
	else if (action == "skim")
	{
		skim(player,action,playerCountryNumber);
	}

	
	ajaxRequest.onreadystatechange = function()
	{
		if(ajaxRequest.readyState == 4)
		{

		}
	}
}