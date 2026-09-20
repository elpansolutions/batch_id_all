import frappe

def run():
    # 1. Update v4 gst and other print formats
    pfs = frappe.get_all("Print Format", fields=["name", "html"])
    for pf_meta in pfs:
        pf = frappe.get_doc("Print Format", pf_meta.name)
        if pf.html and "item.batch_no" in pf.html:
            new_html = pf.html.replace("item.batch_no", "item.custom_batch_id_all or item.batch_no")
            if new_html != pf.html:
                pf.html = new_html
                pf.save(ignore_permissions=True)
                print(f"Updated Print Format: {pf.name}")
    
    # Ensure v4 gst specifically is verified
    v4 = frappe.get_doc("Print Format", "v4 gst")
    if v4.html and "item.batch_no" in v4.html and "item.custom_batch_id_all" not in v4.html:
        v4.html = v4.html.replace("item.batch_no", "item.custom_batch_id_all or item.batch_no")
        v4.save(ignore_permissions=True)
        print("Updated v4 gst Print Format specifically.")

    # 2. Update Property Setters for in_list_view
    child_tables = [
        "Sales Invoice Item",
        "Sales Order Item",
        "Delivery Note Item",
        "Purchase Invoice Item",
        "Purchase Order Item",
        "Purchase Receipt Item",
        "Stock Entry Detail",
        "Stock Reconciliation Item"
    ]

    for dt in child_tables:
        # Hide standard batch_no from list view (in_list_view = 0)
        frappe.make_property_setter({
            "doctype": dt,
            "fieldname": "batch_no",
            "property": "in_list_view",
            "value": "0",
            "property_type": "Check"
        }, validate_fields_for_doctype=False)

        # Ensure custom_batch_id_all is in list view (in_list_view = 1, columns = 2, label = 'Batch No')
        cf_name = f"{dt}-custom_batch_id_all"
        if frappe.db.exists("Custom Field", cf_name):
            cf = frappe.get_doc("Custom Field", cf_name)
            cf.in_list_view = 1
            cf.columns = 2
            cf.label = "Batch No"
            cf.insert_after = "item_code"
            cf.save(ignore_permissions=True)

        frappe.clear_cache(doctype=dt)

    frappe.db.commit()
    print("Property setters and Custom Fields updated.")

