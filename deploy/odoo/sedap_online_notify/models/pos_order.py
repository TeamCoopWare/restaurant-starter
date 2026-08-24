from odoo import models, api

from . import kitchen_printer


class PosOrder(models.Model):
    _inherit = "pos.order"

    @api.model_create_multi
    def create(self, vals_list):
        orders = super().create(vals_list)
        for order in orders:
            # Only online/self orders (website checkout sets source="mobile").
            if order.source not in ("mobile", "kiosk") or not order.config_id:
                continue

            # Build the kitchen ticket(s) once so we can both (a) try a direct
            # server-side print (works only when Odoo shares the LAN) and (b) hand
            # them to the POS terminal to print (works when Odoo is off-site/cloud).
            try:
                targets = kitchen_printer.build_targets(order)
            except Exception:
                targets = []

            # 1) On-screen popup + sound in the open POS, AND the tickets for the
            #    terminal to print (the terminal is on the shop LAN → reaches the
            #    printer; the cloud server cannot).
            try:
                order.config_id._notify("SEDAP_ONLINE_ORDER", {
                    "reference": order.pos_reference or order.name or "",
                    "amount": order.amount_total,
                    "partner": order.partner_id.name or "",
                    "preset_time": str(order.preset_time or ""),
                    "order_id": order.id,
                    "epos": targets,
                })
            except Exception:
                # A notification failure must never block order creation.
                pass

            # 2) Legacy direct server-side print (harmless no-op on cloud).
            try:
                kitchen_printer.send_kitchen_ticket(order)
            except Exception:
                pass

        return orders
