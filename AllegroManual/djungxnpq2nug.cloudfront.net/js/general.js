/*
	Copyright 2005-10 by Matthew Leverton
	
	For use only on http://www.allegro.cc
*/

var resizers = [];
var _codeBoxes = [];

/* Prototypes */
var Observable = 
{
	observers: {},
	
	observe: function(eventName, callback)
	{
		if (!this.observers[eventName]) this.observers[eventName] = [];
		this.observers[eventName].push(callback);
	},
	
	notify: function(eventName, e)
	{
		if (!this.observers[eventName]) return;
		this.observers[eventName].each(function(observer)
		{
			observer(e);
		});
	}
};

Array.prototype.column = function (i)
{
	return this.collect(function(r) { return r[i]});
};

Object.extend(Number.prototype,
{
	msize: function()
	{
		if (this < 1024)
			return this + " bytes";
		else if (this < 1048576)
			return (this / 1024).round() + "KB";
		else if (this < 1073741824)
			return (this / 1048576).round(2) + "MB";
		else
			return (this / 1073741824).round(2) + "GB";
	},
	
	formatSeconds: function()
	{
		if (this < 60)
			return this + " sec" + (this != 1 ? "s" : "");
		else if (this < 3600)
		{
			var m = (this / 60).round();
			var s = (this % 60);
			return m + " min" + (m != 1 ? "s" : "") + " and " + s + " sec" + (s != 1 ? "s" : "");
		}
		else
			return "a long time";
	}
});

String.prototype.trim = function() { return this.replace(/^\s+|\s+$/g, ''); };
String.prototype.rtrim = function() { return this.replace(/\s+$/g, ''); };

/* legacy onload */
var doc = {
	add_onLoad: function(func)
	{
		document.observe("dom:loaded", func);
		if ((typeof console != 'undefined') && console.log)
			console.log("Notice: change 'add_DOM_onLoad(foo)' and 'doc.add_onLoad(foo)' to 'document.observe(\"dom:loaded\", foo)' in your custom JS file.");
	}
};
var add_DOM_onLoad = doc.add_onLoad;

/* Tool Tips */
var toolTip = 
{
	initialized: false, disabled: false,
	timer: 0, delay: 1000, div: 0, object: 0,
	X: -1, Y: -1, xOffset: 12, yOffset: 0,
	stack: [], stackLen: 0,
	rpcCache: {},
	
	FETCH_RPC: 1, FETCH_CALLBACK: 2,
	
	init: function()
	{
		if (this.disabled) return;
		
		this.body_onMouseMoveDelegate = this.body_onMouseMove.bindAsEventListener(this);
		document.body.observe('mousemove', this.body_onMouseMoveDelegate);
		this.initialized = true;
	},
	
	shutdown: function(forever)
	{
		document.body.stopObserving('mousemove', this.body_onMouseMoveDelegate);
		
		this.initialized = false;
		if (!forever)
		{
			this.stack = {};
			this.rpcCache = {};
		}
		else
		{
			this.stack = this.rpcCache = null;
			this.disabled = true;
		}
	},
	
	body_onMouseMove: function(event)
	{
		if (this.timer) window.clearTimeout(this.timer);
		if (this.div) this.clear();
		
		this.object = event.element();
		
		this.X = event.pointerX();
		this.Y = event.pointerY();
		this.timer = window.setTimeout(this.timer_onComplete.bind(this), this.delay);
	},
	
	clear: function()
	{
		if (this.div)
		{
			this.div.parentNode.removeChild(this.div);
			this.div = 0;
		}
	},
	
	timer_onComplete: function()
	{
		var o = this.object;
		
		var len = this.stack.length;
		outside: while (o)
		{
			for (var i=0; i<len; ++i)
			{
				if (o == this.stack[i].node) break outside;
			}
			o = o.parentNode;
		}
		
		if (o)
		{
			this.href = document.location.href;
			
			switch (this.stack[i].fetchMode)
			{
				case this.FETCH_CALLBACK:
				{
					this.displayPopup(this.stack[i].callback(o));
				}
				break;
				
				case this.FETCH_RPC:
				{
					var url = this.stack[i].callback(o);
					if (this.rpcCache[url])
						this.displayPopup(this.rpcCache[url]);
					else
					{
						new Ajax.Request(url,
						{
							method: 'get',
							onSuccess: function(transport)
							{
								this.rpcCache[url] = transport.responseText;
								this.displayPopup(transport.responseText);
							}.bind(this)
						});
					}
				}
			}
		}
	},
	
	displayPopup: function(html)
	{
		if (this.href != document.location.href) return;
		
		this.clear();
		
		/* opera displays its own tooltip above the custom one. Loading a remote image causes it to disappear */
		if (/Opera/.test(navigator.userAgent))
			html += "<img style='visibility: hidden; width: 0; height: 0;' src='/null/fake-opera-image/" + Math.random() + "' />";
		
		this.div = new Element("div", {style: "position: absolute; top: 0; left: 0; visibility: hidden;", className: "drop-shadow"});
		
		var divWrap = new Element("div", {className: "wrap"});
		
		var divContent = new Element("div", {className: "tool-tip"});

		divContent.innerHTML = html;
		
		divWrap.appendChild(divContent);
		this.div.appendChild(divWrap);
					
		document.body.appendChild(this.div);
		
		this.X = Number(this.X) + this.xOffset;
		this.Y = Number(this.Y) + this.yOffset;
		
		var sw = window.innerWidth;
		this.div.style.left = (sw < Number(this.div.offsetWidth) + Number(this.X)) ? (sw - this.div.offsetWidth) + "px" : this.div.style.left = this.X + "px";
			
		var sh = 10000000; //document.body.offsetHeight - 8;
		this.div.style.top = (sh < Number(this.div.offsetHeight) + Number(this.Y)) ? (sh - this.div.offsetHeight) + "px" : this.div.style.top = this.Y + "px";
		
		this.div.style.visibility = "visible";
	},
	
	add: function(node, callback, fetchMode)
	{
		if (this.initialized) this.stack.push({node: node, callback: callback, fetchMode: fetchMode });
	}
};

