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

(function () {
	"use strict";

	function run(angular) {
		function getFullReplacer(replacer) {
			return regExpFromString(getReplacementString(replacer));
		}

		var getReplacementString = function (replacer) {
			return "{" + replacer + "}";
		};

		function escapeRegExp(string) {
			return string.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
		}

		function regExpFromString(string, mode) {
			return new RegExp(escapeRegExp(string), mode);
		}

		function toReplacementObject(values) {
			var result = {};
			values.forEach(function (val) {
				var index = val.indexOf("=");

				result[val.substr(0, index)] = val.substr(index + 1, val.length);
			});

			return result;
		}

		function turnTagIntoElementArray(tag, i18nElements) {
			var attr, k, tags = [tag];
			for (attr in i18nElements) {
				if (i18nElements.hasOwnProperty(attr)) {
					for (k = 0; k < tags.length; k += 1) {
						if (typeof tags[k] === "string" && tags[k].indexOf(getReplacementString(attr)) > -1) {
							var result = tags[k].split(getReplacementString(attr));
							tags.splice(k, 1, result[0], i18nElements[attr], result[1]);
						}
					}
				}
			}

			return tags;
		}

		function invalidTranslation(value) {
			console.warn("Invalid Translation:" + value);
			return "Missing Translation: " + value;
		}

		var module = angular.module("localization", []);

		module.provider("localizationLoader", function () {
			var fallBackLanguage = "en-US";
			var location = "assets/js/i18n/l_";
			var availableLanguages = [];
			var loadedLanguage;

			var getLanguageUrl = function (language, trial) {
				return location + language + ".json";
			};

			var updateLanguageOnFail = function (language) {
				if (language.length > 2) {
					return language.substr(0, 2);
				}

				return fallBackLanguage;
			};

			var transformResponse = function (dict) {
				return dict;
			};

			var retryOnFail = function ($http, language, trial) {
				if (getLanguageUrl(language, trial + 1) !== getLanguageUrl(language, trial)) {
					return loadLanguage($http, language, trial + 1);
				}

				var otherLanguage = updateLanguageOnFail(language);
				if (otherLanguage !== language) {
					return loadLanguage($http, otherLanguage, 0);
				}

				throw new Error("no localization found!");
			};

			var loadLanguage = function ($http, language, trial) {
				language = language.toLowerCase();

				if (availableLanguages.length > 0 && availableLanguages.indexOf(language) === -1) {
					return retryOnFail($http, language, trial);
				}

				if (availableLanguages.indexOf(language) > -1) {
					loadedLanguage = language;
				}

				return $http.get(getLanguageUrl(language)).then(function (response) {
					return response.data;
				}).then(transformResponse).then(function (data) {
					loadedLanguage = language;
					return data;
				}).catch(retryOnFail.bind(null, $http, language, trial));
			};

			this.transformResponse = function (func) {
				transformResponse = func;
			};

			this.setFallBackLanguage = function (_fallBackLanguage) {
				fallBackLanguage = _fallBackLanguage;
			};

			this.setLocation = function (_location) {
				location = _location;
			};

			this.setGetLanguageUrlFunction = function (func) {
				getLanguageUrl = func;
			};

			this.setUpdateLanguageOnFailFunction = function (func) {
				updateLanguageOnFail = func;
			};

			this.setRetryOnFailFunction = function (func) {
				retryOnFail = func;
			};

			this.setLoadLanguage = function (func) {
				loadLanguage = func;
			};

			this.setAvailableLanguages = function (_availableLanguages) {
				availableLanguages = _availableLanguages;
			};

			this.$get = ["$http", function ($http) {
				return {
					load: function (baseLanguage) {
						return loadLanguage($http, baseLanguage, 0);
					},
					getLoadedLanguage: function () {
						return loadedLanguage;
					}
				};
			}];
		});

		// localization service responsible for retrieving resource files from the server and
		// managing the translation dictionary
		module.provider("localize", function () {
			var dictionary = {};
			var resourceFileLoaded = false;

			var language = window.navigator.userLanguage || window.navigator.language;
			this.setBaseLanguage = function (baseLanguage) {
				language = baseLanguage;
			};

			this.setLocales = function (_dictionary) {
				dictionary = _dictionary;
				resourceFileLoaded = true;
			};

			this.setReplacementString = function (func) {
				getReplacementString = func;
			};

			this.$get = ["localizationLoader", "$rootScope", "$window", function (localizationLoader, $rootScope) {
				// loads the language resource file from the server
				function initLocalizedResources() {
					resourceFileLoaded = false;

					localizationLoader.load(language).then(function (dict) {
						dictionary = dict;
						resourceFileLoaded = true;
						$rootScope.$broadcast("localizeResourcesUpdates");
					});
				}

				var localize = {
					getLanguage: function () {
						return localizationLoader.getLoadedLanguage() || language;
					},

					setLocales: function (_dictionary) {
						this.resourceFileLoaded = true;
						this.dictionary = _dictionary;
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

					parsePluralizationMatcher: function (pluralMatcher) {
						var pluralPart = pluralMatcher.split(".."), min, max;

						if (pluralPart.length === 1) {
							min = parseInt(pluralPart[0], 10);
							max = min;
						} else if (pluralPart.length === 2) {
							min = parseInt(pluralPart[0], 10);
							max = parseInt(pluralPart[1], 10);
						}

						if (isNaN(min) && isNaN(max)) {
							return false;
						}

						if (isNaN(min)) {
							min = -Infinity;
						}

						if (isNaN(max)) {
							max = Infinity;
						}

						return { min: min, max: max };
					},

					matchesPluralization: function (pluralMatcher, count) {
						var parsed = localize.parsePluralizationMatcher(pluralMatcher);
						return parsed && parsed.min <= count && parsed.max >= count;
					},

					tryPluralization: function (tag, count) {
						var key, countInt;
						countInt = parseInt(count, 10);
						if (isNaN(countInt)) {
							return tag;
						}

						var plurals = dictionary.plurals;
						for (key in plurals) {
							if (plurals.hasOwnProperty(key) && localize.matchesPluralization(key, count)) {
								return tag[plurals[key]];
							}
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
							return previousValue;
						}, dictionary);

						if (typeof tag === "object") {
							tag = localize.tryPluralization(tag, replacements.count);
						}

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

				if (!resourceFileLoaded) {
					// force the load of the resource file
					initLocalizedResources();
				}

				// return the local instance when called
				return localize;
			}];
		});

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
					var tag = localize.getLocalizedString(key, toReplacementObject(values));
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
	}

	if (typeof define === "function") {
		define(["angular"], function (angular) {
			run(angular);
		});
	} else {
		run(angular);
	}
})();
