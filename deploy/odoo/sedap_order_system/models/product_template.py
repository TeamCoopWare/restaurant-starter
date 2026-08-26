from odoo import fields, models


class ProductTemplate(models.Model):
    _inherit = "product.template"

    # Website-only availability switch for the online ordering site.
    #
    # Deliberately SEPARATE from `available_in_pos`: unticking this hides the
    # product from sedapeatery.com.au while it stays sellable at the in-store
    # till. Untick `available_in_pos` instead to remove it from both.
    #
    # Default True so every existing product stays visible after the module
    # upgrade adds this column.
    sedap_online_available = fields.Boolean(
        string="Available online",
        default=True,
        index=True,
        help="Show this product on the online ordering website "
             "(sedapeatery.com.au). Untick to hide it from customers online "
             "while still selling it at the in-store POS.",
    )
