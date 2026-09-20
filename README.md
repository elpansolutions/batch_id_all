# Universal Batch ID Manager (`batch_id_all`)

Enables identical physical batch numbers (e.g. `5678`) across multiple products in ERPNext without primary key conflicts.

## Key Features
- Adds `custom_batch_id_all` to `Batch` and all standard transaction child tables (Purchase Invoice, Sales Invoice, Delivery Note, Purchase Order, Sales Order, Stock Entry, Stock Reconciliation).
- Automatic Contradiction Resolution: If a batch with the same physical ID already exists for another product, internally assigns `{batch_id_all}-{item_code}` to prevent `DuplicateEntryError`, while maintaining `custom_batch_id_all = 5678`.
- Propagates and synchronizes `custom_batch_id_all` across all transactions and print formats.
