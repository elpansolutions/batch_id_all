app_name = "batch_id_all"
app_title = "Batch ID All"
app_publisher = "RRS"
app_description = "Universal Batch ID Manager for Frappe / ERPNext - Enables identical physical batch numbers across multiple products with automatic conflict resolution."
app_email = "info@example.com"
app_license = "MIT"

# Includes in <head>
# ------------------
app_include_js = "/assets/batch_id_all/js/batch_id_all.js"

doctype_js = {
	"Batch": "public/js/batch_id_all.js",
	"Purchase Invoice": "public/js/batch_id_all.js",
	"Purchase Receipt": "public/js/batch_id_all.js",
	"Purchase Order": "public/js/batch_id_all.js",
	"Sales Invoice": "public/js/batch_id_all.js",
	"Sales Order": "public/js/batch_id_all.js",
	"Delivery Note": "public/js/batch_id_all.js",
	"Stock Entry": "public/js/batch_id_all.js",
	"Stock Reconciliation": "public/js/batch_id_all.js",
}

# Document Events
# ---------------
doc_events = {
	"Batch": {
		"before_naming": "batch_id_all.events.batch_before_insert",
		"autoname": "batch_id_all.events.batch_before_insert",
		"before_insert": "batch_id_all.events.batch_before_insert",
		"validate": "batch_id_all.events.batch_validate",
	},
	"Purchase Invoice": {
		"before_insert": "batch_id_all.events.sync_transaction_naming_series",
		"before_validate": "batch_id_all.events.sync_transaction_item_batches",
		"validate": "batch_id_all.events.sync_transaction_item_batches",
		"before_save": "batch_id_all.events.sync_transaction_item_batches",
		"before_submit": "batch_id_all.events.sync_transaction_item_batches",
	},
	"Purchase Receipt": {
		"before_validate": "batch_id_all.events.sync_transaction_item_batches",
		"validate": "batch_id_all.events.sync_transaction_item_batches",
		"before_save": "batch_id_all.events.sync_transaction_item_batches",
		"before_submit": "batch_id_all.events.sync_transaction_item_batches",
	},
	"Purchase Order": {
		"before_validate": "batch_id_all.events.sync_transaction_item_batches",
		"validate": "batch_id_all.events.sync_transaction_item_batches",
		"before_save": "batch_id_all.events.sync_transaction_item_batches",
	},
	"Sales Invoice": {
		"before_insert": "batch_id_all.events.sync_transaction_naming_series",
		"before_validate": "batch_id_all.events.sync_transaction_item_batches",
		"validate": "batch_id_all.events.sync_transaction_item_batches",
		"before_save": "batch_id_all.events.sync_transaction_item_batches",
		"before_submit": "batch_id_all.events.sync_transaction_item_batches",
	},
	"Sales Order": {
		"before_validate": "batch_id_all.events.sync_transaction_item_batches",
		"validate": "batch_id_all.events.sync_transaction_item_batches",
		"before_save": "batch_id_all.events.sync_transaction_item_batches",
	},
	"Delivery Note": {
		"before_validate": "batch_id_all.events.sync_transaction_item_batches",
		"validate": "batch_id_all.events.sync_transaction_item_batches",
		"before_save": "batch_id_all.events.sync_transaction_item_batches",
		"before_submit": "batch_id_all.events.sync_transaction_item_batches",
	},
	"Stock Entry": {
		"before_validate": "batch_id_all.events.sync_transaction_item_batches",
		"validate": "batch_id_all.events.sync_transaction_item_batches",
		"before_save": "batch_id_all.events.sync_transaction_item_batches",
	},
	"Stock Reconciliation": {
		"before_validate": "batch_id_all.events.sync_transaction_item_batches",
		"validate": "batch_id_all.events.sync_transaction_item_batches",
		"before_save": "batch_id_all.events.sync_transaction_item_batches",
	},
}

# Override Standard Queries
# -------------------------
override_whitelisted_methods = {
	"erpnext.controllers.queries.get_batch_no": "batch_id_all.events.get_clean_batch_no_query",
	"frappe.client.validate_link_and_fetch": "sales_pricing_assistant.api.validate_link_and_fetch"
}

# Installation and Migration Hooks
# --------------------------------
after_install = "batch_id_all.setup_custom_fields.setup_custom_fields"
after_migrate = "batch_id_all.setup_custom_fields.setup_custom_fields"
