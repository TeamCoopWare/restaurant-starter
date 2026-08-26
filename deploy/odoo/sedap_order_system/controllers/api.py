from odoo import http
from odoo.http import request
import json
from collections import defaultdict

class SedapAPI(http.Controller):

    @http.route('/api/menu', type='http', auth='public', methods=['GET'], csrf=False, cors='*')
    def get_menu(self):
        # `sedap_online_available` is the owner's website-only switch (see
        # models/product_template.py). Unticking it hides the product here
        # while it stays sellable at the in-store till. Filtering through
        # product_tmpl_id keeps the domain unambiguous on the variant model.
        products = request.env['product.product'].sudo().search([
            ('available_in_pos', '=', True),
            ('product_tmpl_id.sedap_online_available', '=', True),
        ])

        grouped = defaultdict(list)
        template_ids = {}
        template_has_image = {}

        for p in products:
            template_name = p.product_tmpl_id.name
            template_ids.setdefault(template_name, p.product_tmpl_id.id)
            if template_name not in template_has_image:
                template_has_image[template_name] = bool(p.product_tmpl_id.image_128)

            variant_name = p.display_name.replace(template_name, '').strip()
            if variant_name.startswith('(') and variant_name.endswith(')'):
                variant_name = variant_name[1:-1]

            if "Add-ons:" in variant_name:
               variant_name = variant_name.replace("Add-ons:", "").strip()

            if not variant_name:
               variant_name = "Standard"

            grouped[template_name].append({
                'product_id': p.id,
                'variant': variant_name,
                'price': p.lst_price,
                'product_tmpl_id': p.product_tmpl_id.id,
            })

        result = []

        for template, variants in grouped.items():
            result.append({
                'name': template,
                'template_id': template_ids.get(template),
                'has_image': template_has_image.get(template, False),
                'variants': variants,
            })

        return request.make_response(
            json.dumps(result),
            headers=[('Content-Type', 'application/json')]
        )

    @http.route('/api/create_order', type='json', auth='public', methods=['POST'], csrf=False, cors='*')
    def create_order(self, **data):
        try:
            items = data.get('items', [])

            partner = request.env['res.partner'].sudo().search([], limit=1)

            sale_order = request.env['sale.order'].sudo().create({
                'partner_id': partner.id,
            })

            for item in items:
                request.env['sale.order.line'].sudo().create({
                    'order_id': sale_order.id,
                    'product_id': item['product_id'],
                    'product_uom_qty': item['qty'],
                    'price_unit': item['price'],
                })

            return {
                'status': 'success',
                'order_id': sale_order.id,
                'amount': sale_order.amount_total
            }

        except Exception as e:
            return{
                'status': 'error',
                'message': str(e)
            }
