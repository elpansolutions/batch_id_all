frappe.provide("batch_id_all");

// 1. Global Link Formatter for Batch
frappe.form.link_formatters = frappe.form.link_formatters || {};
frappe.form.link_formatters["Batch"] = function(value, doc, docfield) {
	if (doc && doc.custom_batch_id_all) {
		return doc.custom_batch_id_all;
	}
	return value;
};

// Ensure ControlLink seamlessly handles selecting Batch from search dropdown without losing value on blur
(function() {
    if (window.__spa_link_batch_patched) return;
    window.__spa_link_batch_patched = true;

    if (frappe.ui && frappe.ui.form && frappe.ui.form.ControlLink) {
        let orig_setup_awesomeplete = frappe.ui.form.ControlLink.prototype.setup_awesomeplete;
        frappe.ui.form.ControlLink.prototype.setup_awesomeplete = function() {
            orig_setup_awesomeplete.apply(this, arguments);
            let me = this;
            if (this.$input) {
                this.$input.data("control_link", me);
                this.$input.on("awesomplete-select", function(e) {
                    me.selected = true;
                    var o = e.originalEvent;
                    if (o && o.text && o.text.value) {
                        var item = me.awesomplete.get_item(o.text.value);
                        if (item && item.label && item.value) {
                            if (!me.title_value_map) me.title_value_map = {};
                            me.title_value_map[item.label] = item.value;
                            me.title_value_map[item.value] = item.value;
                            if (me.df && me.df.options) {
                                frappe.utils.add_link_title(me.df.options, item.value, item.label);
                            }
                        }
                    }
                });
            }
        };

        let orig_parse_validate = frappe.ui.form.ControlLink.prototype.parse_validate_and_set_in_model;
        frappe.ui.form.ControlLink.prototype.parse_validate_and_set_in_model = function(value, e, label) {
            if (label && value) {
                if (!this.title_value_map) this.title_value_map = {};
                this.title_value_map[label] = value;
                this.title_value_map[value] = value;
                if (this.df && this.df.options) {
                    frappe.utils.add_link_title(this.df.options, value, label);
                }
            }
            return orig_parse_validate.apply(this, arguments);
        };

        let orig_get_input_value = frappe.ui.form.ControlLink.prototype.get_input_value;
        frappe.ui.form.ControlLink.prototype.get_input_value = function() {
            let val = orig_get_input_value ? orig_get_input_value.apply(this, arguments) : (this.$input ? this.$input.val() : null);
            if (this.df && this.df.options === "Batch" && val) {
                if (this.title_value_map && this.title_value_map[val]) {
                    return this.title_value_map[val];
                }
                if (frappe._link_titles) {
                    let prefix = "Batch::";
                    for (let k in frappe._link_titles) {
                        if (k.startsWith(prefix) && String(frappe._link_titles[k]).trim().toLowerCase() === String(val).trim().toLowerCase()) {
                            return k.substring(prefix.length);
                        }
                    }
                }
            }
            return val;
        };
    }

    $(document).on("mousedown", ".awesomplete li, .awesomplete [role='option']", function(e) {
        let input = $(this).closest(".awesomplete").find("input");
        if (input.length) {
            let me = input.data("control_link");
            if (me) {
                me.selected = true;
            }
        }
    });
})();

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

// 3. Return Series Automation for Sales & Purchase Invoices
const set_return_naming_series = function(frm) {
	if (!frm || !frm.doc || frm.doc.docstatus !== 0) return;
	if (!frm.is_new()) return;

	const dt = frm.doc.doctype;
	if (dt !== "Sales Invoice" && dt !== "Purchase Invoice") return;

	if (!frm.__original_naming_series_options) {
		const df = (frm.meta.fields || []).find(f => f.fieldname === "naming_series")
			|| frappe.meta.get_docfield(dt, "naming_series");
		frm.__original_naming_series_options = df?.options || "";
	}

	if (!frm.__original_naming_series_options) return;

	const all_series = frm.__original_naming_series_options
		.split("\n")
		.map(s => s.trim())
		.filter(Boolean);

	const return_series = all_series.filter(s => /RET|RETURN/i.test(s));
	const normal_series = all_series.filter(s => !/RET|RETURN/i.test(s));

	const is_return = Boolean(frm.doc.is_return);
	const target_options = is_return ? return_series : normal_series;
	if (!target_options.length) return;

	// Update dropdown options
	frm.set_df_property("naming_series", "options", target_options.join("\n"));

	// Determine matching series
	let cur = frm.doc.naming_series || "";
	let target_series = "";

	if (is_return) {
		if (return_series.includes(cur)) {
			target_series = cur;
		} else if (cur.includes("ACC-") && return_series.find(s => s.includes("ACC-"))) {
			target_series = return_series.find(s => s.includes("ACC-"));
		} else {
			target_series = return_series[0];
		}
	} else {
		if (normal_series.includes(cur)) {
			target_series = cur;
		} else if (cur.includes("ACC-") && normal_series.find(s => s.includes("ACC-"))) {
			target_series = normal_series.find(s => s.includes("ACC-"));
		} else {
			target_series = normal_series[0];
		}
	}

	if (target_series && frm.doc.naming_series !== target_series) {
		frm.set_value("naming_series", target_series);
	}
};

// 4. Register Sales Form Handlers
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

frappe.ui.form.on("Sales Invoice", {
	onload_post_render: function(frm) {
		set_return_naming_series(frm);
	},
	refresh: function(frm) {
		set_return_naming_series(frm);
	},
	is_return: function(frm) {
		set_return_naming_series(frm);
	}
});

// 5. Register Purchase Form Handlers
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

frappe.ui.form.on("Purchase Invoice", {
	onload_post_render: function(frm) {
		set_return_naming_series(frm);
	},
	refresh: function(frm) {
		set_return_naming_series(frm);
	},
	is_return: function(frm) {
		set_return_naming_series(frm);
	}
});

// 6. Register Child Table Sync for custom_batch_id_all and expiry
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