/* Image Roll Overs */
function img_onRollOver(event)
{
	var o = event.element();
	o.src = o.src.replace('-off.', '-on.');
};

function img_onRollOut(event)
{
	var o = event.element();
	o.src = o.src.replace('-on.', '-off.');
};

function flashBg(e, color, stop)
{
	var e = $(e);
	var prev = e.style.backgroundColor;
	e.style.backgroundColor = color;
	
	if (!stop) flashBg.delay(1, e, prev, true);
};

var CodeBox = Class.create(
{
	initialize: function(d)
	{		
		// d.style.width = (d.up().offsetWidth) + "px";
		// resizers.push({element: d, widthFactor: 1.0});
		this.container = d;
		this.gutterVisible = false;
		this.expanded = false;
		this.firstLineNumber = 1;		
		this.toolbar = d.down("div.toolbar");
		this.expandButton = this.toolbar.down(".button.expand");
		this.toggleNumberButton = this.toolbar.down(".button.numbers");
			
		var spanNumber = d.down("span.number");
		if (!spanNumber) return;

		this.toggleNumberButton.addClassName("enabled");
		this.gutterVisible = true;
		this.firstLineNumber = parseInt(spanNumber.getInnerText());		
		this.attachToolbarEvents(this.toolbar);
	},
	
	attachToolbarEvents: function(toolbar)
	{
		toolbar = $(toolbar);
		toolbar.down("span.numbers").observe("click", this.toggleNumberButton_onClick.bindAsEventListener(this));
		toolbar.down("span.select").observe("click", this.selectButton_onClick.bindAsEventListener(this));
		toolbar.down("span.expand").observe("click", this.expandButton_onClick.bindAsEventListener(this));		
	},
	
	hideGutter: function()
	{	
		if (!this.gutterVisible) return;
		
		this.container.select("span.numbers").invoke('removeClassName', 'enabled');
		this.gutterVisible = false;
		
		this.numberedSource = this.container.down("div.inner").cloneNode(true);
				
		this.container.select("span.number").invoke("remove");
	},
	
	showGutter: function()
	{
		if (this.gutterVisible) return;
		
		var inner = this.container.down("div.inner");
		var top = inner.scrollTop;
		inner.parentNode.replaceChild(this.numberedSource, inner);
		this.numberedSource = null;		
		this.container.down("div.inner").scrollTop = top;		
		this.container.select("span.numbers").invoke('addClassName', 'enabled');
		this.gutterVisible = true;
	},
	
	toggleNumberButton_onClick: function(event)
	{
		this.gutterVisible ? this.hideGutter() : this.showGutter();
	},
	
	selectButton_onClick: function(event)
	{
		this.hideGutter();
		this.container.down("div.inner").selectText();
	},
		
	expandButton_onClick: function(event)
	{
		this.expandButton.toggleClassName("enabled");

		var inner = this.container.down("div.inner");			
		if (this.expandButton.hasClassName("enabled"))
		{			
			var bottomToolbar = this.toolbar.cloneNode(true);
			bottomToolbar.setStyle({borderTop: "none", borderBottom: "solid #999 1px"});
			this.container.appendChild(bottomToolbar);
			this.attachToolbarEvents(bottomToolbar);
			inner.addClassName("fullsize");
		}
		else
		{
			var scroll = (event.element().up("div.toolbar") == this.container.lastChild);
			$(this.container.lastChild).remove();
			inner.removeClassName("fullsize");				
			if (scroll)
			{
				scrollTo(0, this.container.cumulativeOffset().top - 50);
			}
		}
	}
	
});


