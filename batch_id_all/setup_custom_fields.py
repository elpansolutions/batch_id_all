import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields


def get_custom_fields():
	return {
		"Batch": [
			{
				"fieldname": "custom_batch_id_all",
				"label": "Batch ID (All)",
				"fieldtype": "Data",
				"insert_after": "batch_id",
				"in_list_view": 1,
				"in_standard_filter": 1,
				"in_global_search": 1,
				"description": "Shared/Universal Batch ID (can be identical across multiple items)",
			}
		],
		"Purchase Invoice Item": [
			{
				"fieldname": "custom_batch_id_all",
				"label": "Batch No",
				"fieldtype": "Data",
				"insert_after": "item_code",
				"fetch_from": "batch_no.custom_batch_id_all",
				"in_list_view": 1,
				"columns": 2,
				"description": "Universal Batch ID",
			}
		],
		"Purchase Receipt Item": [
			{
				"fieldname": "custom_batch_id_all",
				"label": "Batch No",
				"fieldtype": "Data",
				"insert_after": "item_code",
				"fetch_from": "batch_no.custom_batch_id_all",
				"in_list_view": 1,
				"columns": 2,
				"description": "Universal Batch ID",
			}
		],
		"Purchase Order Item": [
			{
				"fieldname": "custom_batch_id_all",
				"label": "Batch No",
				"fieldtype": "Data",
				"insert_after": "item_code",
				"in_list_view": 1,
				"columns": 2,
				"description": "Universal Batch ID",
			}
		],
		"Sales Invoice Item": [
			{
				"fieldname": "custom_batch_id_all",
				"label": "Batch No",
				"fieldtype": "Data",
				"insert_after": "item_code",
				"fetch_from": "batch_no.custom_batch_id_all",
				"in_list_view": 1,
				"columns": 2,
				"description": "Universal Batch ID",
			}
		],
		"Sales Order Item": [
			{
				"fieldname": "custom_batch_id_all",
				"label": "Batch No",
				"fieldtype": "Data",
				"insert_after": "item_code",
				"in_list_view": 1,
				"columns": 2,
				"description": "Universal Batch ID",
			}
		],
		"Delivery Note Item": [
			{
				"fieldname": "custom_batch_id_all",
				"label": "Batch No",
				"fieldtype": "Data",
				"insert_after": "item_code",
				"fetch_from": "batch_no.custom_batch_id_all",
				"in_list_view": 1,
				"columns": 2,
				"description": "Universal Batch ID",
			}
		],
		"Stock Entry Detail": [
			{
				"fieldname": "custom_batch_id_all",
				"label": "Batch No",
				"fieldtype": "Data",
				"insert_after": "item_code",
				"fetch_from": "batch_no.custom_batch_id_all",
				"in_list_view": 1,
				"columns": 2,
				"description": "Universal Batch ID",
			}
		],
		"Stock Reconciliation Item": [
			{
				"fieldname": "custom_batch_id_all",
				"label": "Batch No",
				"fieldtype": "Data",
				"insert_after": "item_code",
				"fetch_from": "batch_no.custom_batch_id_all",
				"in_list_view": 1,
				"columns": 2,
				"description": "Universal Batch ID",
			}
		],
	}


def setup_property_setters():
	frappe.make_property_setter({
		"doctype": "Batch",
		"property": "search_fields",
		"value": "custom_batch_id_all,item,batch_id",
		"property_type": "Data"
	}, validate_fields_for_doctype=False)
	frappe.make_property_setter({
		"doctype": "Batch",
		"property": "title_field",
		"value": "custom_batch_id_all",
		"property_type": "Data"
	}, validate_fields_for_doctype=False)
	frappe.make_property_setter({
		"doctype": "Batch",
		"property": "show_title_field_in_link",
		"value": "1",
		"property_type": "Check"
	}, validate_fields_for_doctype=False)

	# Hide standard batch_no link from grid columns to prevent internal suffix clutter (011111-004)
	for dt in ["Delivery Note Item", "Sales Invoice Item", "Purchase Invoice Item", "Purchase Receipt Item", "Stock Entry Detail"]:
		frappe.make_property_setter({
			"doctype": dt,
			"fieldname": "batch_no",
			"property": "in_list_view",
			"value": "0",
			"property_type": "Check"
		}, validate_fields_for_doctype=False)


def setup_custom_fields():
	create_custom_fields(get_custom_fields(), ignore_validate=True)
	setup_property_setters()
	# Also populate custom_batch_id_all on any existing batches where custom_batch_id_all is empty
	frappe.db.sql("""
		UPDATE `tabBatch`
		SET custom_batch_id_all = COALESCE(batch_id, name)
		WHERE custom_batch_id_all IS NULL OR custom_batch_id_all = ''
	""")
	# Populate custom_batch_id_all across transaction item rows where missing
	for table in ["tabDelivery Note Item", "tabSales Invoice Item", "tabPurchase Invoice Item", "tabPurchase Receipt Item", "tabStock Entry Detail"]:
		frappe.db.sql(f"""
			UPDATE `{table}` t
			INNER JOIN `tabBatch` b ON t.batch_no = b.name
			SET t.custom_batch_id_all = COALESCE(b.custom_batch_id_all, b.batch_id, b.name)
			WHERE t.batch_no IS NOT NULL AND t.batch_no != ''
			  AND (t.custom_batch_id_all IS NULL OR t.custom_batch_id_all = '')
		""")
	frappe.db.commit()
