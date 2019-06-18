/* global QUnit */

sap.ui.define([
	"sap/ui/fl/Change",
	"sap/ui/fl/ChangePersistence",
	"sap/ui/fl/ChangePersistenceFactory",
	"sap/ui/fl/StandardVariant",
	"sap/ui/fl/DefaultVariant",
	"sap/ui/fl/Utils",
	"sap/ui/fl/Cache",
	"sap/ui/fl/apply/api/SmartVariantManagementApplyAPI",
	"sap/ui/core/UIComponent",
	"sap/ui/core/Control",
	"sap/ui/fl/registry/Settings",
	"sap/ui/thirdparty/sinon-4"
], function(
	Change,
	ChangePersistence,
	ChangePersistenceFactory,
	StandardVariant,
	DefaultVariant,
	Utils,
	Cache,
	SmartVariantManagementApplyAPI,
	UIComponent,
	Control,
	Settings,
	sinon
) {
	"use strict";

	var sandbox = sinon.sandbox.create();

	QUnit.module("SmartVariantManagementApplyAPI", {
		beforeEach : function() {
			this.oAppComponent = new UIComponent("AppComponent21");
			sandbox.stub(Utils, "getAppComponentForControl").returns(this.oAppComponent);
		},
		afterEach: function() {
			if (this.oControl) {
				this.oControl.destroy();
			}
			this.oAppComponent.destroy();
			sandbox.restore();
		}
	}, function() {
		QUnit.test("Utils is loaded correctly", function (assert) {
			assert.ok(Utils);
		});

		QUnit.test("When loadChanges() is called all arguments are passed correctly", function (assert) {
			this.oControl = new Control("controlId1");

			sandbox.stub(Utils, "getSiteId").returns("sSiteId");
			sandbox.stub(Utils, "getAppDescriptor").returns("{}");
			sandbox.stub(SmartVariantManagementApplyAPI, "getStableId").returns("sStableId");

			var fnStub = sandbox.stub();

			var mPropertyBag = {
				appDescriptor: "{}",
				siteId: "sSiteId",
				includeVariants: true
			};

			sandbox.stub(ChangePersistenceFactory, "getChangePersistenceForControl").withArgs(this.oControl).returns({
				getChangesForVariant: fnStub
			});
			SmartVariantManagementApplyAPI.loadChanges(this.oControl);

			assert.ok(fnStub.calledWith("persistencyKey", "sStableId", mPropertyBag));
		});

		QUnit.test("When loadChanges() is called all arguments are passed correctly and the return flow is correct", function (assert) {
			this.oControl = new Control("controlId1");

			sandbox.stub(Utils, "getSiteId").returns("sSiteId");
			sandbox.stub(Utils, "getAppDescriptor").returns("{}");

			var oChanges = {
				__change0: {
					fileName: "sName",
					fileType: "fileType",
					changeType: "changeType",
					layer: "USER",
					content: {}
				}
			};

			var getChangePersistenceForControlStub = sandbox.stub(ChangePersistenceFactory, "getChangePersistenceForControl").withArgs(this.oControl).returns({
				getChangesForVariant: function() {
					return oChanges;
				}
			});

			var oVariantChange = SmartVariantManagementApplyAPI.loadChanges(this.oControl);

			assert.ok(getChangePersistenceForControlStub.calledWith(this.oControl));
			assert.equal(oVariantChange, oChanges);
		});

		QUnit.test("When getChange() is called all arguments are passed correctly and the return flow is correct", function (assert) {
			this.oControl = new Control("controlId1");
			var sId = "__change0";
			var oChange = {
				fileName : "__change0"
			};
			sandbox.stub(Utils, "getSiteId").returns("sSiteId");
			sandbox.stub(Utils, "getAppDescriptor").returns("{}");
			sandbox.stub(SmartVariantManagementApplyAPI, "getStableId").returns("filterBar1");
			sandbox.stub(ChangePersistence.prototype, "getSmartVariantManagementChangeMap").returns(
				{
					filterBar1 : {
						__change0 : oChange
					}
				}
			);
			var oVariantChange = SmartVariantManagementApplyAPI.getChange(this.oControl, sId);

			assert.deepEqual(oVariantChange, oChange);
		});

		QUnit.test("When SmartVariantManagementApplyAPI is called it has the correct key", function (assert) {
			assert.equal(SmartVariantManagementApplyAPI.PERSISTENCY_KEY, "persistencyKey");
		});

		QUnit.test("When isVariantSharingEnabled() is called it calls the Settings instance and returns true", function (assert) {
			var done = assert.async();

			var oSetting = {
				isKeyUser: true,
				isAtoAvailable: true
			};

			sandbox.stub(sap.ui.fl.LrepConnector, "createConnector").returns({
				loadSettings : function() {
					return Promise.resolve(oSetting);
				}
			});
			sandbox.stub(Cache, "getFlexDataPromise").rejects();

			assert.ok(Settings, "Settings loaded");
			var isVariantSharingEnabledSpy = sandbox.spy(SmartVariantManagementApplyAPI, "isVariantSharingEnabled");
			SmartVariantManagementApplyAPI.isVariantSharingEnabled().then(function(bFlag) {
				assert.equal(bFlag, true);
				assert.equal(isVariantSharingEnabledSpy.callCount, 1, "called once");
				done();
			});
		});

		QUnit.test("When getComponentClassName() is called it calls the corresponding Utils function", function (assert) {
			this.oControl = new Control("controlId1");
			sandbox.stub(Utils, "getComponentClassName").withArgs(this.oControl).returns("abc");
			var sComponentClassName = SmartVariantManagementApplyAPI.getComponentClassName(this.oControl);

			assert.equal(sComponentClassName, "abc");
		});

		QUnit.test("When getComponentForControl() is called it returns the Component that belongs to given control", function (assert) {
			this.oControl = new Control("controlId1");
			sandbox.stub(Utils, "getComponentForControl").withArgs(this.oControl).returns("abc");
			var sComponent = SmartVariantManagementApplyAPI.getComponentForControl(this.oControl);

			assert.equal(sComponent, "abc");
		});

		QUnit.test("When isApplicationVariant() is called it calls the corresponding Utils function", function (assert) {
			this.oControl = new Control("controlId1");
			sandbox.stub(Utils, "isApplicationVariant").withArgs(this.oControl).returns("abc");
			var bApplicationVariant = SmartVariantManagementApplyAPI.isApplicationVariant(this.oControl);

			assert.equal(bApplicationVariant, "abc");
		});

		QUnit.test("When isVendorLayer() is called it calls the corresponding Utils function", function (assert) {
			sandbox.stub(Utils, "isVendorLayer").withArgs().returns(false);
			var bVendorLayer = SmartVariantManagementApplyAPI.isVendorLayer();

			assert.equal(bVendorLayer, false);
		});

		QUnit.test("When isVariantDownport() is called it calls the corresponding Utils function", function (assert) {
			sandbox.stub(Utils, "getCurrentLayer").withArgs().returns('VENDOR');
			sandbox.stub(Utils, "isHotfixMode").withArgs().returns(true);
			var bVendorLayer = SmartVariantManagementApplyAPI.isVariantDownport();

			assert.equal(bVendorLayer, true);
		});

		QUnit.test("When getExecuteOnSelectSync() is called all arguments are passed correctly and the return flow is correct", function (assert) {
			this.oControl = new Control("controlId1");
			var oChange = {
				fileName : "__change0"
			};
			var mChangeMap = {
				filterBar1 : {
					__change0 : oChange
				}
			};

			sandbox.stub(SmartVariantManagementApplyAPI, "getStableId").returns("filterBar1");
			sandbox.stub(ChangePersistence.prototype, "getSmartVariantManagementChangeMap").returns(mChangeMap);
			sandbox.stub(StandardVariant, "getExecuteOnSelect").withArgs(mChangeMap["filterBar1"]).returns(true);
			var bExecuteOnSelect = SmartVariantManagementApplyAPI.getExecuteOnSelectSync(this.oControl);

			assert.equal(bExecuteOnSelect, true);
		});

		QUnit.test("When getDefaultVariantIdSync() is called all arguments are passed correctly and the return flow is correct", function (assert) {
			this.oControl = new Control("controlId1");
			var oChange = {
				fileName : "__change0"
			};
			var mChangeMap = {
				filterBar1 : {
					__change0 : oChange
				}
			};

			sandbox.stub(SmartVariantManagementApplyAPI, "getStableId").returns("filterBar1");
			sandbox.stub(ChangePersistence.prototype, "getSmartVariantManagementChangeMap").returns(mChangeMap);
			sandbox.stub(DefaultVariant, "getDefaultVariantId").withArgs(mChangeMap["filterBar1"]).returns(true);
			var bDefaultVariantId = SmartVariantManagementApplyAPI.getDefaultVariantIdSync(this.oControl);

			assert.equal(bDefaultVariantId, true);
		});
	});

	QUnit.done(function () {
		jQuery('#qunit-fixture').hide();
	});
});