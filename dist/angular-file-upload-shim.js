/**!
 * AngularJS file upload shim for HTML5 FormData
 * @author  Danial  <danial.farid@gmail.com>
 * @version 1.2.8
 */
(function() {

if (window.XMLHttpRequest) {
	if (window.FormData) {
		// allow access to Angular XHR private field: https://github.com/angular/angular.js/issues/1934
		window.XMLHttpRequest = (function(origXHR) {
			return function() {
				var xhr = new origXHR();
				xhr.setRequestHeader = (function(orig) {
					return function(header, value) {
						if (header === '__setXHR_') {
							var val = value(xhr);
							// fix for angular < 1.2.0
							if (val instanceof Function) {
								val(xhr);
							}
						} else {
							orig.apply(xhr, arguments);
						}
					}
				})(xhr.setRequestHeader);
				return xhr;
			}
		})(window.XMLHttpRequest);
	} else {
		var hasFlash = false;
		try {
		  var fo = new ActiveXObject('ShockwaveFlash.ShockwaveFlash');
		  if (fo) hasFlash = true;
		} catch(e) {
		  if (navigator.mimeTypes["application/x-shockwave-flash"] != undefined) hasFlash = true;
		}
		window.XMLHttpRequest = (function(origXHR) {
			return function() {
				var xhr = new origXHR();
				var origSend = xhr.send;
				xhr.__requestHeaders = [];
				xhr.open = (function(orig) {
					if (!xhr.upload) xhr.upload = {};
					xhr.upload.addEventListener = function(t, fn, b) {
						if (t === 'progress') {
							xhr.__progress = fn;
						}
						if (t === 'load') {
							xhr.__load = fn;
						}
					};
					return function(m, url, b) {
						orig.apply(xhr, [m, url, b]);
						xhr.__url = url;
					}
				})(xhr.open);
				xhr.getResponseHeader = (function(orig) {
					return function(h) {
						return xhr.__fileApiXHR ? xhr.__fileApiXHR.getResponseHeader(h) : orig.apply(xhr, [h]); 
					}
				})(xhr.getResponseHeader);
				xhr.getAllResponseHeaders = (function(orig) {
					return function() {
						return xhr.__fileApiXHR ? xhr.__fileApiXHR.getAllResponseHeaders() : orig.apply(xhr); 
					}
				})(xhr.getAllResponseHeaders);
				xhr.abort = (function(orig) {
					return function() {
						return xhr.__fileApiXHR ? xhr.__fileApiXHR.abort() : (orig == null ? null : orig.apply(xhr)); 
					}
				})(xhr.abort);
				xhr.setRequestHeader = (function(orig) {
					return function(header, value) {
						if (header === '__setXHR_') {
							var val = value(xhr);
							// fix for angular < 1.2.0
							if (val instanceof Function) {
								val(xhr);
							}
						} else {
							orig.apply(xhr, arguments);
						}
					}
				})(xhr.setRequestHeader);
			
				xhr.send = function() {
					if (arguments[0] && arguments[0].__isShim) {
						var formData = arguments[0];
						var config = {
							url: xhr.__url,
							complete: function(err, fileApiXHR) {
								xhr.__load({type: 'load', loaded: xhr.__total, total: xhr.__total, target: xhr, lengthComputable: true});
								if (fileApiXHR.status !== undefined) Object.defineProperty(xhr, 'status', {get: function() {return fileApiXHR.status}});
								if (fileApiXHR.statusText !== undefined) Object.defineProperty(xhr, 'statusText', {get: function() {return fileApiXHR.statusText}});
								Object.defineProperty(xhr, 'readyState', {get: function() {return 4}});
								if (fileApiXHR.response !== undefined) Object.defineProperty(xhr, 'response', {get: function() {return fileApiXHR.response}});
								Object.defineProperty(xhr, 'responseText', {get: function() {return fileApiXHR.responseText}});
								xhr.__fileApiXHR = fileApiXHR;
								xhr.onreadystatechange();
							},
							progress: function(e) {
								e.target = xhr;
								xhr.__progress(e);
								xhr.__total = e.total;
							},
							headers: xhr.__requestHeaders
						}
						config.data = {};
						config.files = {}
						for (var i = 0; i < formData.data.length; i++) {
							var item = formData.data[i];
							if (item.val != null && item.val.name != null && item.val.size != null && item.val.type != null) {
								config.files[item.key] = item.val;
							} else {
								config.data[item.key] = item.val;
							}
						}
						
						setTimeout(function() {
							if (!hasFlash) {
								alert('Please install Adode Flash Player to upload files.');
							}
							xhr.__fileApiXHR = FileAPI.upload(config);
						}, 1);
					} else {
						origSend.apply(xhr, arguments);
					}
				}
				return xhr;
			}
		})(window.XMLHttpRequest);
		window.XMLHttpRequest.__hasFlash = hasFlash;
	}
	window.XMLHttpRequest.__isShim = true;
}

if (!window.FormData) {
	var wrapFileApi = function(elem) {
		if (!elem.__isWrapped && (elem.getAttribute('ng-file-select') != null || elem.getAttribute('data-ng-file-select') != null)) {
			var wrap = document.createElement('div');
			wrap.innerHTML = '<div class="js-fileapi-wrapper" /*style="position:relative; overflow:hidden"*/></div>';
			wrap = wrap.firstChild;
			var parent = elem.parentNode;
			parent.insertBefore(wrap, elem);
			parent.removeChild(elem);
			wrap.appendChild(elem);
			elem.__isWrapped = true;
		}
	};
	var changeFnWrapper = function(fn) {
		return function(evt) {
			var files = FileAPI.getFiles(evt);
			if (!evt.target) {
				evt.target = {};
			}
			evt.target.files = files;
			evt.target.files.item = function(i) {
				return evt.target.files[i] || null;
			}
			fn(evt);
		};
	};
	var isFileChange = function(elem, e) {
		return (e.toLowerCase() === 'change' || e.toLowerCase() === 'onchange') && elem.getAttribute('type') == 'file';
	}
	if (HTMLInputElement.prototype.addEventListener) {
		HTMLInputElement.prototype.addEventListener = (function(origAddEventListener) {
			return function(e, fn, b, d) {
				if (isFileChange(this, e)) {
					wrapFileApi(this);
					origAddEventListener.apply(this, [e, changeFnWrapper(fn), b, d]); 
				} else {
					origAddEventListener.apply(this, [e, fn, b, d]);
				}
			}
		})(HTMLInputElement.prototype.addEventListener);		
	}
	if (HTMLInputElement.prototype.attachEvent) {
		HTMLInputElement.prototype.attachEvent = (function(origAttachEvent) {
			return function(e, fn) {
				if (isFileChange(this, e)) {
					wrapFileApi(this);
					origAttachEvent.apply(this, [e, changeFnWrapper(fn)]); 
				} else {
					origAttachEvent.apply(this, [e, fn]);
				}
			}
		})(HTMLInputElement.prototype.attachEvent);
	}

	window.FormData = FormData = function() {
		return {
			append: function(key, val, name) {
				this.data.push({
					key: key,
					val: val,
					name: name
				});
			},
			data: [],
			__isShim: true
		};
	};
	
	(function () {
		//load FileAPI
		if (!window.FileAPI || !FileAPI.upload) {
			var base = '', script = document.createElement('script'), allScripts = document.getElementsByTagName('script'), i, index, src;
			if (window.FileAPI && window.FileAPI.jsPath) {
				base = window.FileAPI.jsPath;
			} else {
				for (i = 0; i < allScripts.length; i++) {
					src = allScripts[i].src;
					index = src.indexOf('angular-file-upload-shim.js')
					if (index == -1) {
						index = src.indexOf('angular-file-upload-shim.min.js');
					}
					if (index > -1) {
						base = src.substring(0, index);
						break;
					}
				}
			}

			if (!window.FileAPI || FileAPI.staticPath == null) {
				FileAPI = {
					staticPath: base
				}
			}
	
			script.setAttribute('src', base + "FileAPI.min.js");
			document.getElementsByTagName('head')[0].appendChild(script);
		}
	})();
}

/*
if (!window.FileReader) {
	window.FileReader = function() {
		var _this = this, loadStarted = false;
		this.listeners = {};
		this.addEventListener = function(type, fn) {
			_this.listeners[type] = _this.listeners[type] || []; 
			_this.listeners[type].push(fn);
		};
		this.removeEventListener = function(type, fn) {
			_this.listeners[type] && _this.listeners[type].splice(_this.listeners[type].indexOf(fn), 1);
		};
		this.dispatchEvent = function(evt) {
			var list = _this.listeners[evt.type];
			if (list) {
				for (var i = 0; i < list.length; i++) {
					list[i].call(_this, evt);
				}
			}
		};
		this.onabort = this.onerror = this.onload = this.onloadstart = this.onloadend = this.onprogress = null;
		
		function constructEvent(type, evt) {
			var e = {type: type, target: _this, loaded: evt.loaded, total: evt.total, error: evt.error};
			if (evt.result != null) e.target.result = evt.result;
			return e;
		};
		var listener = function(evt) {
			if (!loadStarted) {
				loadStarted = true;
				_this.onloadstart && this.onloadstart(constructEvent('loadstart', evt));
			}
			if (evt.type === 'load') {
				_this.onloadend && _this.onloadend(constructEvent('loadend', evt));
				var e = constructEvent('load', evt);
				_this.onload && _this.onload(e);
				_this.dispatchEvent(e);
			} else if (evt.type === 'progress') {
				var e = constructEvent('progress', evt);
				_this.onprogress && _this.onprogress(e);
				_this.dispatchEvent(e);
			} else {
				var e = constructEvent('error', evt);
				_this.onerror && _this.onerror(e);
				_this.dispatchEvent(e);
			}
		};
		this.readAsArrayBuffer = function(file) {
			FileAPI.readAsArrayBuffer(file, listener);
		}
		this.readAsBinaryString = function(file) {
			FileAPI.readAsBinaryString(file, listener);
		}
		this.readAsDataURL = function(file) {
			FileAPI.readAsDataURL(file, listener);
		}
		this.readAsText = function(file) {
			FileAPI.readAsText(file, listener);
		}
	}
}
*/
})();