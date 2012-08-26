

var raphaelZPDId = 0;

RaphaelZPD = function(raphaelPaper, o) {
    function supportsSVG() {
        return document.implementation.hasFeature("http://www.w3.org/TR/SVG11/feature#BasicStructure", "1.1");
    }

    if (!supportsSVG()) {
        return null;
    }

    var me = this;

	me.initialized = false;
	me.opts = { 
		zoom: true, pan: true, drag: true, // Enable/disable core functionalities.
		zoomThreshold: null, // Zoom [out, in] boundaries. E.g [-100, 10].
	};

    me.id   = ++raphaelZPDId;
    me.root = raphaelPaper.canvas;

    me.gelem = document.createElementNS('http://www.w3.org/2000/svg', 'g');
	me.gelem.id = 'viewport'+me.id;
	me.root.appendChild(me.gelem);
	
	me.stateOrigin = {x:0, y:0};	
	me.stateOrigin2 = {x:0, y:0};
	
	me.z = 0;
	
	me.touchA;
	me.touchB;
	
	me.pA = {x:0, y:0};
	me.pB = {x:0, y:0};
	
	me.zoomTotal = 1;
	me.zoomMultiplier = 1;

	function overrideElements(paper) {
		var elementTypes = ['circle', 'rect', 'ellipse', 'image', 'text', 'path'];
		for(var i = 0; i < elementTypes.length; i++) {
		  overrideElementFunc(paper, elementTypes[i]);
		}
	}

	function overrideElementFunc(paper, elementType) {    
		paper[elementType] = function(oldFunc) {
		  return function() {
			var element = oldFunc.apply(paper, arguments);
			element.gelem = me.gelem;
			me.gelem.appendChild(element.node);
			return element;
		  };
		}(paper[elementType]);
	}

	overrideElements(raphaelPaper);

	function transformEvent(evt) {
		if (typeof evt.clientX != "number") return evt;

		svgDoc = evt.target.ownerDocument;

		var g = svgDoc.getElementById("viewport"+me.id);

		var p = me.getEventPoint(evt);

		p = p.matrixTransform(g.getCTM().inverse());

		evt.zoomedX = p.x;
		evt.zoomedY = p.y;

		return evt;
	}

	var events = ['click', 'dblclick', 'mousedown', 'mousemove', 'mouseout', 'mouseover', 'mouseup', 'touchstart', 'touchmove', 'touchend', 'orientationchange', 'touchcancel', 'gesturestart', 'gesturechange', 'gestureend'];

	events.forEach(function(eventName) {
		var oldFunc = Raphael.el[eventName];
		Raphael.el[eventName] = function(fn, scope) {
			if (fn === undefined) return;
			var wrap = function(evt) {
				return fn.apply(this, [transformEvent(evt)]);
			};
			return oldFunc.apply(this, [wrap, scope]);
		}
	});
	
	//raphaelPaper.canvas = me.gelem;

    me.state = 'none'; 
    me.stateTarget = null;
    // me.stateOrigin = null;
    me.stateTf = null;
    // me.zoomCurrent = 0;

    if (o) {
		for (key in o) {
			if (me.opts[key] !== undefined) {
				me.opts[key] = o[key];
			}
		}
	}

	/**
	 * Handler registration
	 */
	me.setupHandlers = function(root) {
		me.root.onmousedown = me.handleMouseDown;
		me.root.onmousemove = me.handleMouseMove;
		me.root.onmouseup   = me.handleMouseUp;

		me.root.ontouchmove = me.handleTouchMove;
		me.root.ontouchstart = me.handleTouchStart;
		me.root.ontouchend = me.handleTouchEnd;


		//me.root.onmouseout = me.handleMouseUp; // Decomment me to stop the pan functionality when dragging out of the SVG element

		if (navigator.userAgent.toLowerCase().indexOf('webkit') >= 0)
			me.root.addEventListener('mousewheel', me.handleMouseWheel, false); // Chrome/Safari
		else
			me.root.addEventListener('DOMMouseScroll', me.handleMouseWheel, false); // Others
	};

	/**
	 * Instance an SVGPoint object with given event coordinates.
	 */
	me.getEventPoint = function(evt) {
		var p = me.root.createSVGPoint();

		p.x = evt.clientX;
		p.y = evt.clientY;

		return p;
	};

	/**
	 * Sets the current transform matrix of an element.
	 */
	me.setCTM = function(element, matrix) {
		var s = "matrix(" + matrix.a + "," + matrix.b + "," + matrix.c + "," + matrix.d + "," + matrix.e + "," + matrix.f + ")";

		element.setAttribute("transform", s);
	};

	/**
	 * Dumps a matrix to a string (useful for debug).
	 */
	me.dumpMatrix = function(matrix) {
		var s = "[ " + matrix.a + ", " + matrix.c + ", " + matrix.e + "\n  " + matrix.b + ", " + matrix.d + ", " + matrix.f + "\n  0, 0, 1 ]";

		return s;
	};

	/**
	 * Sets attributes of an element.
	 */
	me.setAttributes = function(element, attributes) {
		for (i in attributes)
			element.setAttributeNS(null, i, attributes[i]);
	};

////






	me.handleTouchStart = function(evt) 
	{
		// TODO
		// invert the matrix to go between the coordinate systems
		// how to make tagname show up when tapping on water???
		
		if (evt.preventDefault)
			evt.preventDefault();
		
		me.touchB = evt.touches[1];
		me.touchA = evt.touches[0];

		var svgDoc = evt.target.ownerDocument;
		var g = svgDoc.getElementById("viewport"+me.id);
		me.stateTf = g.getCTM().inverse();
		
		// me.stateOrigin = me.getEventPoint(me.touchA).matrixTransform(me.stateTf);

		// me.stateOrigin.x = me.touchA.clientX;
		// me.stateOrigin.y = me.touchA.clientY;

		me.stateOrigin = me.getEventPoint(me.touchA).matrixTransform(me.stateTf);
		// me.pA = me.getEventPoint(me.touchA).matrixTransform(me.stateTF);
				
		// me.pA.x = me.touchA.clientX;
		// me.pA.y = me.touchA.clientY;
		
		if (me.touchB)
		{
			// me.stateOrigin2.x = me.touchB.clientX;
			// me.stateOrigin2.y = me.touchB.clientY;
			// me.pB.x = me.touchB.clientX;
			// me.pB.y = me.touchB.clientY;
			
			me.stateOrigin2 = me.getEventPoint(me.touchB).matrixTransform(me.stateTf);
			// me.pB = me.getEventPoint(me.touchB).matrixTransform(me.stateTF);
		}
		
			

			
			
		
		// if (evt.preventDefault)
		// 	evt.preventDefault();
		// 
		// evt.returnValue = false;
		// 
		// var svgDoc = evt.target.ownerDocument;
		// 
		// var g = svgDoc.getElementById("viewport"+me.id);
		// 
		// if (evt.target.tagName == "svg" || !me.opts.drag) 
		// {
		// 	// Pan mode
		// 	if (!me.opts.pan) return;
		// 
		// 	me.state = 'pan';
		// 
		// 	me.stateTf = g.getCTM().inverse();
		// 
		// 	me.stateOrigin = me.getEventPoint(evt).matrixTransform(me.stateTf);
		// } else 
		// {
		// 	// Move mode
		// 	if (!me.opts.drag || evt.target.draggable == false) return;
		// 
		// 	me.state = 'move';
		// 
		// 	me.stateTarget = evt.target;
		// 
		// 	me.stateTf = g.getCTM().inverse();
		// 
		// 	me.stateOrigin = me.getEventPoint(evt).matrixTransform(me.stateTf);
		// }
	};

	me.handleTouchEnd = function(evt) 
	{
		if (evt.preventDefault)
			evt.preventDefault();
		
		if (evt.touches[1])
		{
			// alert("touch 3 removed");
		} 
		else if (evt.touches[0])
		{
			if (evt.touches[0].clientX == me.pB.x && evt.touches[0].clientY == me.pB.y)
			{
				me.touchB = evt.touches[0];
				// alert("removed A first");
			}
		}
		else
		{
			// alert(me.pA.x);
			
			me.touchB = evt.touches[1];
			me.touchA = evt.touches[0];
		}
		
		
		
		// me.touchA = evt.touches[0];
		// var svgDoc = evt.target.ownerDocument;
		// var g = svgDoc.getElementById("viewport"+me.id);
		// me.stateTf = g.getCTM().inverse();
		// me.stateOrigin = me.getEventPoint(me.touchA).matrixTransform(me.stateTf);
		// var p1 = me.getEventPoint(me.touchA);
		// var p2 = me.getEventPoint(me.touchA).matrixTransform(me.stateTf);
		
		// alert(p1.x + " " + p2.x);
		

		// if (evt.preventDefault)
		// 	evt.preventDefault();
		// 
		// evt.returnValue = false;
		// 
		// var svgDoc = evt.target.ownerDocument;
		// 
		// if ((me.state == 'pan' && me.opts.pan) || (me.state == 'move' && me.opts.drag)) 
		// {
		// 	// Quit pan mode
		// 	me.state = '';
		// }
	};

	me.handleTouchMove = function(evt) 
	{
		// alert("alert");
		
		if (evt.preventDefault)
			evt.preventDefault();
			
		var svgDoc = evt.target.ownerDocument;
		var g = svgDoc.getElementById("viewport"+me.id);
		// me.stateTf = g.getCTM().inverse();

		// me.pA.x = me.touchA.clientX;
		// me.pA.y = me.touchA.clientY;

		me.pA = me.getEventPoint(me.touchA).matrixTransform(me.stateTF);
		
		if (me.touchB)
		{
			// alert("alert");
			
			var delOrig = me.root.createSVGPoint();
			var centerPoint = me.root.createSVGPoint();
			var del = me.root.createSVGPoint();

			delOrig.x = me.stateOrigin.x - me.stateOrigin2.x;
			delOrig.y = me.stateOrigin.y - me.stateOrigin2.y;
			
			centerPoint.x = delOrig.x/2;
			centerPoint.y = delOrig.y/2;
			
			centerPoint.x = me.stateOrigin.x - centerPoint.x;
			centerPoint.y = me.stateOrigin.y - centerPoint.y;
			
			delOrig.x = delOrig.x*delOrig.x;
			delOrig.y = delOrig.y*delOrig.y;
			
			var deltaOrig = Math.sqrt(delOrig.x + delOrig.y);
			
			// me.pB.x = me.touchB.clientX;
			// me.pB.y = me.touchB.clientY;
			
			me.pB = me.getEventPoint(me.touchB).matrixTransform(me.stateTF);

			del.x = me.pA.x - me.pB.x;
			del.y = me.pA.y - me.pB.y;
			
			del.x = del.x*del.x;
			del.y = del.y*del.y;

			var delta = Math.sqrt(del.x+del.y);
			
			// alert(delta + " " + deltaOrig);
			
			delta = delta - deltaOrig;
			
			me.z = delta/1800 + 1;
			
			// alert(me.z);
			
			if (me.z < 0.97)
			{
				me.z = 0.97;
			}
			
			if (me.z > 1.03)
			{
				me.z = 1.03;
			}
			
			// z = 1;
			
			me.zoomTotal += me.z - 1;
			
			me.zoomMultiplier = 1 + me.zoomTotal/10;
			
			// me.zoomMultiplier = 1;
			
			centerPoint.x = centerPoint.x/me.zoomMultiplier;
			centerPoint.y = centerPoint.y/me.zoomMultiplier;
			
			var k = me.root.createSVGMatrix().translate(centerPoint.x, centerPoint.y).scale(me.z).translate(-centerPoint.x, -centerPoint.y);

			me.setCTM(g, g.getCTM().multiply(k));
		}
		else
		{
			// alert(me.z);
			
			var coef = 1;
			var deltaPan = me.root.createSVGPoint();			
			
			// alert(me.z);
			
			if (me.z > 1)
			{
				coef = 1 - (me.zoomMultiplier - 1);
				coef = coef/10;
			}
			
			// alert(me.pA.y + " " + me.stateOrigin.y + " " + me.zoomMultiplier);
			
			deltaPan.x = (me.pA.x - 140 - me.stateOrigin.x) * coef;
			deltaPan.y = (me.pA.y - 30 - me.stateOrigin.y) * coef;
			
			// me.stateTf = g.getCTM().inverse();
			
			me.setCTM(g, me.stateTf.inverse().translate(deltaPan.x, deltaPan.y));
		}
		

		// if (evt.preventDefault)
		// 	evt.preventDefault();
		// 
		// evt.returnValue = false;
		// 
		// var svgDoc = evt.target.ownerDocument;
		// 
		// var g = svgDoc.getElementById("viewport"+me.id);
		// 
		// if (me.state == 'pan') 
		// {
		// 	// Pan mode
		// 	if (!me.opts.pan) return;
		// 
		// 	var p = me.getEventPoint(evt).matrixTransform(me.stateTf);
		// 
		// 	me.setCTM(g, me.stateTf.inverse().translate(p.x - me.stateOrigin.x, p.y - me.stateOrigin.y));
		// } else if (me.state == 'move') 
		// {
		// 	// Move mode
		// 	if (!me.opts.drag) return;
		// 
		// 	var p = me.getEventPoint(evt).matrixTransform(g.getCTM().inverse());
		// 
		// 	me.setCTM(me.stateTarget, me.root.createSVGMatrix().translate(p.x - me.stateOrigin.x, p.y - me.stateOrigin.y).multiply(g.getCTM().inverse()).multiply(me.stateTarget.getCTM()));
		// 
		// 	me.stateOrigin = p;
		// }
	};









////

	/**
	 * Handle mouse move event.
	 */
	me.handleMouseWheel = function(evt) 
	{
		if (!me.opts.zoom) return;

		if (evt.preventDefault)
			evt.preventDefault();

		evt.returnValue = false;

		var svgDoc = evt.target.ownerDocument;

		var delta;

		if (evt.wheelDelta)
			delta = evt.wheelDelta / 3600; // Chrome/Safari
		else
			delta = evt.detail / -90; // Mozilla

        if (delta > 0) {
            if (me.opts.zoomThreshold) 
                if (me.opts.zoomThreshold[1] <= me.zoomCurrent) return;
            me.zoomCurrent++;
        } else {
            if (me.opts.zoomThreshold)
                if (me.opts.zoomThreshold[0] >= me.zoomCurrent) return;
            me.zoomCurrent--;
        }

		var z = 1 + delta; // Zoom factor: 0.9/1.1

		var g = svgDoc.getElementById("viewport"+me.id);
		
		var p = me.getEventPoint(evt);

		p = p.matrixTransform(g.getCTM().inverse());

		// Compute new scale matrix in current mouse position
		var k = me.root.createSVGMatrix().translate(p.x, p.y).scale(z).translate(-p.x, -p.y);
		me.setCTM(g, g.getCTM().multiply(k));

		if (!me.stateTf)
			me.stateTf = g.getCTM().inverse();

		me.stateTf = me.stateTf.multiply(k.inverse());
	};

	/**
	 * Handle mouse move event.
	 */
	me.handleMouseMove = function(evt) {
		// alert("move");
		if (evt.preventDefault)
			evt.preventDefault();

		evt.returnValue = false;

		var svgDoc = evt.target.ownerDocument;

		var g = svgDoc.getElementById("viewport"+me.id);

		if (me.state == 'pan') {
			// Pan mode
			if (!me.opts.pan) return;

			var p = me.getEventPoint(evt).matrixTransform(me.stateTf);

			me.setCTM(g, me.stateTf.inverse().translate(p.x - me.stateOrigin.x, p.y - me.stateOrigin.y));
		} else if (me.state == 'move') {
			// Move mode
			if (!me.opts.drag) return;

			var p = me.getEventPoint(evt).matrixTransform(g.getCTM().inverse());

			me.setCTM(me.stateTarget, me.root.createSVGMatrix().translate(p.x - me.stateOrigin.x, p.y - me.stateOrigin.y).multiply(g.getCTM().inverse()).multiply(me.stateTarget.getCTM()));

			me.stateOrigin = p;
		}
	};

	/**
	 * Handle click event.
	 */
	me.handleMouseDown = function(evt) {
		// alert(evt.target.tagName);
		
		if (evt.preventDefault)
			evt.preventDefault();

		evt.returnValue = false;

		var svgDoc = evt.target.ownerDocument;

		var g = svgDoc.getElementById("viewport"+me.id);
		
		// alert(g);

		if (evt.target.tagName == "svg" || !me.opts.drag) {
			// Pan mode
			if (!me.opts.pan) return;

			me.state = 'pan';

			me.stateTf = g.getCTM().inverse();

			me.stateOrigin = me.getEventPoint(evt).matrixTransform(me.stateTf);			
		} else {
			// Move mode
			if (!me.opts.drag || evt.target.draggable == false) return;

			me.state = 'move';

			me.stateTarget = evt.target;

			me.stateTf = g.getCTM().inverse();

			me.stateOrigin = me.getEventPoint(evt).matrixTransform(me.stateTf);
		}
	};

	/**
	 * Handle mouse button release event.
	 */
	me.handleMouseUp = function(evt) {
		if (evt.preventDefault)
			evt.preventDefault();

		evt.returnValue = false;

		var svgDoc = evt.target.ownerDocument;

		if ((me.state == 'pan' && me.opts.pan) || (me.state == 'move' && me.opts.drag)) {
			// Quit pan mode
			me.state = '';
		}
	};


    // end of constructor
  	me.setupHandlers(me.root);
	me.initialized = true;
};

Raphael.fn.ZPDPanTo = function(x, y) {
	var me = this;

	if (me.gelem.getCTM() == null) {
		alert('failed');
		return null;
	}
	
	alert("init");

	var stateTf = me.gelem.getCTM().inverse();

	var svg = document.getElementsByTagName("svg")[0];

	if (!svg.createSVGPoint) alert("no svg");        

	var p = svg.createSVGPoint();

	p.x = x; 
	p.y = y;

	p = p.matrixTransform(stateTf);

	var element = me.gelem;
	var matrix = stateTf.inverse().translate(p.x, p.y);

	var s = "matrix(" + matrix.a + "," + matrix.b + "," + matrix.c + "," + matrix.d + "," + matrix.e + "," + matrix.f + ")";

	element.setAttribute("transform", s);

	return me;   
};

