/*global QUnit*/
sap.ui.define(["sap/ui/thirdparty/URI"],
	function (URI) {
		"use strict";

		var sCoreUrl = new URI(sap.ui.require.toUrl("sap-ui-core.js"), document.baseURI).href(),
			sFrameURL = sap.ui.require.toUrl("sap/ui/documentation/sdk/util/liveEditorOutput.html"),

		sXmlSrc = '<mvc:View\n' +
			'        controllerName="HelloWorld.App"\n' +
			'        xmlns:mvc="sap.ui.core.mvc"\n' +
			'        xmlns="sap.m">\n' +
			'    <Page id="myPage" title="My App"/>\n' +
			'    <Button\n' +
			'            id="helloButton"\n' +
			'            visible="false"\n' +
			'            type="Emphasized"\n' +
			'            icon="sap-icon://sap-ui5"\n' +
			'            text="Say Hello"\n' +
			'            press="onShowHello"\n' +
			'            class="sapUiSmallMargin"/>\n' +
			'</mvc:View>',

			sControllerSrc = 'sap.ui.define([\n' +
				'            "sap/ui/core/mvc/Controller",\n' +
				'            "sap/m/MessageToast"\n' +
				'        ], function (Controller, MessageToast) {\n' +
				'            "use strict";\n' +
				'            return Controller.extend("HelloWorld.App", {\n' +
				'                onBeforeRendering : function () {\n' +
				'                    this.getView().byId("helloButton").setVisible(true);\n' +
				'                }\n' +
				'            });\n' +
				'        });',

			// uses latest api to create the view asynchronously
			sHTMLSrc_v1 = '<!DOCTYPE html>\n' +
				'<html>\n' +
				'<head>\n' +
				'    <title>OpenUI5 Hello World App</title>\n' +
				'    <script\n' +
				'            id="sap-ui-bootstrap"\n' +
				'            src="' + sCoreUrl + '"\n' +
				'            data-sap-ui-theme="sap_belize"\n' +
				'            data-sap-ui-libs="sap.m"\n' +
				'            data-sap-ui-resourceroots=\'{"HelloWorld": "./"}\'\n' +
				'            displayBlock="true">\n' +
				'    <&sol;script>\n' +
				'\n' +
				'    <script>\n' +
				'    /* uncomment below line to test error display */\n' +
				'     //alert(test.a.length);\n' +
				'        sap.ui.getCore().attachInit(function () {\n' +
				'            sap.ui.require(["sap/ui/core/mvc/XMLView"], function(XMLView) {\n' +
				'                 XMLView.create(\n' +
				'                     {' +
				'                       id: "myView1",' +
				'                       viewName: "HelloWorld.App"}).then(function(myView) {\n' +
				'                     myView.placeAt("content");\n' +
				'                 });\n' +
				'            });\n' +
				'         });\n' +
				'    <&sol;script>\n' +
				'</head>\n' +
				'<body class="sapUiBody" id="content">\n' +
				'</body>\n' +
				'</html>',

			// uses legacy api to create the view synchronously
			sHTMLSrc_v2 = '<!DOCTYPE html>\n' +
				'<html>\n' +
				'<head>\n' +
				'    <title>OpenUI5 Hello World App</title>\n' +
				'    <script\n' +
				'            id="sap-ui-bootstrap"\n' +
				'            src="' + sCoreUrl + '"\n' +
				'            data-sap-ui-theme="sap_belize"\n' +
				'            data-sap-ui-libs="sap.m"\n' +
				'            data-sap-ui-resourceroots=\'{"HelloWorld": "./"}\'\n' +
				'            displayBlock="true">\n' +
				'    <&sol;script>\n' +
				'\n' +
				'    <script>\n' +
				'    sap.ui.getCore().attachInit(function () {\n' +
				'       sap.ui.xmlview({\n' +
				'          id: "myView2",' +
				'          viewName: "HelloWorld.App"\n' +
				'       }).placeAt("content");\n' +
				'    });\n' +
				'    <&sol;script>\n' +
				'</head>\n' +
				'<body class="sapUiBody" id="content">\n' +
				'</body>\n' +
				'</html>',

			// uses legacy api to create the view asynchronously
			sHTMLSrc_v3 = '<!DOCTYPE html>\n' +
				'<html>\n' +
				'<head>\n' +
				'    <title>OpenUI5 Hello World App</title>\n' +
				'    <script\n' +
				'            id="sap-ui-bootstrap"\n' +
				'            src="' + sCoreUrl + '"\n' +
				'            data-sap-ui-theme="sap_belize"\n' +
				'            data-sap-ui-libs="sap.m"\n' +
				'            data-sap-ui-resourceroots=\'{"HelloWorld": "./"}\'\n' +
				'            displayBlock="true">\n' +
				'    <&sol;script>\n' +
				'\n' +
				'    <script>\n' +
				'    sap.ui.getCore().attachInit(function () {\n' +
				'       sap.ui.xmlview({\n' +
				'          id: "myView3",' +
				'          async: true,' +
				'          viewName: "HelloWorld.App"\n' +
				'       }).placeAt("content");\n' +
				'    });\n' +
				'    <&sol;script>\n' +
				'</head>\n' +
				'<body class="sapUiBody" id="content">\n' +
				'</body>\n' +
				'</html>',

			// throws error to test error handling
			sHTMLSrc_v4 = '<!DOCTYPE html>\n' +
				'<html>\n' +
				'<head>\n' +
				'    <title>OpenUI5 Hello World App</title>\n' +
				'    <script\n' +
				'            id="sap-ui-bootstrap"\n' +
				'            src="' + sCoreUrl + '"\n' +
				'            data-sap-ui-theme="sap_belize"\n' +
				'            data-sap-ui-libs="sap.m"\n' +
				'            data-sap-ui-resourceroots=\'{"HelloWorld": "./"}\'\n' +
				'            displayBlock="true">\n' +
				'    <&sol;script>\n' +
				'\n' +
				'    <script>\n' +
				'    sap.ui.getCore().attachInit(function () {\n' +
				'    throw new Error("TestErrorMessage");' +
				'       sap.ui.xmlview({\n' +
				'          id: "myView3",' +
				'          async: true,' +
				'          viewName: "HelloWorld.App"\n' +
				'       }).placeAt("content");\n' +
				'    });\n' +
				'    <&sol;script>\n' +
				'</head>\n' +
				'<body class="sapUiBody" id="content">\n' +
				'</body>\n' +
				'</html>',

			// throws error with code in message to test xss protection
			sHTMLSrc_v5 = '<!DOCTYPE html>\n' +
				'<html>\n' +
				'<head>\n' +
				'    <title>OpenUI5 Hello World App</title>\n' +
				'    <script\n' +
				'            id="sap-ui-bootstrap"\n' +
				'            src="' + sCoreUrl + '"\n' +
				'            data-sap-ui-theme="sap_belize"\n' +
				'            data-sap-ui-libs="sap.m"\n' +
				'            data-sap-ui-resourceroots=\'{"HelloWorld": "./"}\'\n' +
				'            displayBlock="true">\n' +
				'    <&sol;script>\n' +
				'\n' +
				'    <script>\n' +
				'    sap.ui.getCore().attachInit(function () {\n' +
				'    throw new Error("<tag>");' +
				'       sap.ui.xmlview({\n' +
				'          id: "myView3",' +
				'          async: true,' +
				'          viewName: "HelloWorld.App"\n' +
				'       }).placeAt("content");\n' +
				'    });\n' +
				'    <&sol;script>\n' +
				'</head>\n' +
				'<body class="sapUiBody" id="content">\n' +
				'</body>\n' +
				'</html>';

		QUnit.module("Samples", {

			beforeEach: function () {
				this.iframe = document.createElement('iframe');
				document.body.appendChild(this.iframe);
			},
			afterEach: function () {
				this.iframe.parentElement.removeChild(this.iframe);
				this.iframe = null;
			}
		});

		QUnit.test("loads view content when view created with XMLView.create", function(assert) {

			var done = assert.async(),
				oFrame = this.iframe,

			oData = {
				'index.html': sHTMLSrc_v1.replace(/&sol;/g, "/"),
				'App.view.xml': sXmlSrc,
				'App.controller.js': sControllerSrc
			};

			oFrame.onload = function() {
				if (oFrame.contentWindow) {
					oFrame.contentWindow.postMessage(oData, "*");
				}
				oFrame.onload = function() {
					setTimeout(function() {
						var oCore = oFrame.contentWindow.sap.ui.getCore(),
							oView = oCore && oCore.byId("myView1");

						assert.ok(oView, "the view is created");

						function isViewContentCreated() {
							assert.ok(oView.byId("myPage"), "the page is created");
							assert.ok(oView.byId("helloButton"), "the button is created");

							done();
						}

						if (!oView.getContent().length) {
							oView.attachAfterInit(isViewContentCreated, this);
						} else {
							isViewContentCreated();
						}
					}, 1000);
					oFrame.onload = null;
				};
			};

			oFrame.src = sFrameURL;
		});

		QUnit.test("loads view content when view created with sap.ui.xmlview", function(assert) {

			var done = assert.async(),
				oFrame = this.iframe,
			oData = {
				'index.html': sHTMLSrc_v2.replace(/&sol;/g, "/"),
				'App.view.xml': sXmlSrc,
				'App.controller.js': sControllerSrc
			};

			oFrame.onload = function() {
				if (oFrame.contentWindow) {
					oFrame.contentWindow.postMessage(oData, "*");
				}
				oFrame.onload = function() {
					assert.ok(oFrame.contentWindow.sap.ui.getCore().byId("myView2"), "the view is created");
					assert.ok(oFrame.contentWindow.sap.ui.getCore().byId("myView2--myPage"), "the page is created");
					assert.ok(oFrame.contentWindow.sap.ui.getCore().byId("myView2--helloButton"), "the button is created");
					oFrame.onload = null;
					done();
				};
			};

			oFrame.src = sFrameURL;
		});

		QUnit.test("loads view content when view created with sap.ui.xmlview async", function(assert) {

			var done = assert.async(),
				oFrame = this.iframe,
				oData = {
					'index.html': sHTMLSrc_v3.replace(/&sol;/g, "/"),
					'App.view.xml': sXmlSrc,
					'App.controller.js': sControllerSrc
				};

			oFrame.onload = function() {
				if (oFrame.contentWindow) {
					oFrame.contentWindow.postMessage(oData, "*");
				}
				oFrame.onload = function() {
					var oCore = oFrame.contentWindow.sap.ui.getCore(),
						oView = oCore && oCore.byId("myView3");

					assert.ok(oView, "the view is created");

					function isViewContentCreated() {
						assert.ok(oView.byId("myPage"), "the page is created");
						assert.ok(oView.byId("helloButton"), "the button is created");

						done();
					}

					if (!oView.getContent().length) {
						oView.attachAfterInit(isViewContentCreated, this);
					} else {
						isViewContentCreated();
					}
					oFrame.onload = null;
				};
			};

			oFrame.src = sFrameURL;
		});

		QUnit.test("executes controller", function(assert) {

			var done = assert.async(),
				oFrame = this.iframe,
				oData = {
					'index.html': sHTMLSrc_v3.replace(/&sol;/g, "/"),
					'App.view.xml': sXmlSrc,
					'App.controller.js': sControllerSrc
				};

			oFrame.onload = function() {
				if (oFrame.contentWindow) {
					oFrame.contentWindow.postMessage(oData, "*");
				}
				oFrame.onload = function() {
					setTimeout(function() {
						assert.ok(oFrame.contentWindow.sap.ui.getCore().byId("myView3--helloButton").getVisible(), "the button is visible");
						done();
					}, 10);
					oFrame.onload = null;
				};
			};

			oFrame.src = sFrameURL;
		});


		QUnit.test("displays uncauth errors in output window", function(assert) {

			var done = assert.async(),
				oFrame = this.iframe,
				oData = {
					'index.html': sHTMLSrc_v4.replace(/&sol;/g, "/"),
					'App.view.xml': sXmlSrc,
					'App.controller.js': sControllerSrc
				};

			oFrame.onload = function() {
				if (oFrame.contentWindow) {
					oFrame.contentWindow.postMessage(oData, "*");
				}
				oFrame.onload = function() {
					setTimeout(function() {
						assert.ok(oFrame.contentWindow.document.body.innerText.indexOf("TestErrorMessage") >= 0, "error is displayed");
						done();
					}, 1000);
					oFrame.onload = null;
				};
			};

			oFrame.src = sFrameURL;
		});

		QUnit.test("any code in the error message is output as text only", function(assert) {

			var done = assert.async(),
				oFrame = this.iframe,
				oData = {
					'index.html': sHTMLSrc_v5.replace(/&sol;/g, "/"),
					'App.view.xml': sXmlSrc,
					'App.controller.js': sControllerSrc
				};

			oFrame.onload = function() {
				if (oFrame.contentWindow) {
					oFrame.contentWindow.postMessage(oData, "*");
				}
				oFrame.onload = function() {
					setTimeout(function() {
						assert.ok(oFrame.contentWindow.document.body.innerText.indexOf("<tag>") >= 0, "code is displayed as text");
						done();
					}, 1000);
					oFrame.onload = null;
				};
			};

			oFrame.src = sFrameURL;
		});


	});