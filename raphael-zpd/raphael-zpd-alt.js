
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
		me.root.ongesturechange = me.handleGestureChange;


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

	me.handleGestureChange = function(evt) 
	{
		// event.scale
		// evt.scale
	
		if (!me.opts.zoom) return;

		if (evt.preventDefault)
			evt.preventDefault();

		evt.returnValue = false;

		var svgDoc = evt.target.ownerDocument;

		var delta;

		// if (evt.wheelDelta)
		// 	delta = evt.wheelDelta / 3600; // Chrome/Safari
		// else
		// 	delta = evt.detail / -90; // Mozilla

		delta = (evt.scale - 1)/20;

		// alert(evt.scale);

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
	
		// calculate center????
		var p = me.getEventPoint(me.touchA);

		p = p.matrixTransform(g.getCTM().inverse());
	
		// Compute new scale matrix in current mouse position
		var k = me.root.createSVGMatrix().translate(p.x, p.y).scale(z).translate(-p.x, -p.y);
		me.setCTM(g, g.getCTM().multiply(k));

		if (!me.stateTf)
			me.stateTf = g.getCTM().inverse();

		me.stateTf = me.stateTf.multiply(k.inverse());
	};


	me.handleTouchMove = function(evt) {
		// alert("move");
		if (evt.preventDefault)
			evt.preventDefault();

		evt.returnValue = false;

		var svgDoc = evt.target.ownerDocument;

		var g = svgDoc.getElementById("viewport"+me.id);

		if (me.state == 'pan') {
			// Pan mode
			if (!me.opts.pan) return;

			var p = me.getEventPoint(me.touchA).matrixTransform(me.stateTf);

			me.setCTM(g, me.stateTf.inverse().translate(p.x - me.stateOrigin.x, p.y - me.stateOrigin.y));
		} else if (me.state == 'move') {
			// Move mode
			if (!me.opts.drag) return;

			var p = me.getEventPoint(me.touchA).matrixTransform(g.getCTM().inverse());

			me.setCTM(me.stateTarget, me.root.createSVGMatrix().translate(p.x - me.stateOrigin.x, p.y - me.stateOrigin.y).multiply(g.getCTM().inverse()).multiply(me.stateTarget.getCTM()));

			me.stateOrigin = p;
		}
	};


	me.handleTouchStart = function(evt) {
		// alert(evt.target.tagName);
	
		me.touchA = evt.touches[0];
		me.touchB = evt.touches[1];
	
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

			me.stateOrigin = me.getEventPoint(me.touchA).matrixTransform(me.stateTf);			
		} else {
			// Move mode
			if (!me.opts.drag || evt.target.draggable == false) return;

			me.state = 'move';

			me.stateTarget = evt.target;

			me.stateTf = g.getCTM().inverse();

			me.stateOrigin = me.getEventPoint(me.touchA).matrixTransform(me.stateTf);
		}
	};


	me.handleTouchEnd = function(evt) {
		if (evt.preventDefault)
			evt.preventDefault();

		evt.returnValue = false;

		var svgDoc = evt.target.ownerDocument;

		if ((me.state == 'pan' && me.opts.pan) || (me.state == 'move' && me.opts.drag)) {
			// Quit pan mode
			me.state = '';
		}
	};

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

		// alert(delta);

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
	
		p.x -= 330;
		p.y -= 130;

		p = p.matrixTransform(g.getCTM().inverse());
		
		// console.log("inv x: " + p.x);
		// console.log("inv y: " + p.y);

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