var MediaPlayer =
{
	onActivate: function(event)
	{
		var e = event.element();
		if (e.hasClassName("media-player")) return;
		e = e.up(".media-player");				
		var url = e.down("a");
		if (!url) return;		
		url = url.href;
		
		if (e.hasClassName("audio"))
		{
			var objectHTML = '<object type="application/x-shockwave-flash" data="/widget/audio-player/player.swf" width="290" height="24">' +
				'<param name="movie" value="/widget/audio-player/player.swf" />' +
				'<param name="FlashVars" value="autostart=yes&amp;playerID=1&amp;bg=0xf8f8f8&amp;leftbg=0xeeeeee&amp;lefticon=0x666666&amp;rightbg=0xcccccc&amp;rightbghover=0x999999&amp;righticon=0x666666&amp;righticonhover=0xffffff&amp;text=0x666666&amp;slider=0x666666&amp;track=0xFFFFFF&amp;border=0x666666&amp;loader=0x9FFFB8&amp;soundFile=' + escape(url) + '" />' +
				'<param name="quality" value="high" />' +
				'<param name="menu" value="false" />' +
				'<param name="autostart" value="yes" />' +
				'<param name="bgcolor" value="#f7f7f7" />' +
				'<param name="wmode" value="opaque" />' +
				'</object>';
				
			e.innerHTML = objectHTML;
		}
		else if (e.hasClassName("vimeo"))
		{
			var video_id = /vimeo.com\/(\d+)/.exec(url)[1];
			var video_src = "//www.vimeo.com/" + video_id + "&hl=en&fs=1&autoplay=1";
			
			
			var object = new Element("object", {width: "480", height: "300"});
			object.appendChild(new Element("param", {name: "movie", value: '//vimeo.com/moogaloop.swf?clip_id=' + video_id + '&amp;server=vimeo.com&amp;show_title=1&amp;show_byline=1&amp;show_portrait=1&amp;color=&amp;fullscreen=1&amp;autoplay=0&amp;loop=0'}));

			object.appendChild(new Element("param", {name: "allowFullScreen", value: "true"}));
			object.appendChild(new Element("param", {name: "allowscriptaccess", value: "always"}));
			object.appendChild(new Element("param", {name: "wmode", value: "opaque"}));
			
			object.appendChild(new Element("embed",
			{
				src: '//vimeo.com/moogaloop.swf?clip_id=' + video_id + '&amp;server=vimeo.com&amp;show_title=1&amp;show_byline=1&amp;show_portrait=1&amp;color=&amp;fullscreen=1&amp;autoplay=0&amp;loop=0',
				type: "application/x-shockwave-flash",
				allowfullscreen: "true",
				allowscriptaccess: "always",
				width: "480",
				height: "300",
				wmode: "opaque"
			}));
			e.innerHTML = "";
			e.appendChild(object);
		}
		else if (e.hasClassName("youtube"))
		{
			var video_id = /\?v=(.+)/.exec(url)[1];
			var video_src = "//www.youtube.com/v/" + video_id + "&hl=en&fs=1&autoplay=1";
			
			var object = new Element("object", {width: "480", height: "300"});
			object.appendChild(new Element("param", {name: "movie", value: video_src}));
			object.appendChild(new Element("param", {name: "allowFullScreen", value: "true"}));
			object.appendChild(new Element("param", {name: "allowscriptaccess", value: "always"}));
			object.appendChild(new Element("param", {name: "wmode", value: "opaque"}));
			
try {
			object.appendChild(new Element("embed",
			{
				src: video_src,
				type: "application/x-shockwave-flash",
				allowscriptaccess: "always",
				allowfullscreen: "true",
				width: "480",
				height: "300",
				wmode: "opaque"
			}));
} catch (exc) { }
			e.innerHTML = "";
			e.appendChild(object);
		}
		event.stop();
	}
};

