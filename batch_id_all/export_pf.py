import frappe

def run():
    pf = frappe.get_doc("Print Format", "v4 gst")
    with open("/home/sri/.gemini/antigravity-ide/brain/8ff9633c-7619-4829-adb8-f85091afbb05/scratch/v4_gst.html", "w") as f:
        f.write(pf.html or "")
    print("Exported v4 gst, len:", len(pf.html or ""))
