
var raphaelZPDId = 0;

RaphaelZPD = function(raphaelPaper, o) 
{    
    // self pointer
    var ptr = this;

	this.initialized = false;
	this.opts = { zoom: true, pan: true, drag: false };
    this.root = null;
    this.id   = ++raphaelZPDId;

    this.root = raphaelPaper.canvas;

    // Construct the object
    this.gelem = document.createElementNS('http://www.w3.org/2000/svg', 'g');
	this.gelem.id = 'viewport'+this.id;
	this.root.appendChild(this.gelem);
	raphaelPaper.canvas = this.gelem;

    this.state = 'none'; 
    this.stateTarget = null;
    this.stateOrigin = null;
    this.stateTf = null;
    this.zoomLimit = 0;
    this.zoomCurrent = 0;

	var stateOrigin = {x:0, y:0};	
	var stateOrigin2 = {x:0, y:0};
	
	var z = 0;
	
	var touchA;
	var touchB;
	
	var pA = {x:0, y:0};
	var pB = {x:0, y:0};
	
	var zoomTotal = 1;
	var zoomMultiplier = 1;
	

	//     if (o) 
	// {
	// 	for (key in o) 
	// 	{
	// 		if (this.opts[key] != undefined) 
	// 		{
	// 			this.opts[key] = o[key];
	// 		}
	// 	}
	// }

    /**
    * Set the maximum amount of zoom mousewheel scrolls
    */
    this.setZoomLimit = function(limit){
        this.zoomLimit = limit;
    }

	/**
	 * Handler registration
	 */
	this.setupHandlers = function(root)
	{
		this.root.ontouchmove = this.handleTouchMove;
		this.root.ontouchstart = this.handleTouchStart;
		this.root.ontouchend = this.handleTouchEnd;
		
		// ontouchmove = this.handleTouchMove;
		// ontouchstart = this.handleTouchStart;
		// ontouchend = this.handleTouchEnd;
	}

	/**
	 * Instance an SVGPoint object with given event coordinates.
	 */
	this.getEventPoint = function(evt) {
		var p = this.root.createSVGPoint();

		p.x = evt.clientX;
		p.y = evt.clientY;

		return p;
	}

	/**
	 * Sets the current transform matrix of an element.
	 */
	this.setCTM = function(element, matrix) {
		var s = "matrix(" + matrix.a + "," + matrix.b + "," + matrix.c + "," + matrix.d + "," + matrix.e + "," + matrix.f + ")";

		element.setAttribute("transform", s);
	}

	/**
	 * Dumps a matrix to a string (useful for debug).
	 */
	this.dumpMatrix = function(matrix) {
		var s = "[ " + matrix.a + ", " + matrix.c + ", " + matrix.e + "\n  " + matrix.b + ", " + matrix.d + ", " + matrix.f + "\n  0, 0, 1 ]";

		return s;
	}

	/**
	* Sets attributes of an element.
	*/
	this.setAttributes = function(element, attributes){
		for (i in attributes)
			element.setAttributeNS(null, i, attributes[i]);
	}


	/**
	* Handle touches.
	*/
	this.handleTouchStart = function(evt)
	{
		// alert("newtouch");
		
		if (evt.preventDefault)
			evt.preventDefault();
		
		touchB = evt.touches[1];
		touchA = evt.touches[0];

		var svgDoc = evt.target.ownerDocument;
		var g = svgDoc.getElementById("viewport"+ptr.id);
		ptr.stateTf = g.getCTM().inverse();

		stateOrigin.x = touchA.clientX;
		stateOrigin.y = touchA.clientY;		
		pA.x = touchA.clientX;
		pA.y = touchA.clientY;
		
		if (touchB)
		{
			stateOrigin2.x = touchB.clientX;
			stateOrigin2.y = touchB.clientY;
			pB.x = touchB.clientX;
			pB.y = touchB.clientY;
		}
	}
	
	this.handleTouchEnd = function(evt) 
	{
		if (evt.preventDefault)
			evt.preventDefault();
		
		if (evt.touches[1])
		{
			// alert("touch 3 removed");
		} 
		else if (evt.touches[0])
		{
			if (evt.touches[0].clientX == pB.x && evt.touches[0].clientY == pB.y)
			{
				touchB = evt.touches[0];
				// alert("removed A first");
			}
		}
		else
		{
			touchB = evt.touches[1];
			touchA = evt.touches[0];
		}
	}

	this.handleTouchMove = function(evt) 
	{
		if (evt.preventDefault)
			evt.preventDefault();
			
		var svgDoc = evt.target.ownerDocument;
		var g = svgDoc.getElementById("viewport"+ptr.id);
		
		pA.x = touchA.clientX;
		pA.y = touchA.clientY;
		
		if (touchB)
		{
			var delOrigX = stateOrigin.x - stateOrigin2.x;
			var delOrigY = stateOrigin2.y - stateOrigin2.y;
			
			var centerPointX = delOrigX/2;
			var centerPointY = delOrigY/2;
			
			centerPointX = stateOrigin.x - centerPointX - 100;
			centerPointY = stateOrigin.y - centerPointY - 120;
			
			delOrigX = delOrigX*delOrigX;
			delOrigY = delOrigY*delOrigY;
			
			var deltaOrig = Math.sqrt(delOrigX + delOrigY);
			
			pB.x = touchB.clientX;
			pB.y = touchB.clientY;

			var delX = pA.x - pB.x;
			var delY = pA.y - pB.y;
			
			delX = delX*delX;
			delY = delY*delY;

			var delta = Math.sqrt(delX+delY);
			
			delta = delta - deltaOrig;
			
			z = delta/1600 + 1;
			
			if (z < 0.97)
			{
				z = 0.97;
			}
			
			if (z > 1.03)
			{
				z = 1.03;
			}
			
			// z = 1;
			
			zoomTotal += z - 1;
			
			zoomMultiplier = 1 + zoomTotal/10;
			
			centerPointX = centerPointX/zoomMultiplier;
			centerPointY = centerPointY/zoomMultiplier;

			var g = svgDoc.getElementById("viewport"+ptr.id);

			var k = ptr.root.createSVGMatrix().translate(centerPointX, centerPointY).scale(z).translate(-centerPointX, -centerPointY);

			ptr.setCTM(g, g.getCTM().multiply(k));
		}
		else
		{
			// alert(zoomTotal);
			
			var coef = 1;
			
			if (z > 1)
			{
				coef = 1 - (zoomMultiplier - 1);
				coef = coef/2;
			}
			
			var deltaPanX = (pA.x - stateOrigin.x) * coef;
			var deltaPanY = (pA.y - stateOrigin.y) * coef;
			
			ptr.setCTM(g, ptr.stateTf.inverse().translate(deltaPanX, deltaPanY));
		}
	}

    // end of constructor
  	ptr.setupHandlers(this.root);
	this.initialized = true;
}