/* Run Once Functions */
function attachGlobalEvents(baseNode)
{
	if (!baseNode) baseNode = $(document.body);
	
	baseNode.select("img[src*='-off.']").each(function(img)
	{
		img.observe('mouseover', img_onRollOver.bindAsEventListener());
		img.observe('mouseout', img_onRollOut.bindAsEventListener());
		new Element('img', {src: img.src.replace("-off", "-on")});
	});
	
	var reg = new RegExp("^([A-Za-z0-9]+):\/\/([A-Za-z0-9-\.]+)(\/.*)?$");
	baseNode.select("div.mockup.v2 a").each(function(a)
	{
		var url = reg.exec(a.href);
		if (!url || a.up("pre") || a.up(".source-code")) return;
		
		var innerText = a.getInnerText();
		var m;
		
		if (url[2] != "wiki.allegro.cc" && url[2] != location.host && a.href.substr(0, innerText.length) != innerText)
		{
			if (userSettings.external_links == "NEW")
			{		
				if (url[2] != location.host)
				{
					a.target = "_blank";
				}
			}
			
			if (userSettings.show_url_flag)
			{
				var lastChild = a;
				while (lastChild.lastChild) lastChild = lastChild.lastChild;
				if (lastChild && lastChild.nodeType == 3)
				{
					var span = new Element('span', {className: 'url'}).update(" [" + url[2] + "]");
					a.parentNode.insertBefore(span, a.nextSibling);
				}
			}
		}
		else if ((m = /\/forums\/thread\/(\d+)\/(\d+)/.exec(a.href)))
		{
			var p = $('post-' + m[2]);
			if (p)
			{
				var tmp = p.down('a');
				if (!tmp.name) tmp.name = "post-" + m[2];
				a.href = "#" + tmp.name;
			}
		}
	});
	
	baseNode.select("div.mockup.v2").each(function(div)
	{
		var refCount = 0;
		
		var idNode = div;
		while (idNode && !idNode.id) idNode = idNode.parentNode;
		
		var id = idNode ? idNode.id : 'mockup';
		
		var refBlock = div.select('div.ref-block ol')[0];
		if (!refBlock) return;
				
		div.select('span.ref a').each(function(ref)
		{
			ref.observe('click', function(event)
			{
				var i = ref.innerHTML - 1;
				var li = refBlock.select('li')[i];
				
				if (li.style.backgroundColor == '') flashBg(li, '#ffa');
				
				refBlock.up().scrollTo();
				
				
				event.stop();
			});
			refCount++;
		});
	});
	
	baseNode.select("span.remote-thumbnail").each(function(s) 
	{
			/*	

		var tn = new Element('img');
		tn.src = "/images/img-zoom.png";
		tn.setStyle({
			border: "0",
			position: "absolute",
			right: "4px",
			bottom: "4px",			
			opacity: "0.25"
		});
		s.style.position = "relative";
		s.appendChild(tn);
		s.observe('mouseover', function(event)
		{
			var me = event.element();
			if (!me.hasClassName('remote-thumbnail'))
				me = me.up('span.remote-thumbnail');
				
			me.select("img")[1].style.opacity = "1.0";
		});
		
		s.observe('mouseout', function(event)
		{
			var me = event.element();
			if (!me.hasClassName('remote-thumbnail'))
				me = me.up('span.remote-thumbnail');
				
			me.select("img")[1].style.opacity = "0.25";
		});*/
		
		s.observe('click', function(event)
		{
			var me = event.element();
			
			if (!me.hasClassName('remote-thumbnail'))
				me = me.up('span.remote-thumbnail');
				
			if (event.ctrlKey)
			{
				var link = me.up('a');
				if (link)
				{
					window.open(link.href, "_blank");
					event.stop();
					return false;
				}
			}
			
			var info = me.select("span")[0];
			var img = me.select("img")[0];
			// var imgZoom = me.select("img")[1];
			var imgLarge = me.select("img")[1];
			
			if (!info.hasClassName('json'))
			{
				info = info.innerHTML.split(";");
				var matches = /^(.*?)(.thumb)?.(jpg|png|gif)$/.exec(img.src);
				
				if (event.shiftKey)
				{					
					window.open(matches[1] + "." + info[0], "thumbnail", "width=" + (Number(info[1])+32) + ",height=" + (Number(info[2])+32));
				}
				else
				{
					if (matches[2])
					{
						img.src = matches[1] + "." + info[0];
						img.width = info[1];
						img.height = info[2];
						img.title = "Click to go back to thumbnail.";
					}
					else
					{
						img.src = matches[1] + ".thumb.jpg";
						img.width = info[3];
						img.height = info[4];
						img.title = "Click to enlarge. (" + info[1] + "x" + info[2] +"). Shift-Click for new window.";
					}
				}
			}
			else
			{
				var info = eval("(" + info.getInnerText() + ")");
				
				if (event.shiftKey)
				{
					window.open(info.src, "thumbnail", "scrollbars=yes,resizable=yes,width=" + (Number(info.w)+40) + ",height=" + (Number(info.h)+40));
				}
				else if (!imgLarge || imgLarge.style.display == 'none')
				{
					if (!imgLarge)
					{
						imgLarge = new Element("img");
						imgLarge.title = img.title;
						if (info.w <= 1024)
						{
							imgLarge.src = info.src;
							imgLarge.width = info.w;
							imgLarge.height = info.h;
						}
						else
						{
							imgLarge.src = info.tn + "-1024.jpg";
							imgLarge.width = "1024";
							imgLarge.height = parseInt(info.h / (info.w / 1024));
						}
				
						img.parentNode.appendChild(imgLarge);
					}
						
					imgLarge.style.display = "inline";
					img.style.display = "none";
					//imgZoom.style.display = "none";
				}
				else
				{
					img.style.display = "inline";
					//imgZoom.style.display = "inline";
					imgLarge.style.display = "none";
				}
			}
			

			event.stop();
			return false;
		});
	});
	
	baseNode.select("div.spoiler").each(function(d)
	{
		var div = new Element('div');
		var btn = new Element('input', {type: "button", value: 'Reveal Spoiler...', className: "spoiler"});
		div.appendChild(btn);
		d.parentNode.insertBefore(div, d);
		btn.observe('click', function(event)
		{
			if (d.style.display != "block")
			{
				btn.value = "Hide Spoiler";
				d.style.display = "block";
			}
			else
			{
				btn.value = "Reveal Spoiler...";
				d.style.display = "none";
			}			
			event.stop();
			return false;
		});
	});
	
	baseNode.select("div.mockup.v2 div.source-code").each(function(d)
	{
		if (d.down("div.toolbar"))
		{
			var cb = new CodeBox(d);
			_codeBoxes.push(cb);
		}
	});
	
	baseNode.select(".media-player").invoke('observe', 'click', MediaPlayer.onActivate.bindAsEventListener(MediaPlayer));
	
	baseNode.select("span.math").each(function(s)
	{
		var s2 = s.down();
		var latex = s2.innerHTML;
		s.title = latex;
		s.setStyle({cursor: "pointer" });
		s.observe("click", function()
		{
			prompt("The following code can be used to recreate the formula:", "<math>" + latex + "</math>");
		});
		s2.update("&lt;math&gt;" + latex + "&lt;/math&gt;");
	});
	var reManual = new RegExp("/manual/([a-zA-Z0-9_]+)$");
	
	var funcManualURL = function(a)
	{
		return "/dhtml/manual-tooltip.rpc/" + reManual.exec(a.href)[1];
	};
	
	var reMember = new RegExp("/members/((id/([0-9]+))|([^/]+)$)");
	var funcMemberURL = function(a)
	{
		var m = reMember.exec(a.href);
		return "/dhtml/member-tooltip.rpc/" + (m[4] ? m[4] : m[3]);
	};
	
	$$("a").each(function(a)
	{
		if (reManual.test(a.href))
			toolTip.add(a, funcManualURL, toolTip.FETCH_RPC);
		else if (reMember.test(a.href)) 
			toolTip.add(a, funcMemberURL, toolTip.FETCH_RPC);
	});
};


