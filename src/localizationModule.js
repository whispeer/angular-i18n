/*
The MIT License

Copyright (c) 2012-2013 Coding Smackdown TV, http://codingsmackdown.tv
Changes by Nils Kenneweg (2014-2015), http://whispeer.com
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
Enjoy!
*/

/*
* An AngularJS Localization Service
*
* Written by Jim Lavin
* http://codingsmackdown.tv
* Changes by Nils Kenneweg, http://whispeer.com
*/

define(["angular"], function (angular) {
	"use strict";

	function getFullReplacer(replacer) {
		return regExpFromString("{" + replacer + "}");
	}

	function escapeRegExp(string) {
		return string.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
	}

	function regExpFromString(string, mode) {
		return new RegExp(escapeRegExp(string), mode);
	}

	function toReplacementObject(values) {
		var result = {};
		values.forEach(function (val) {
			var keyVal = val.split("=");
			if (keyVal.length !== 2) {
				return;
			}
			result[keyVal.shift()] = keyVal.shift();
		});

		return result;
	}

	function turnTagIntoElementArray(tag, i18nElements) {
		var attr, k, tags = [tag];
		for (attr in i18nElements) {
			if (i18nElements.hasOwnProperty(attr)) {
				for (k = 0; k < tags.length; k += 1) {
					if (typeof tags[k] === "string" && tags[k].indexOf("{" + attr + "}") > -1) {
						var result = tags[k].split("{" + attr + "}");
						tags.splice(k, 1, result[0], i18nElements[attr], result[1]);
					}
				}
			}
		}

		return tags;
	}

	function invalidTranslation(value) {
		console.warn("Invalid Translation:" + value);
		return "";
	}

	var module = angular.module("localization", []);
		// localization service responsible for retrieving resource files from the server and
		// managing the translation dictionary
	module.factory("localize", ["$http", "$rootScope", "$window", function ($http, $rootScope, $window) {
		var language = $window.navigator.userLanguage || $window.navigator.language;
		var dictionary = {};
		var resourceFileLoaded = false;

		function successCallback(data) {
			// store the returned array in the dictionary
			dictionary = data;
			// set the flag that the resource are loaded
			resourceFileLoaded = true;
			// broadcast that the file has been loaded
			$rootScope.$broadcast("localizeResourcesUpdates");
		}

		function loadDefault() {
			// the request failed set the url to the default resource file
			var url = "assets/js/i18n/l_en-US.json";
			// request the default resource file
			$http({ method: "GET", url: url, cache: false }).success(successCallback);
		}

		// loads the language resource file from the server
		function initLocalizedResources() {
			resourceFileLoaded = false;

			// build the url to retrieve the localized resource file
			var url = "assets/js/i18n/l_" + language + ".json";
			// request the resource file
			$http({ method: "GET", url: url, cache: false }).success(successCallback).error(function () {
				if (language.length === 2) {
					loadDefault();
				} else {
					// the request failed set the url to a different url
					var url = "assets/js/i18n/l_" + language.substr(0, 2) + ".json";

					$http({ method: "GET", url: url, cache: false }).success(successCallback).error(loadDefault);
				}
			});
		}

		var localize = {
			getLanguage: function () {
				return language;
			},

			// allows setting of language on the fly
			setLanguage: function (value) {
				if (typeof value !== "string") {
					console.error("language should be a string!");
					return;
				}

				if (language !== value) {
					language = value;
					initLocalizedResources();
				}
			},

			// checks the dictionary for a localized resource string
			getLocalizedString: function (value, replacements) {
				if (!resourceFileLoaded) {
					return "";
				}

				var tag = value.split(".").reduce(function (previousValue, attr) {
					if (previousValue[attr]) {
						return previousValue[attr];
					}
				}, dictionary);

				if (typeof tag === "undefined" || typeof tag === "object") {
					return invalidTranslation(value);
				}

				if (replacements) {
					var element;
					for (element in replacements) {
						if (replacements.hasOwnProperty(element)) {
							tag = tag.replace(getFullReplacer(element), replacements[element]);
						}
					}
				}

				return tag;
			}
		};

		// force the load of the resource file
		initLocalizedResources();

		// return the local instance when called
		return localize;
	} ]);

	// simple translation filter
	// usage {{ TOKEN | i18n }}
	module.filter("i18n", ["localize", function (localize) {
		return function (input) {
			return localize.getLocalizedString(input);
		};
	}]);

	module.filter("l", ["localize", function (localize) {
		return function (input) {
			return localize.getLocalizedString(input);
		};
	}]);

	// translation directive that can handle dynamic strings
	// updates the text value of the attached element
	// usage <span data-i18n="TOKEN" ></span>
	// or
	// <span data-i18n="TOKEN|VALUE1|VALUE2" ></span>
	module.directive("i18n", ["localize", "$compile", function (localize, $compile) {
		var i18nDirective = {
			restrict: "EAC",
			updateText: function (scope, elm, token, i18nElements) {
				var values = token.split("|");

				i18nElements = i18nElements || [];

				// construct the tag to insert into the element
				var tag = localize.getLocalizedString(values.shift(), toReplacementObject(values));
				// update the element only if data was returned
				if (!tag) {
					return;
				}

				elm.html("");

				var tags = turnTagIntoElementArray(tag, i18nElements);

				tags.forEach(function (cur) {
					if (typeof cur === "string") {
						elm.append(document.createTextNode(cur));
					} else {
						cur.forEach(function (element) {
							elm.append(element.clone());
						});
					}
				});

				$compile(elm.contents())(scope);
			},

			compile: function (elm) {
				var elements = {};

				var children = elm.children();
				var k, child, attr;

				//get the html of all children
				for (k = 0; k < children.length; k += 1) {
					child = jQuery(children[k]);

					attr = child.attr("data-for");

					elements[attr] = elements[attr] || [];
					elements[attr].push(child);
				}

				elm.html("");

				return function (scope, elm, attrs) {
					scope.$on("localizeResourcesUpdates", function () {
						i18nDirective.updateText(scope, elm, attrs.i18n, elements);
					});

					attrs.$observe("i18n", function () {
						i18nDirective.updateText(scope, elm, attrs.i18n, elements);
					});
				};
			},
		};

		return i18nDirective;
	}]);

	// translation directive that can handle dynamic strings
	// updates the attribute value of the attached element
	// usage <span data-i18n-attr="TOKEN|ATTRIBUTE" ></span>
	// or
	// <span data-i18n-attr="TOKEN|ATTRIBUTE|VALUE1|VALUE2" ></span>
	module.directive("i18nAttr", ["localize", function (localize) {
		var i18nAttrDirective = {
			restrict: "EAC",
			updateText: function (elm, token) {
				var values = token.split("|"), key = values.shift(), attr = values.shift();
				// construct the tag to insert into the element
				var tag = localize.getLocalizedString(key, toReplacementObject(values)), index, toSet;
				// update the element only if data was returned
				if (!tag) {
					return;
				}

				// insert the text into the atribute
				elm.attr(attr, tag);
			},
			link: function (scope, elm, attrs) {
				scope.$on("localizeResourcesUpdates", function () {
					i18nAttrDirective.updateText(elm, attrs.i18nAttr);
				});

				attrs.$observe("i18nAttr", function (value) {
					i18nAttrDirective.updateText(elm, value);
				});
			}
		};

		return i18nAttrDirective;
	}]);
});