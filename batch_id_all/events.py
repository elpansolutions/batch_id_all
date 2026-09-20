import frappe
from frappe import _
from frappe.utils import flt, format_date


def batch_before_insert(doc, method=None):
	"""
	Hook for Batch doctype before insert / creation / naming.
	If another product already uses the exact same physical batch ID,
	automatically name this batch '{custom_batch_id_all}-{item}'
	to prevent MySQL Primary Key DuplicateEntryError,
	while keeping 'custom_batch_id_all' pristine (e.g. '5678').
	"""
	raw_id = doc.custom_batch_id_all or doc.batch_id or doc.name
	if not raw_id:
		return

	raw_id = str(raw_id).strip()
	doc.custom_batch_id_all = raw_id

	# Check if a batch with name == raw_id already exists in the database
	existing_batch = frappe.db.get_value("Batch", raw_id, ["name", "item"], as_dict=True)

	if existing_batch and existing_batch.item != doc.item:
		# Contradiction detected: Same batch ID used for a different item
		target_name = f"{raw_id}-{doc.item}"
		counter = 1
		while frappe.db.exists("Batch", target_name):
			# If target_name exists and belongs to this item, reuse it
			t_item = frappe.db.get_value("Batch", target_name, "item")
			if t_item == doc.item:
				break
			counter += 1
			target_name = f"{raw_id}-{doc.item}-{counter}"
		
		doc.name = target_name
		doc.batch_id = target_name
	elif not existing_batch:
		doc.name = raw_id
		doc.batch_id = raw_id
	else:
		# Same item, exact same batch
		doc.name = raw_id
		doc.batch_id = raw_id


def batch_validate(doc, method=None):
	"""
	Ensure custom_batch_id_all is always populated on Batch master.
	"""
	if not doc.custom_batch_id_all:
		doc.custom_batch_id_all = doc.batch_id or doc.name


def sync_transaction_taxes(doc, method=None):
	"""
	Automatically determines tax_category (In-State vs Out-State) and taxes_and_charges template
	for Sales and Purchase transactions if not already set or if party address specifies GSTIN.
	"""
	is_sales = doc.doctype in ["Sales Invoice", "Sales Order", "Delivery Note"]
	is_purchase = doc.doctype in ["Purchase Invoice", "Purchase Order", "Purchase Receipt"]
	if not (is_sales or is_purchase):
		return

	gstin = ""
	if is_sales:
		addr = doc.get("customer_address") or doc.get("shipping_address_name")
		if addr:
			gstin = frappe.db.get_value("Address", addr, "gstin") or ""
		if not gstin and doc.get("customer"):
			gstin = frappe.db.get_value("Customer", doc.get("customer"), "gstin") or ""
	elif is_purchase:
		addr = doc.get("supplier_address") or doc.get("shipping_address")
		if addr:
			gstin = frappe.db.get_value("Address", addr, "gstin") or ""
		if not gstin and doc.get("supplier"):
			gstin = frappe.db.get_value("Supplier", doc.get("supplier"), "gstin") or ""

	gstin = str(gstin or "").strip().replace(" ", "").upper()
	state_code = gstin[:2] if len(gstin) >= 2 and gstin[:2].isdigit() else ""

	target_tax_category = "In-State" if (state_code == "33" or not state_code) else "Out-State"
	if not doc.tax_category:
		doc.tax_category = target_tax_category

	if is_sales and not doc.taxes_and_charges:
		doc.taxes_and_charges = "Output GST In-state - RRS" if doc.tax_category == "In-State" else "Output GST Out-state - RRS"
	elif is_purchase and not doc.taxes_and_charges:
		doc.taxes_and_charges = "Input GST In-state - RRS" if doc.tax_category == "In-State" else "Input GST Out-state - RRS"


def parse_expiry_to_date(val):
	if not val:
		return None
	val_str = str(val).strip()
	if "-" in val_str and len(val_str.split("-")) == 2:
		parts = val_str.split("-")
		m_str, y_str = parts[0], parts[1]
		if m_str.isdigit() and y_str.isdigit():
			m = int(m_str)
			y = 2000 + int(y_str) if len(y_str) == 2 else int(y_str)
			if 1 <= m <= 12:
				if m in [1, 3, 5, 7, 8, 10, 12]:
					last_day = 31
				elif m in [4, 6, 9, 11]:
					last_day = 30
				else:
					is_leap = (y % 400 == 0) or (y % 4 == 0 and y % 100 != 0)
					last_day = 29 if is_leap else 28
				return f"{y:04d}-{m:02d}-{last_day:02d}"
	try:
		return frappe.utils.getdate(val_str)
	except Exception:
		return None