/*
var SlideShow = Class.create(
{
	initialize: function(div)
		{
		this.div = div;
		
		this.screenMomentum = 0;
		
	 	this.screen = div.childElements()[0];
	 	this.thumbnails = div.childElements()[1];
	 	this.div.style.width = "750px";
	 	this.div.style.height = "700px";
	 	// div.style.border = "solid black 1px";
	  	
	 	this.screen.style.width = "750px";
	 	this.screen.style.height = "600px";
	 	this.screen.style.overflow = "hidden";  	  	
	  	
	 	this.thumbnails.style.overflow = "hidden";  	  	
	 	this.thumbnails.style.width = "750px";
	 	this.thumbnails.style.height = "100px";
	 	this.thumbnails.scrollLeft = 0;
	 	
	 	var table = new Element('table');
	 	var tbody = new Element('tbody');
	 	var tr = new Element('tr');
	 	var td = new Element('td');
	 	td.style.backgroundColor = "black";
	 	td.innerHTML = "<div style='width: 800px;'>&nbsp;</div>";
	 	tr.appendChild(td);
	 	this.thumbnails.select("img").each(function(img, i) {
	 		var id = /([a-f0-9]{32})/.exec(img.src)[1];
	 		var foo = new Element("img");
	  	foo.src = "/images/rcache/" + id[0] + "/" + id[1] + "/" + id;
	  	foo.height = "600";
	  	foo.style.opacity = i == 0 ? "1" : "0.25";
	  	
	  	var td = new Element('td');
	  	td.style.backgroundColor = "black";
	  	td.appendChild(foo);
	  	tr.appendChild(td);
	 	});
	 	tbody.appendChild(tr);
	 	table.appendChild(tbody);
	 	
	 	this.screen.appendChild(table);
	 	
	 	this.thumbnails.select("img").invoke('observe', 'click', this.thumbnail_onClick.bindAsEventListener(this));
	 }
});

SlideShow.addMethods(
{
	scrollScreen: function(x)
	{
		this.screenMomentum = 8;
		this.screenDestination = parseInt(x);
		this.scrollScreenStep();
	},
	
	scrollScreenStep: function()
	{
		var dx = parseInt(this.screenMomentum);
		if (this.screen.scrollLeft < this.screenDestination)
		{
			this.screen.scrollLeft += dx;
			
			if (this.screen.scrollLeft > this.screenDestination)
				this.screen.scrollLeft = this.screenDestination;
		}
		else if (this.screen.scrollLeft > this.screenDestination)
		{
			this.screen.scrollLeft -= dx;
			
			if (this.screen.scrollLeft < this.screenDestination)
				this.screen.scrollLeft = this.screenDestination;
		}
		
		this.screenMomentum *= 1.5;
		
		if (this.screen.scrollLeft != this.screenDestination)
			this.scrollScreenStep.bind(this).delay(0.005);
	},
	
	thumbnail_onClick: function(event)
	{
		var img = event.element();
		this.thumbnails.select('img').each(function(img2, i)
		{
			var td = this.screen.select('td')[i+1];
			
			if (img == img2)
			{
				this.scrollScreen(td.offsetLeft - (802 - td.offsetWidth) / 2);
				td.select('img')[0].style.opacity = "1";
			}
			else
			{
				td.select('img')[0].style.opacity = "0.25";
			}
		}, this);
	}
});

document.observe("dom:loaded", function() {
  $$('div.slideshow').each( function(div)
  {
  	new SlideShow(div);
  });
});
*/

