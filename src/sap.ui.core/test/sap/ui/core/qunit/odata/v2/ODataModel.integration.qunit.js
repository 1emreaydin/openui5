/*!
 * ${copyright}
 */
sap.ui.define([
	"sap/base/Log",
	"sap/base/util/uid",
	"sap/ui/Device",
	"sap/ui/base/SyncPromise",
	"sap/ui/core/mvc/Controller",
	"sap/ui/core/mvc/View",
	"sap/ui/model/odata/CountMode",
	"sap/ui/model/odata/v2/ODataModel",
	"sap/ui/test/TestUtils",
	'sap/ui/thirdparty/datajs',
	'sap/ui/util/XMLHelper'
	// load Table resources upfront to avoid loading times > 1 second for the first test using Table
	// "sap/ui/table/Table"
], function (Log, uid, Device, SyncPromise, Controller, View, CountMode, ODataModel, TestUtils,
		datajs, XMLHelper) {
	/*global QUnit*/
	"use strict";

	var sDefaultLanguage = sap.ui.getCore().getConfiguration().getLanguage(),
		sSalesOrderService = "/sap/opu/odata/IWBEP/GWSAMPLE_BASIC/";

	/**
	 * Creates a V2 OData model.
	 *
	 * @param {string} sServiceUrl The service URL
	 * @param {object} [mModelParameters] Map of parameters for model construction
	 *   {@link sap.ui.model.odata.v2.ODataModel#constructor}. The standard ODataModel behavior will
	 *   be overwritten by the following default test parameters:
	 * @param {sap.ui.model.odata.CountMode} [mModelParameters.defaultCountMode=None] Starting
	 *   $count request are disabled
	 * @param {boolean} [mModelParameters.useBatch=false] Requests are handled as single requests
	 * @returns {sap.ui.model.odata.v2.ODataModel} The model
	 */
	function createModel(sServiceUrl, mModelParameters) {
		var mDefaultParameters = {
				defaultCountMode : CountMode.None,
				serviceUrl : sServiceUrl,
				useBatch : false
			};

		return new ODataModel(Object.assign(mDefaultParameters, mModelParameters));
	}

	/**
	 * Creates a V2 OData model for <code>GWSAMPLE_BASIC</code>.
	 *
	 * @param {object} [mModelParameters] Map of parameters for model construction. The default
	 *   parameters are set in the createModel function.
	 * @returns {ODataModel} The model
	 */
	function createSalesOrdersModel(mModelParameters) {
		return createModel(sSalesOrderService, mModelParameters);
	}

	/**
	 * Wraps the given XML string into a <View> and creates an XML document for it. Verifies that
	 * the sap.m.Table does not use <items>, because this is the default aggregation and may be
	 * omitted. (This ensures that <ColumnListItem> is a direct child.)
	 *
	 * If the binding uses <ColumnListItem>, <columns> is not allowed. The columns are automatically
	 * determined from the number of the elements in <ColumnListItem>.
	 *
	 * @param {string} sViewXML The view content as XML string
	 * @returns {Document} The view as XML document
	 */
	function xml(sViewXML) {
		var oChildNode, aChildNodes, iColumnCount, aColumnNodes, oColumnsElement, oDocument,
			oElement, bHasColumns, i, j, k, aTableElements;

		oDocument = XMLHelper.parse(
			'<mvc:View xmlns="sap.m" xmlns:mvc="sap.ui.core.mvc" xmlns:t="sap.ui.table">'
			+ sViewXML
			+ '</mvc:View>',
			"application/xml"
		);
		aTableElements = oDocument.getElementsByTagNameNS("sap.m", "Table");
		iColumnCount = 0;
		for (i = aTableElements.length - 1; i >= 0; i -= 1) {
			oElement = aTableElements[i];

			aChildNodes = oElement.childNodes;
			for (j = aChildNodes.length - 1; j >= 0; j -= 1) {
				oChildNode = aChildNodes[j];
				switch (oChildNode.nodeName) {
					case "columns":
						bHasColumns = true;
						break;
					case "items":
						throw new Error("Do not use <items> in sap.m.Table");
					case "ColumnListItem":
						aColumnNodes = oChildNode.childNodes;

						for (k = aColumnNodes.length - 1; k >= 0; k -= 1) {
							if (aColumnNodes[k].nodeType === 1) { // Node.ELEMENT_NODE
								iColumnCount += 1;
							}
						}
						break;
					// no default
				}
			}
			if (iColumnCount) {
				if (bHasColumns) {
					throw new Error("Do not use <columns> in sap.m.Table");
				}
				oColumnsElement = oDocument.createElementNS("sap.m", "columns");
				while (iColumnCount > 0) {
					oColumnsElement.appendChild(oDocument.createElementNS("sap.m", "Column"));
					iColumnCount -= 1;
				}
				oElement.appendChild(oColumnsElement);
			}
		}

		return oDocument;
	}

	//*********************************************************************************************
	QUnit.module("sap.ui.model.odata.v2.ODataModel.integration", {
		beforeEach : function () {
			// We use a formatter to check for property changes. However before the formatter is
			// called, the value is passed through the type's formatValue
			// (see PropertyBinding#_toExternalValue). Ensure that this result is predictable.
			sap.ui.getCore().getConfiguration().setLanguage("en-US");

			// These metadata files are _always_ faked, the query option "realOData" is ignored
			TestUtils.useFakeServer(this._oSandbox, "sap/ui/core/qunit", {
				"/sap/opu/odata/IWBEP/GWSAMPLE_BASIC/$metadata"
					: {source : "model/GWSAMPLE_BASIC.metadata.xml"},
				"/sap/opu/odata/IWBEP/GWSAMPLE_BASIC/annotations.xml"
					: {source : "model/GWSAMPLE_BASIC.annotations.xml"}
			});
			this.oLogMock = this.mock(Log);
			this.oLogMock.expects("warning").never();
			this.oLogMock.expects("error").never();
			this.oLogMock.expects("fatal").never();

			// {map<string, string[]>}
			// this.mChanges["id"] is a list of expected changes for the property "text" of the
			// control with ID "id"
			this.mChanges = {};
			// {map<string, true>}
			// If an ID is in this.mIgnoredChanges, change events with null are ignored
			this.mIgnoredChanges = {};
			// {map<string, string[][]>}
			// this.mListChanges["id"][i] is a list of expected changes for the property "text" of
			// the control with ID "id" in row i
			this.mListChanges = {};
			// A list of expected messages
			this.aMessages = [];
			// The number of pending responses checkFinish has to wait for
			this.iPendingResponses = 0;
			// A list of expected requests with the properties method, url, headers, response
			this.aRequests = [];

			// If the "VisibleRowCountMode" of the sap.ui.table.* is "Auto", the table uses the
			// screen height (Device.resize.height) to compute the amount of contexts it requests
			// initially. Make sure that this is stable across devices.
			this._oSandbox.stub(Device.resize, "height").value(1000);
		},

		afterEach : function (assert) {
			if (this.oView) {
				// avoid calls to formatters by UI5 localization changes in later tests
				this.oView.destroy();
			}
			if (this.oModel) {
				this.oModel.destroy();
			}
			// reset the language
			sap.ui.getCore().getConfiguration().setLanguage(sDefaultLanguage);
		},

		/**
		 * Checks the messages and finishes the test if no pending changes are left, all
		 * expected requests have been received and the expected number of messages have been
		 * reported.
		 *
		 * @param {object} assert The QUnit assert object
		 */
		checkFinish : function (assert) {
			var sControlId, aExpectedValuesPerRow, i;

			if (this.aRequests.length || this.iPendingResponses) {
				return;
			}
			for (sControlId in this.mChanges) {
				if (!this.hasOnlyOptionalChanges(sControlId)) {
					if (this.mChanges[sControlId].length) {
						return;
					}
					delete this.mChanges[sControlId];
				}
			}
			for (sControlId in this.mListChanges) {
				// Note: This may be a sparse array
				aExpectedValuesPerRow = this.mListChanges[sControlId];
				for (i in aExpectedValuesPerRow) {
					if (aExpectedValuesPerRow[i].length) {
						return;
					}
					delete aExpectedValuesPerRow[i];
				}
				delete this.mListChanges[sControlId];
			}
			if (sap.ui.getCore().getUIDirty()
					|| sap.ui.getCore().getMessageManager().getMessageModel().getObject("/").length
						< this.aMessages.length) {
				setTimeout(this.checkFinish.bind(this, assert), 10);

				return;
			}
			if (this.resolve) {
				this.resolve();
				this.resolve = null;
			}
		},

		/**
		 * Checks that the given value is the expected one for the control.
		 *
		 * @param {object} assert The QUnit assert object
		 * @param {string} sValue The value
		 * @param {string} sControlId The control ID
		 * @param {number|string} [vRow] The row index in case the control's binding is below a
		 *   list binding or the path of the row's context (for example in the tests of the
		 *   ODataMetaModel), otherwise <code>undefined</code>.
		 */
		checkValue : function (assert, sValue, sControlId, vRow) {
			var sExpectedValue,
				iRow = (typeof vRow === "string")
					? vRow.slice(vRow.indexOf("(@") + 2, vRow.indexOf("~)"))
					: vRow,
				aExpectedValues = (iRow === undefined)
					? this.mChanges[sControlId]
					: this.mListChanges[sControlId] && this.mListChanges[sControlId][iRow],
				sVisibleId = iRow === undefined ? sControlId : sControlId + "[" + iRow + "]";

			if (!aExpectedValues || !aExpectedValues.length) {
				if (!(sControlId in this.mIgnoredChanges && sValue === null)) {
					assert.ok(false, sVisibleId + ": " + JSON.stringify(sValue) + " (unexpected)");
				}
			} else {
				sExpectedValue = aExpectedValues.shift();
				// Note: avoid bad performance of assert.strictEqual(), e.g. DOM manipulation
				if (sValue !== sExpectedValue || iRow === undefined || typeof iRow !== "number"
						|| iRow < 10) {
					assert.strictEqual(sValue, sExpectedValue,
						sVisibleId + ": " + JSON.stringify(sValue));
				}
			}
			this.checkFinish(assert);
		},

		/**
		 * Searches the incoming request in the list of expected requests by comparing the URL.
		 * Removes the found request from the list.
		 *
		 * @param {object} oActualRequest The actual request
		 * @returns {object} The matching expected request or undefined if none was found
		 */
		consumeExpectedRequest : function (oActualRequest) {
			var oExpectedRequest, i;

			if (this.aRequests.length === 1) {
				return this.aRequests.shift(); // consume the one and only candidate to get a diff
			}
			for (i = 0; i < this.aRequests.length; i += 1) {
				oExpectedRequest = this.aRequests[i];
				if (oExpectedRequest.url === oActualRequest.url) {
					this.aRequests.splice(i, 1);
					return oExpectedRequest;
				}
			}
		},

		/**
		 * Creates the view and attaches it to the model. Checks that the expected requests (see
		 * {@link #expectRequest} are fired and the controls got the expected changes (see
		 * {@link #expectChange}).
		 *
		 * @param {object} assert The QUnit assert object
		 * @param {string} sViewXML The view content as XML
		 * @param {sap.ui.model.odata.v2.ODataModel} [oModel] The model; it is attached to the view
		 *   and to the test instance.
		 *   If no model is given, <code>createSalesOrdersModel</code> is used.
		 * @param {object} [oController]
		 *   An object defining the methods and properties of the controller
		 * @returns {Promise} A promise that is resolved when the view is created and all expected
		 *   values for controls have been set
		 */
		createView : function (assert, sViewXML, oModel, oController) {
			var that = this;

			/**
			 * Stub function for datajs#request. Decides if a request should be executed as single
			 * request or batch request.
			 *
			 * @param {object} oRequest The request object
			 * @param {function} fnSuccess Success callback function
			 * @param {function} fnError Error callback function
			 * @param {object} oHandler The request handler object
			 * @param {object} oHttpClient The HttpClient object
			 * @param {object} oMetadata The metadata object
			 */
			function checkRequest(oRequest, fnSuccess, fnError, oHandler, oHttpClient, oMetadata) {
				if (oRequest.requestUri.includes("$batch")) {
					checkBatchRequest(oRequest, fnSuccess, fnError);
				} else {
					checkSingleRequest(oRequest, fnSuccess, fnError);
				}
			}

			/*
			 * Checks that all requests in a batch are as expected and handles its response.
			 */
			function checkBatchRequest(oRequest, fnSuccess, fnError) {
				/**
				 * Helper function to pass through the return of checkSingleRequest
				 * @param {object} oData An application-specific payload object
				 * @param {object} oResponse The response value of a proceeded single request
				 * @returns {object} The response value of a proceeded single request
				 */
				function fnCallbackHelper(oData, oResponse) {
					return oResponse;
				}

				/**
				 * Processes a request within a batch
				 * @param {object} oRequest The request
				 * @returns {object} The processed response object of datajs#request
				 */
				function processRequest(oRequest) {
					// TODO: correct error handling
					return checkSingleRequest(oRequest, fnCallbackHelper, fnCallbackHelper);
				}

				/**
				 * @param {object} oRequest A batch request object that contains an array of
				 *   requests
				 * @returns {object} The executed success handler of datajs#request
				 */
				function processRequests(oRequest) {
					var aRequests = oRequest.data.__batchRequests;

					return Promise.all(
						aRequests.map(processRequest)
					).then(function (aResponses) {
						// TODO: correct error handling
						var oBatchResponse = {
							data : {
								__batchResponses : aResponses
							}
						};

						return fnSuccess(oBatchResponse.data, oBatchResponse);
					});
				}

				return processRequests(oRequest);
			}

			/*
			 * Checks that the expected request arrived and handles its response. This is used
			 * individual for single requests or as reused part of batch requests.
			 */
			function checkSingleRequest(oActualRequest, fnSuccess, fnError, oHandler, oHttpClient,
					oMetadata) {
				var oExpectedRequest = that.consumeExpectedRequest(oActualRequest),
					mHeaders = oActualRequest.headers,
					sMethod = oActualRequest.method,
					oResponse,
					sUrl = oActualRequest.requestUri,
					bWaitForResponse = true;

				function checkFinish() {
					if (!that.aRequests.length && !that.iPendingResponses) {
						// give some time to process the response
						setTimeout(that.checkFinish.bind(that, assert), 0);
					}
				}

				function _getResponseMetadata(sRequestUri, iIndex) {
					sRequestUri = sRequestUri.split("?")[0];

					return {
						uri : (iIndex === undefined)
							? sRequestUri
							: sRequestUri + "(@" + iIndex + "~)"
					};
				}

				delete mHeaders["Accept"];
				delete mHeaders["Accept-Language"];
				delete mHeaders["Content-Type"];
				delete mHeaders["DataServiceVersion"];
				delete mHeaders["MaxDataServiceVersion"];
				delete mHeaders["sap-cancel-on-close"];
				delete mHeaders["sap-contextid-accept"];
				delete oActualRequest["_handle"];
				delete oActualRequest["async"];
				delete oActualRequest["deepPath"];
				delete oActualRequest["deferred"];
				delete oActualRequest["eventInfo"];
				delete oActualRequest["password"];
				delete oActualRequest["requestID"];
				delete oActualRequest["user"];
				if (oExpectedRequest) {
					oResponse = {
						data : oExpectedRequest.response,
						statusCode : 200
					};

					// oResponse needs __metadata for ODataModel.prototype._getKey
					if (oResponse.data && Array.isArray(oResponse.data.results)) {
						oResponse.data.results.forEach(function (oResponseItem, i) {
							oResponseItem.__metadata = _getResponseMetadata(
								oExpectedRequest.requestUri, i);
						});
					} else {
						oResponse.data.__metadata = _getResponseMetadata(
							oExpectedRequest.requestUri);
					}

					if (sUrl.startsWith(that.oModel.sServiceUrl)) {
						oActualRequest.requestUri = sUrl.slice(that.oModel.sServiceUrl.length + 1);
					}
					bWaitForResponse = !(oResponse && typeof oResponse.then === "function");
					delete oExpectedRequest.response;
					delete oExpectedRequest.responseHeaders;
					assert.deepEqual(oActualRequest, oExpectedRequest, sMethod + " " + sUrl);
				} else {
					assert.ok(false, sMethod + " " + sUrl + " (unexpected)");
					oResponse = {value : []}; // dummy response to avoid further errors
				}

				if (bWaitForResponse) {
					that.iPendingResponses += 1;
				} else {
					checkFinish();
				}

				return Promise.resolve(oResponse).then(function (oResponseBody) {
					if (oResponseBody instanceof Error) {
						// TODO: correct error handling
						oResponseBody.requestUrl = that.oModel.sServiceUrl + sUrl;
						throw oResponseBody;
					}

					return fnSuccess({}, oResponseBody);
				}).finally(function () {
					if (bWaitForResponse) {
						that.iPendingResponses -= 1;
					}
					// Waiting may be over after the promise has been handled
					checkFinish();
				});
			}

			this.oModel = oModel || createSalesOrdersModel();
			this.mock(datajs).expects("request").atLeast(0).callsFake(checkRequest);
			//assert.ok(true, sViewXML); // uncomment to see XML in output, in case of parse issues

			return View.create({
				type : "XML",
				controller : oController && new (Controller.extend(uid(), oController))(),
				definition : xml(sViewXML)
			}).then(function (oView) {
				Object.keys(that.mChanges).forEach(function (sControlId) {
					var oControl = oView.byId(sControlId);

					if (oControl) {
						that.setFormatter(assert, oControl, sControlId);
					}
				});
				Object.keys(that.mListChanges).forEach(function (sControlId) {
					var oControl = oView.byId(sControlId);

					if (oControl) {
						that.setFormatter(assert, oControl, sControlId, true);
					}
				});

				oView.setModel(that.oModel);
				// enable parse error messages in the message manager
				sap.ui.getCore().getMessageManager().registerObject(oView, true);
				// Place the view in the page so that it is actually rendered. In some situations,
				// esp. for the table.Table this is essential.
				oView.placeAt("qunit-fixture");
				that.oView = oView;

				return that.waitForChanges(assert);
			});
		},

		/**
		 * The following code (either {@link #createView} or anything before
		 * {@link #waitForChanges}) is expected to set a value (or multiple values) at the property
		 * "text" of the control with the given ID. <code>vValue</code> must be a list with expected
		 * values for each row if the control is created via a template in a list.
		 *
		 * You must call the function before {@link #createView}, even if you do not expect a change
		 * to the control's value initially. This is necessary because createView must attach a
		 * formatter function to the binding info before the bindings are created in order to see
		 * the change. If you do not expect a value initially, leave out the vValue parameter.
		 *
		 * Examples:
		 * this.expectChange("foo", "bar"); // expect value "bar" for the control with ID "foo"
		 * this.expectChange("foo"); // listen to changes for the control with ID "foo", but do not
		 *                           // expect a change (in createView)
		 * this.expectChange("foo", false); // listen to changes for the control with ID "foo", but
		 *                                 // do not expect a change (in createView). To be used if
		 *                                 // the control is a template within a table.
		 * this.expectChange("foo", ["a", "b"]); // expect values for two rows of the control with
		 *                                       // ID "foo"; may be combined with an offset vRow
		 * this.expectChange("foo", ["a",,"b"]); // expect values for the rows 0 and 2 of the
		 *                                       // control with the ID "foo", because this is a
		 *                                       // sparse array in which index 1 is unset
		 * this.expectChange("foo", "c", 2); // expect value "c" for control with ID "foo" in row 2
		 * this.expectChange("foo", "d", "/MyEntitySet/ID");
		 *                                 // expect value "d" for control with ID "foo" in a
		 *                                 // metamodel table on "/MyEntitySet/ID"
		 * this.expectChange("foo", "bar").expectChange("foo", "baz"); // expect 2 changes for "foo"
		 * this.expectChange("foo", null, null); // table.Table sets the binding context on an
		 *                                       // existing row to null when scrolling
		 * this.expectChange("foo", null); // row is deleted in table.Table so that its context is
		 *                                 // destroyed
		 *
		 * @param {string} sControlId The control ID
		 * @param {string|string[]|boolean} [vValue] The expected value, a list of expected values
		 *   or <code>false</code> to enforce listening to a template control.
		 * @param {number|string} [vRow] The row index (for the model) or the path of its parent
		 *   context (for the metamodel), in case that a change is expected for a single row of a
		 *   list (in this case <code>vValue</code> must be a string).
		 * @returns {object} The test instance for chaining
		 */
		expectChange : function (sControlId, vValue, vRow) {
			var aExpectations, i;

			// Ensures that oObject[vProperty] is an array and returns it
			function array(oObject, vProperty) {
				oObject[vProperty] = oObject[vProperty] || [];

				return oObject[vProperty];
			}

			if (arguments.length === 3) {
				aExpectations = array(this.mListChanges, sControlId);
				if (Array.isArray(vValue)) {
					for (i = 0; i < vValue.length; i += 1) {
						if (i in vValue) {
							// This may create a sparse array this.mListChanges[sControlId]
							array(aExpectations, vRow + i).push(vValue[i]);
						}
					}
				} else {
					// This may create a sparse array this.mListChanges[sControlId]
					array(aExpectations, vRow).push(vValue);
				}
			} else if (Array.isArray(vValue)) {
				aExpectations = array(this.mListChanges, sControlId);
				for (i = 0; i < vValue.length; i += 1) {
					if (i in vValue) {
						array(aExpectations, i).push(vValue[i]);
					}
				}
			} else if (vValue === false) {
				array(this.mListChanges, sControlId);
			} else {
				aExpectations = array(this.mChanges, sControlId);
				if (arguments.length > 1) {
					aExpectations.push(vValue);
				}
			}

			return this;
		},

		/**
		 * The following code (either {@link #createView} or anything before
		 * {@link #waitForChanges}) is expected to perform a <code>HEAD<code> request.
		 *
		 * @returns {object} The test instance for chaining
		 */
		expectHeadRequest : function () {
			this.aRequests.push({
				headers : {
					"x-csrf-token" : "Fetch"
				},
				method : "HEAD",
				requestUri : ""
			});

			return this;
		},

		/**
		 * The following code (either {@link #createView} or anything before
		 * {@link #waitForChanges}) is expected to perform the given request. <code>oResponse</code>
		 * describes how to react on the request. Usually you simply give the JSON for the response
		 * and the request will be responded in the next microtask.
		 *
		 * <code>oResponse</code> may also be a promise resolving with the response or the error. In
		 * this case you can control the response time (typically to control the order of the
		 * responses).
		 *
		 * @param {string|object} vRequest The request with the properties "method", "url" and
		 *   "headers". A string is interpreted as URL with method "GET". Spaces inside the URL are
		 *   percent-encoded automatically.
		 * @param {object|Promise|Error} [oResponse] The response message to be returned from the
		 *   requestor or a promise on it
		 * @param {object} [mResponseHeaders] The response headers to be returned from the
		 *   requestor
		 * @returns {object} The test instance for chaining
		 */
		expectRequest : function (vRequest, oResponse, mResponseHeaders) {
			if (typeof vRequest === "string") {
				vRequest = {
					method : "GET",
					requestUri : vRequest
				};
			}
			// ensure that these properties are defined (required for deepEqual)
			vRequest.headers = vRequest.headers || {};
			vRequest.responseHeaders = mResponseHeaders || {};
			vRequest.response = oResponse || {/*null object pattern*/};
			vRequest.requestUri = vRequest.requestUri.replace(/ /g, "%20");
			this.aRequests.push(vRequest);

			return this;
		},

		/**
		 * Returns whether expected changes for the control are only optional null values.
		 *
		 * @param {string} sControlId The control ID
		 * @returns {boolean} Whether expected changes for the control are only optional null values
		 */
		hasOnlyOptionalChanges : function (sControlId) {
			return this.bNullOptional &&
				this.mChanges[sControlId].every(function (vValue) {
					return vValue === null;
				});
		},

		/**
		 * Sets the formatter function which calls {@link #checkValue} for the given control.
		 * Note that you may only use controls that have a 'text' or a 'value' property.
		 *
		 * @param {object} assert The QUnit assert object
		 * @param {sap.ui.base.ManagedObject} oControl The control
		 * @param {string} sControlId The (symbolic) control ID for which changes are expected
		 * @param {boolean} [bInList] Whether the control resides in a list item
		 */
		setFormatter : function (assert, oControl, sControlId, bInList) {
			var oBindingInfo = oControl.getBindingInfo("text") || oControl.getBindingInfo("value"),
				fnOriginalFormatter = oBindingInfo.formatter,
				oType = oBindingInfo.type,
				bIsCompositeType = oType && oType.getMetadata().isA("sap.ui.model.CompositeType"),
				that = this;

			oBindingInfo.formatter = function (sValue) {
				var oContext = bInList && this.getBindingContext();

				if (fnOriginalFormatter) {
					sValue = fnOriginalFormatter.apply(this, arguments);
				} else if (bIsCompositeType) {
					// composite type at binding with type and no original formatter: call the
					// type's formatValue, as CompositeBinding#getExternalValue calls only the
					// formatter if it is set
					sValue = oType.formatValue.call(oType, Array.prototype.slice.call(arguments),
						"string");
				}
				// CompositeType#formatValue is called each time a part changes; we expect null if
				// not all parts are set as it is the case for sap.ui.model.odata.type.Unit.
				// Only check the value once all parts are available.
				if (!bIsCompositeType || sValue !== null) {
					that.checkValue(assert, sValue, sControlId,
						oContext && (oContext.getBinding
							? oContext.getBinding() && oContext.getIndex()
							: oContext.getPath()
						)
					);
				}

				return sValue;
			};
		},

		/**
		 * Waits for the expected requests and changes.
		 *
		 * @param {object} assert The QUnit assert object
		 * @param {boolean} [bNullOptional] Whether a non-list change to a null value is optional
		 * @param {number} [iTimeout=3000] The timeout time in milliseconds
		 * @returns {Promise} A promise that is resolved when all requests have been responded and
		 *   all expected values for controls have been set
		 */
		waitForChanges : function (assert, bNullOptional, iTimeout) {
			var oPromise,
				that = this;

			oPromise = new SyncPromise(function (resolve) {
				that.resolve = resolve;
				that.bNullOptional = bNullOptional;
				// After three seconds everything should have run through
				// Resolve to have the missing requests and changes reported
				setTimeout(function () {
					if (oPromise.isPending()) {
						assert.ok(false, "Timeout in waitForChanges");
						resolve();
					}
				}, iTimeout || 3000);
				that.checkFinish(assert);
			}).then(function () {
				var sControlId, aExpectedValuesPerRow, i, j;

				// Report missing requests
				that.aRequests.forEach(function (oRequest) {
					assert.ok(false, oRequest.method + " " + oRequest.requestUri
						+ " (not requested)");
				});
				// Report missing changes
				for (sControlId in that.mChanges) {
					if (that.hasOnlyOptionalChanges(sControlId)) {
						delete that.mChanges[sControlId];
						continue;
					}
					for (i in that.mChanges[sControlId]) {
						assert.ok(false, sControlId + ": "
							+ JSON.stringify(that.mChanges[sControlId][i]) + " (not set)");
					}
				}
				for (sControlId in that.mListChanges) {
					// Note: This may be a sparse array
					aExpectedValuesPerRow = that.mListChanges[sControlId];
					for (i in aExpectedValuesPerRow) {
						for (j in aExpectedValuesPerRow[i]) {
							assert.ok(false, sControlId + "[" + i + "]: "
								+ JSON.stringify(aExpectedValuesPerRow[i][j]) + " (not set)");
						}
					}
				}
			});

			return oPromise;
		}
	});

	/**
	 *
	 * Creates a test with the given title and executes viewStart with the given parameters.
	 *
	 * @param {string} sTitle The title of the test case
	 * @param {string} sView The XML snippet of the view
	 * @param {object} mResponseByRequest A map containing the request as key
	 *   and response as value
	 * @param {object|object[]} mValueByControl A map or an array of maps containing control id as
	 *   key and the expected control values as value
	 * @param {string|sap.ui.model.odata.v4.ODataModel} [vModel]
	 *   The model (or the name of a function at <code>this</code> which creates it); it is attached
	 *   to the view and to the test instance.
	 *   If no model is given, the <code>GWSAMPLE_BASIC</code> model is created and used.
	 * @param {function} [fnAssert]
	 *   A function containing additional assertions such as expected log messages which is called
	 *   just before view creation with the test as "this"
	 */
	function testViewStart(sTitle, sView, mResponseByRequest, mValueByControl, vModel, fnAssert) {

		QUnit.test(sTitle, function (assert) {
			var sControlId, sRequest, that = this;

			function expectChanges(mValueByControl) {
				for (sControlId in mValueByControl) {
					that.expectChange(sControlId, mValueByControl[sControlId]);
				}
			}

			for (sRequest in mResponseByRequest) {
				this.expectRequest(sRequest, mResponseByRequest[sRequest]);
			}
			if (Array.isArray(mValueByControl)) {
				mValueByControl.forEach(expectChanges);
			} else {
				expectChanges(mValueByControl);
			}
			if (typeof vModel === "string") {
				vModel = this[vModel]();
			}
			if (fnAssert) {
				fnAssert.call(this);
			}

			return this.createView(assert, sView, vModel);
		});
	}

	//*********************************************************************************************
	// Scenario: Read and display data for a single field in a form
	// Usage of service: /sap/opu/odata/IWBEP/GWSAMPLE_BASIC/
	testViewStart("Minimal integration test", '\
<FlexBox binding="{/SalesOrderSet(\'0815\')}">\
	<Text id="id0" text="{SalesOrderID}" />\
</FlexBox>',
		{"SalesOrderSet('0815')" : {SalesOrderID : "0815"}},
		[{"id0" : null}, {"id0" : "0815"}]
	);

	//*********************************************************************************************
	// Scenario: Read and display data for a single field in a form
	// Usage of service: /sap/opu/odata/IWBEP/GWSAMPLE_BASIC/
	QUnit.test("Minimal integration test (useBatch=true)", function (assert) {
		var oModel = createSalesOrdersModel({useBatch : true}),
			sView = '\
<FlexBox binding="{/SalesOrderSet(\'0815\')}">\
	<Text id="id0" text="{SalesOrderID}" />\
</FlexBox>';

		this.expectHeadRequest()
			.expectRequest("SalesOrderSet('0815')", {
				SalesOrderID : "0815"
			})
			.expectChange("id0", null)
			.expectChange("id0", "0815");

		// code under test
		return this.createView(assert, sView, oModel);
	});

	//*********************************************************************************************
	// Scenario: Read and display collection data for a table with a single field
	// Usage of service: /sap/opu/odata/IWBEP/GWSAMPLE_BASIC/
	QUnit.test("Minimal integration test with collection data", function (assert) {
		var sView = '\
<Table id="table" items="{/SalesOrderSet}">\
	<ColumnListItem>\
		<Text id="id" text="{SalesOrderID}" />\
	</ColumnListItem>\
</Table>';

		this.expectRequest("SalesOrderSet?$skip=0&$top=100", {
				results : [
					{SalesOrderID : "0500000001"},
					{SalesOrderID : "0500000002"}
				]
			})
			.expectChange("id", ["0500000001", "0500000002"]);

		// code under test
		return this.createView(assert, sView);
	});

	//*********************************************************************************************
	// Scenario: Read and display collection data for a table with a single field
	// Usage of service: /sap/opu/odata/IWBEP/GWSAMPLE_BASIC/
	QUnit.test("Minimal integration test with collection data (useBatch=true)", function (assert) {
		var oModel = createSalesOrdersModel({useBatch : true}),
			sView = '\
<Table id="table" items="{/SalesOrderSet}">\
	<ColumnListItem>\
		<Text id="id" text="{SalesOrderID}" />\
	</ColumnListItem>\
</Table>';

		this.expectHeadRequest()
			.expectRequest("SalesOrderSet?$skip=0&$top=100", {
				results : [
					{SalesOrderID : "0500000001"},
					{SalesOrderID : "0500000002"}
				]
			})
			.expectChange("id", ["0500000001", "0500000002"]);

		// code under test
		return this.createView(assert, sView, oModel);
	});

});