def get_or_create_batch_for_item(item_code, raw_batch_id, row=None):
	"""
	Retrieves the appropriate Batch document name for (item_code, raw_batch_id),
	or automatically creates and inserts a new Batch record if it does not exist yet.
	"""
	if not item_code or not raw_batch_id:
		return None
	raw_id = str(raw_batch_id).strip()
	if not raw_id:
		return None

	# 1. Search for existing batch specifically belonging to this item
	existing_name = frappe.db.get_value("Batch", {"item": item_code, "custom_batch_id_all": raw_id}, "name")
	if not existing_name:
		existing_name = frappe.db.get_value("Batch", {"item": item_code, "batch_id": raw_id}, "name")
	if not existing_name:
		existing_name = frappe.db.get_value("Batch", {"item": item_code, "name": f"{raw_id}-{item_code}"}, "name")
	if not existing_name and frappe.db.exists("Batch", {"item": item_code, "name": raw_id}):
		existing_name = raw_id

	if existing_name:
		# Ensure custom_batch_id_all is populated on existing batch
		cur_val = frappe.db.get_value("Batch", existing_name, "custom_batch_id_all")
		if not cur_val:
			frappe.db.set_value("Batch", existing_name, "custom_batch_id_all", raw_id)
		return existing_name

	# 2. Batch doesn't exist yet for this item -> CREATE NEW BATCH
	batch = frappe.new_doc("Batch")
	batch.item = item_code
	batch.custom_batch_id_all = raw_id

	# Determine unique Primary Key name
	if frappe.db.exists("Batch", raw_id):
		target_name = f"{raw_id}-{item_code}"
		counter = 1
		while frappe.db.exists("Batch", target_name):
			# If exists and belongs to this item, return it
			if frappe.db.get_value("Batch", target_name, "item") == item_code:
				return target_name
			counter += 1
			target_name = f"{raw_id}-{item_code}-{counter}"
		batch.name = target_name
		batch.batch_id = target_name
	else:
		batch.name = raw_id
		batch.batch_id = raw_id

	# Populate metadata from row if available
	if row:
		exp_val = row.get("expiry_date") or row.get("custom_expiry_date") or row.get("custom_expiry")
		if exp_val:
			parsed_date = parse_expiry_to_date(exp_val)
			if parsed_date:
				batch.expiry_date = parsed_date

		mrp_val = row.get("custom_mrp") or row.get("custom_custom_mrp") or row.get("mrp")
		if mrp_val:
			for mrp_field in ["custom_custom_mrp", "custom_mrp", "mrp"]:
				if frappe.get_meta("Batch").has_field(mrp_field):
					batch.set(mrp_field, flt(mrp_val))
					break

		min_val = row.get("custom_minimum_selling_price") or row.get("minimum_selling_price")
		if min_val:
			for min_field in ["custom_minimum_selling_price", "minimum_selling_price"]:
				if frappe.get_meta("Batch").has_field(min_field):
					batch.set(min_field, flt(min_val))
					break

	batch.insert(ignore_permissions=True)
	return batch.name


def sync_transaction_item_batches(doc, method=None):
	"""
	Universal hook for Purchase/Sales/Stock transactions.
	Ensures row.batch_no points to the legitimate Batch record for row.item_code,
	resolving any cross-item batch conflicts automatically,
	creating missing batch records on-the-fly,
	populating custom_batch_id_all with the clean shared batch number,
	and synchronizing tax details.
	"""
	sync_transaction_taxes(doc, method)

	items = doc.get("items") or []
	if not items and hasattr(doc, "supplied_items"):
		items = doc.get("supplied_items") or []

	for row in items:
		item_code = row.get("item_code")
		if not item_code:
			continue

		batch_no = row.get("batch_no")
		custom_batch = row.get("custom_batch_id_all") or row.get("custom_batch_number")

		raw_id = str(custom_batch or "").strip()
		if not raw_id and batch_no:
			raw_id = str(frappe.db.get_value("Batch", batch_no, "custom_batch_id_all") or batch_no).strip()

		if not raw_id:
			continue

		row.custom_batch_id_all = raw_id

		# Check if current batch_no is missing, invalid, or belongs to a different item
		needs_batch_resolution = False
		if not batch_no:
			needs_batch_resolution = True
		elif not frappe.db.exists("Batch", batch_no):
			needs_batch_resolution = True
		else:
			batch_item = frappe.db.get_value("Batch", batch_no, "item")
			if batch_item and batch_item != item_code:
				needs_batch_resolution = True

		if needs_batch_resolution:
			resolved_batch = get_or_create_batch_for_item(item_code, raw_id, row)
			row.batch_no = resolved_batch


@frappe.whitelist()
def get_clean_batch_no_query(doctype=None, txt=None, searchfield=None, start=0, page_len=20, filters=None):
	"""
	Custom query for batch_no Link fields across transactions.
	Ensures search results return:
	Column 0: b.name (internal batch docname e.g. '011111-004')
	Column 1: clean batch ID (e.g. '011111') -> Frappe uses this as the primary title/display label!
	Column 2: description (e.g. 'Stock: 10 Nos | Exp: 31-08-2029')
	"""
	import json
	if isinstance(filters, str):
		try:
			filters = json.loads(filters)
		except Exception:
			filters = {}
	elif not isinstance(filters, dict):
		filters = {}

	item_code = filters.get("item_code")
	warehouse = filters.get("warehouse")

	conditions = ["b.disabled = 0"]
	values = {}

	if item_code:
		conditions.append("b.item = %(item_code)s")
		values["item_code"] = item_code

	if txt:
		conditions.append("(b.name LIKE %(txt)s OR b.batch_id LIKE %(txt)s OR b.custom_batch_id_all LIKE %(txt)s)")
		values["txt"] = f"%{txt}%"

	where_clause = " AND ".join(conditions)
	s_offset = int(start) if str(start).isdigit() else 0
	p_limit = int(page_len) if str(page_len).isdigit() else 20

	query = f"""
		SELECT 
			b.name,
			COALESCE(NULLIF(b.custom_batch_id_all, ''), NULLIF(b.batch_id, ''), b.name) AS clean_batch_id,
			b.batch_qty,
			b.expiry_date
		FROM `tabBatch` b
		WHERE {where_clause}
		ORDER BY b.creation DESC
		LIMIT {s_offset}, {p_limit}
	"""
	records = frappe.db.sql(query, values, as_dict=True)
	results = []
	for r in records:
		clean_id = r.clean_batch_id
		qty_str = f"Stock: {flt(r.batch_qty)} Nos" if r.batch_qty is not None else ""
		exp_str = f"Exp: {frappe.utils.format_date(r.expiry_date)}" if r.expiry_date else ""
		desc_parts = [p for p in [qty_str, exp_str] if p]
		desc = " | ".join(desc_parts)
		results.append((r.name, clean_id, desc))

	return results