/*
Event.add(window, 'unload', function()
{
	toolTip.shutdown(true);
//	if (typeof mockupBoxes == 'object') for (var i in mockupBoxes) alert(mockupBoxes[i]); // mockupBoxes[i].shutdown();
	Delegate.destroyAll();
}, false);
*/

var resizeWait = false;

Event.observe(document.onresize ? document : window, 'resize', function()
{
	if (resizeWait) return;
	
	// IE hangs on this
	var m;
	if ((m = /MSIE (\d+)/i.exec(navigator.userAgent)) && m[1] < 7) return;
	
	for (var i=0; i<resizers.length; ++i)
	{
		if (resizers[i].widthFactor)
		{
			resizers[i].element.style.width = "1px";
		}
	}

	resizeWait = true;
	foosize.defer();	
});

function foosize()
{
	for (var i=0; i<resizers.length; ++i)
	{
		if (resizers[i].widthFactor)
		{
			resizers[i].element.style.width = (resizers[i].element.up().offsetWidth * resizers[i].widthFactor) + "px";
		}
	}	
	
	resetResizeWait.delay(0.5);
};


function resetResizeWait()
{
	resizeWait = false;
};

Element.addMethods(
{
	getInnerText: function(element)
	{
		element = $(element);
		return element.textContent || element.innerText || '';
	},
	
	selectText: function(element)
	{
		element = $(element);
		if (window.getSelection)
		{
			var sel = window.getSelection();
			
			if (sel.setBaseAndExtent)
			{
				// Safari
				sel.setBaseAndExtent(element.firstChild, 0, element.lastChild, 0);
			}
			else
			{
				// Opera / Mozilla
				var range = document.createRange();
				range.selectNodeContents(element);
				sel.addRange(range);
			}
		}
		else if (document.selection)
		{
			// IE
			var range = document.body.createTextRange();
			range.moveToElementText(element);
			range.select();
		}
	}
});

