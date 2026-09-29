frappe.provide("batch_id_all");

// 1. Global Link Formatter for Batch
frappe.form.link_formatters = frappe.form.link_formatters || {};
frappe.form.link_formatters["Batch"] = function(value, doc, docfield) {
	if (doc && doc.custom_batch_id_all) {
		return doc.custom_batch_id_all;
	}
	return value;
};

// 2. Tax Category & Taxes and Charges Automation
const set_sales_tax_details = async function(frm) {
	if (!frm || !frm.doc || !frm.doc.customer || frm.doc.docstatus !== 0) return;

	let gstin = "";
	if (frm.doc.customer_address) {
		try {
			const result = await frappe.db.get_value("Address", frm.doc.customer_address, ["gstin"]);
			gstin = result?.message?.gstin || "";
		} catch (e) {}
	}
	if (!gstin && frm.doc.customer) {
		try {
			const cust_res = await frappe.db.get_value("Customer", frm.doc.customer, ["gstin", "tax_id"]);
			gstin = cust_res?.message?.gstin || cust_res?.message?.tax_id || "";
		} catch (e) {}
	}

	gstin = String(gstin || "").trim().replace(/\s+/g, "").toUpperCase();
	const state_code = gstin ? gstin.substring(0, 2) : "";

	// In-State (Tamil Nadu 33) vs Out-State
	const target_tax_category = (state_code === "33" || !state_code) ? "In-State" : "Out-State";
	const target_taxes_template = target_tax_category === "In-State" ? "Output GST In-state - RRS" : "Output GST Out-state - RRS";

	if (frm.doc.tax_category !== target_tax_category) {
		await frm.set_value("tax_category", target_tax_category);
	}

	if (!frm.doc.taxes_and_charges || frm.doc.taxes_and_charges !== target_taxes_template) {
		await frm.set_value("taxes_and_charges", target_taxes_template);
	}
};

const set_purchase_tax_details = async function(frm) {
	if (!frm || !frm.doc || !frm.doc.supplier || frm.doc.docstatus !== 0) return;

	let gstin = "";
	if (frm.doc.supplier_address) {
		try {
			const result = await frappe.db.get_value("Address", frm.doc.supplier_address, ["gstin"]);
			gstin = result?.message?.gstin || "";
		} catch (e) {}
	}
	if (!gstin && frm.doc.supplier) {
		try {
			const supp_res = await frappe.db.get_value("Supplier", frm.doc.supplier, ["gstin", "tax_id"]);
			gstin = supp_res?.message?.gstin || supp_res?.message?.tax_id || "";
		} catch (e) {}
	}

	gstin = String(gstin || "").trim().replace(/\s+/g, "").toUpperCase();
	const state_code = gstin ? gstin.substring(0, 2) : "";

	const target_tax_category = (state_code === "33" || !state_code) ? "In-State" : "Out-State";
	const target_taxes_template = target_tax_category === "In-State" ? "Input GST In-state - RRS" : "Input GST Out-state - RRS";

	if (frm.doc.tax_category !== target_tax_category) {
		await frm.set_value("tax_category", target_tax_category);
	}

	if (!frm.doc.taxes_and_charges || frm.doc.taxes_and_charges !== target_taxes_template) {
		await frm.set_value("taxes_and_charges", target_taxes_template);
	}
};

// 3. Register Sales Form Handlers
["Sales Invoice", "Sales Order", "Delivery Note"].forEach(doctype => {
	frappe.ui.form.on(doctype, {
		setup: function(frm) {
			frm.set_query("batch_no", "items", function(doc, cdt, cdn) {
				let row = locals[cdt]?.[cdn];
				return {
					query: "batch_id_all.events.get_clean_batch_no_query",
					filters: {
						item_code: row?.item_code,
						warehouse: row?.warehouse
					}
				};
			});
		},
		refresh: function(frm) {
			(frm.doc.items || []).forEach(row => {
				if (row.batch_no) {
					let needs_batch_id = !row.custom_batch_id_all;
					let needs_expiry = (frappe.meta.has_field(row.doctype, "custom_expiry") && !row.custom_expiry)
						|| (frappe.meta.has_field(row.doctype, "custom_expiry_date") && !row.custom_expiry_date)
						|| (frappe.meta.has_field(row.doctype, "expiry_date") && !row.expiry_date);

					if (needs_batch_id || needs_expiry) {
						frappe.db.get_value("Batch", row.batch_no, ["custom_batch_id_all", "expiry_date"], (r) => {
							if (r) {
								let updated = false;
								if (r.custom_batch_id_all && !row.custom_batch_id_all) {
									row.custom_batch_id_all = r.custom_batch_id_all;
									updated = true;
								}
								if (r.expiry_date) {
									if (frappe.meta.has_field(row.doctype, "custom_expiry") && !row.custom_expiry) {
										row.custom_expiry = r.expiry_date;
										updated = true;
									}
									if (frappe.meta.has_field(row.doctype, "custom_expiry_date") && !row.custom_expiry_date) {
										row.custom_expiry_date = r.expiry_date;
										updated = true;
									}
									if (frappe.meta.has_field(row.doctype, "expiry_date") && !row.expiry_date) {
										row.expiry_date = r.expiry_date;
										updated = true;
									}
								}
								if (updated) {
									frm.refresh_field("items");
								}
							}
						});
					}
				}
			});
		},
		customer: function(frm) {
			setTimeout(() => set_sales_tax_details(frm), 600);
		},
		customer_address: function(frm) {
			setTimeout(() => set_sales_tax_details(frm), 300);
		},
		validate: function(frm) {
			return set_sales_tax_details(frm);
		}
	});
});