/* Uploader */
var Uploader = Class.create(
{
	id: null,
	publicData: {},
	nextUploadIndex: 0,
	files: [],
	observers: {},
	uploading: false,
	
	initialize: function(id)
	{
		this.id = id;		
		
		var d = $(id.replace("uploader", "upload-button"));
		
		if (typeof File == 'undefined')
		{
			d.setStyle({fontSize: "80%"});
			d.parentNode.removeChild(d);
			return;
		}
		
		if ((typeof FileReader != 'undefined') && ('draggable' in document.createElement('span')))
		{	
			d.setAttribute("draggable", true);
			
			d.setStyle({position: "relative", overflow: "hidden"});
			d.innerHTML = "Drop Attachments Here";
			
			d.observe('dragover', function(event) {
				this.notify('rollOver');
				event.stop();
			}.bind(this));
			
			d.observe('dragleave', function(event) {
				this.notify('rollOut');
			}.bind(this));
			
			d.observe('drop', this.onFileDrop.bind(this));
		}
		
		var fileInput = new Element("input",
		{
			id: $(id.replace("uploader", "file-input")),
			multiple: "multiple",
			style: "opacity: 0; position: absolute; top: 0; left: 0px; width: 500px; height: 32px; background: transparent; border: none;",
			type: 'file'
		});
		d.appendChild(fileInput);
		
		fileInput.observe('change', function(event)
		{
			this.onFileDrop({
				dataTransfer: {files: fileInput.files},
				stop: function () {}
			});
		}.bind(this));	
		
		this.nextUploadID = 0;

	},
	
	set: function(key, val)
	{
		this.publicData[key] = val;
	},
	
	get: function(key)
	{
		return this.publicData[key];
	},
	
	onFileDrop: function(event)
	{   
		var notifyData = {
			uploader: this,
			files: []
		};
				
    var data = event.dataTransfer;

    var dashdash = '--';
    var crlf     = '\r\n';

    /* For each dropped file. */
    for (var i = 0; i < data.files.length; i++)
    {
    	  var file = data.files[i];
        var f = {
					id: this.nextUploadID++,
					uploadId: parseInt(Math.random() * 1000000),
					name: file.name || file.fileName,
					size: file.size || file.fileSize,
					file: file
				};

				notifyData.files.push(f);
				this.files.push(f);			
    }

    this.notify('fileSelect', notifyData);
    
		event.stop();
	},
	
	onuploadProgress: function(e)
	{
		var data =
		{
			uploader: this,
			id: e.id,
			bytesLoaded: e.bytesLoaded,
			bytesTotal: e.bytesTotal
		};
		
		this.notify('uploadProgress', data);
	},
	
	onuploadCompleteData: function(e)
	{
		this.uploading = false;
		
		var resp = e.data.split("\n");
		
		var data =
		{
			uploader: this,
			id: e.id,
			error: resp[0] != "0",
			uploadId: (resp[0] == "0" ? resp[1] : null),
			attachmentId: (resp[0] == "0" ? resp[2] : null)			
		};
		
		this.notify('uploadComplete', data);
	},
	
	onrollOut: function(e)
	{
		this.notify('rollOut');
	},
	
	onrollOver: function(e)
	{
		this.notify('rollOver');
	},
	
	upload: function()
	{
		if (this.nextUploadIndex >= this.files.length || this.uploading)
		{
			return false;
		}
		
		
		var id = this.nextUploadIndex;	    
		var f = this.files[id];

		var xhr = new XMLHttpRequest();
		
		if (xhr.upload) // XXX
		xhr.upload.onprogress = function(event) {
			var e = {
    		id: id,
				bytesLoaded: event.loaded,
				bytesTotal: event.total
			};
			
			this.onuploadProgress(e);				
    }.bind(this);
    
    xhr.onload = function(event) { 
      this.onuploadCompleteData(
      {
    		id: id,
    		data: xhr.responseText
    	});
    }.bind(this);		
   
    xhr.open("POST", "/upload.php?UPLOAD_IDENTIFIER=" + f.uploadId, true);
    // xhr.setRequestHeader("Content-Type", "multipart/form-data");
    
		xhr.setRequestHeader("X-File-Name", f.file.name || f.file.fileName);
		xhr.setRequestHeader("X-File-Size", f.file.size || f.file.fileSize);
		xhr.setRequestHeader("X-File-Type", f.file.type);
    xhr.send(f.file);
    
		this.nextUploadIndex++;
		this.uploading = true;
		return true;
	},
	
	observe: function(eventName, callback)
	{
		if (!this.observers[eventName]) this.observers[eventName] = [];
		this.observers[eventName].push(callback);
	},
	
	notify: function(eventName, e)
	{
		if (!this.observers[eventName]) return;
		this.observers[eventName].each(function(observer)
		{
			observer(e);
		});
	},
	
	position: function()
	{
	},
	
	setAllowMultipleFiles: function()
	{
	}
});

Uploader.uploaders = [];
Uploader.pending = [];

Uploader.eventHandler = function(id, e)
{
	var uploader = Uploader.get(id);
	if (!uploader) return;
	
	if (uploader['on' + e.type])
	{
		uploader['on' + e.type](e);
	}
};

var m = /Firefox\/(\d+)\.(\d+)/.exec(navigator.userAgent);
Uploader.HTML5 = (m && parseInt(m[1]) * 100 + parseInt(m[2]) >= 306);
m = null;

Uploader.insertHTML = function(id)
{
	Uploader.pending.push(id);
};

Uploader.get = function(id)
{
	var uploader = null;
	
	Uploader.uploaders.each(function(u)
	{
		if (u.id == id)
		{
			uploader = u;
		}
	});
	
	return uploader;
};

document.observe("dom:loaded", function()
{
	if (!document.body) document.body = $$("body")[0];
	Element.extend(document.body);
	toolTip.init();
	attachGlobalEvents();
	
	Uploader.pending.each(function(id)
	{
		var d = $(id.replace("uploader", "upload-button"));
		if (d)
		{
			Uploader.uploaders.push( new Uploader(id) );					
		}
	});	
});