// 4. Register Purchase Form Handlers
["Purchase Invoice", "Purchase Order", "Purchase Receipt"].forEach(doctype => {
	frappe.ui.form.on(doctype, {
		setup: function(frm) {
			frm.set_query("batch_no", "items", function(doc, cdt, cdn) {
				let row = locals[cdt]?.[cdn];
				return {
					query: "batch_id_all.events.get_clean_batch_no_query",
					filters: {
						item_code: row?.item_code,
						warehouse: row?.warehouse
					}
				};
			});
		},
		refresh: function(frm) {
			(frm.doc.items || []).forEach(row => {
				if (row.batch_no) {
					let needs_batch_id = !row.custom_batch_id_all;
					let needs_expiry = (frappe.meta.has_field(row.doctype, "custom_expiry") && !row.custom_expiry)
						|| (frappe.meta.has_field(row.doctype, "custom_expiry_date") && !row.custom_expiry_date)
						|| (frappe.meta.has_field(row.doctype, "expiry_date") && !row.expiry_date);

					if (needs_batch_id || needs_expiry) {
						frappe.db.get_value("Batch", row.batch_no, ["custom_batch_id_all", "expiry_date"], (r) => {
							if (r) {
								let updated = false;
								if (r.custom_batch_id_all && !row.custom_batch_id_all) {
									row.custom_batch_id_all = r.custom_batch_id_all;
									updated = true;
								}
								if (r.expiry_date) {
									if (frappe.meta.has_field(row.doctype, "custom_expiry") && !row.custom_expiry) {
										row.custom_expiry = r.expiry_date;
										updated = true;
									}
									if (frappe.meta.has_field(row.doctype, "custom_expiry_date") && !row.custom_expiry_date) {
										row.custom_expiry_date = r.expiry_date;
										updated = true;
									}
									if (frappe.meta.has_field(row.doctype, "expiry_date") && !row.expiry_date) {
										row.expiry_date = r.expiry_date;
										updated = true;
									}
								}
								if (updated) {
									frm.refresh_field("items");
								}
							}
						});
					}
				}
			});
		},
		supplier: function(frm) {
			setTimeout(() => set_purchase_tax_details(frm), 600);
		},
		supplier_address: function(frm) {
			setTimeout(() => set_purchase_tax_details(frm), 300);
		},
		validate: function(frm) {
			return set_purchase_tax_details(frm);
		}
	});
});

// 5. Register Child Table Sync for custom_batch_id_all and expiry
const child_doctypes = [
	"Sales Invoice Item",
	"Sales Order Item",
	"Delivery Note Item",
	"Purchase Invoice Item",
	"Purchase Order Item",
	"Purchase Receipt Item",
	"Stock Entry Detail",
	"Stock Reconciliation Item"
];

function set_row_expiry_and_batch(row, cdt, cdn, batch_data) {
	if (!batch_data) return;
	let clean_id = batch_data.custom_batch_id_all || row.batch_no;
	if (clean_id && row.custom_batch_id_all !== clean_id) {
		frappe.model.set_value(cdt, cdn, "custom_batch_id_all", clean_id);
	}
	if (batch_data.expiry_date) {
		if (frappe.meta.has_field(cdt, "custom_expiry") && row.custom_expiry !== batch_data.expiry_date) {
			frappe.model.set_value(cdt, cdn, "custom_expiry", batch_data.expiry_date);
		}
		if (frappe.meta.has_field(cdt, "custom_expiry_date") && row.custom_expiry_date !== batch_data.expiry_date) {
			frappe.model.set_value(cdt, cdn, "custom_expiry_date", batch_data.expiry_date);
		}
		if (frappe.meta.has_field(cdt, "expiry_date") && row.expiry_date !== batch_data.expiry_date) {
			frappe.model.set_value(cdt, cdn, "expiry_date", batch_data.expiry_date);
		}
	}
}

child_doctypes.forEach(child_dt => {
	frappe.ui.form.on(child_dt, {
		batch_no: function(frm, cdt, cdn) {
			let row = locals[cdt]?.[cdn];
			if (row && row.batch_no) {
				frappe.db.get_value("Batch", row.batch_no, ["custom_batch_id_all", "expiry_date", "item"], (r) => {
					if (r) {
						set_row_expiry_and_batch(row, cdt, cdn, r);
					}
				});
			}
		},
		custom_batch_id_all: function(frm, cdt, cdn) {
			let row = locals[cdt]?.[cdn];
			if (row && row.custom_batch_id_all && row.item_code) {
				frappe.db.get_value("Batch", {
					item: row.item_code,
					custom_batch_id_all: row.custom_batch_id_all
				}, ["name", "custom_batch_id_all", "expiry_date"], (r) => {
					if (r && r.name) {
						if (row.batch_no !== r.name) {
							frappe.model.set_value(cdt, cdn, "batch_no", r.name);
						}
						set_row_expiry_and_batch(row, cdt, cdn, r);
					}
				});
			}
		}
	});
});
