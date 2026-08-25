import html
import logging
import threading

import requests

from odoo import fields

_logger = logging.getLogger(__name__)
_EPOS_NS = "http://www.epson-pos.com/schemas/2011/03/epos-print"


def _esc(value):
    return html.escape("" if value is None else str(value), quote=False)


def _build_ticket_xml(header_lines, item_lines):
    """Epson ePOS-Print XML for a simple kitchen ticket."""
    parts = [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>',
        '<epos-print xmlns="%s">' % _EPOS_NS,
        # Small, centered "online" marker so staff can tell it apart at a glance.
        '<text align="center"/><text>*** ONLINE ORDER ***&#10;</text>',
        '<text align="left"/>',
    ]
    for line in header_lines:
        parts.append("<text>%s&#10;</text>" % _esc(line))
    parts.append('<text>--------------------------------&#10;</text><text align="left"/>')
    for qty, name in item_lines:
        parts.append('<text dw="true" dh="true">%s x %s&#10;</text>' % (_esc(qty), _esc(name)))
    parts.append('<feed line="3"/><cut type="feed"/></epos-print></s:Body></s:Envelope>')
    return "".join(parts)


def _order_header(order):
    ref = order.pos_reference or order.name or ""
    header = [ref]
    if order.partner_id.name:
        header.append(order.partner_id.name)
    if order.preset_time:
        try:
            # Force the shop timezone so the printed pickup time always matches
            # the POS, regardless of the API user's personal timezone setting.
            rec = order.with_context(tz="Australia/Adelaide")
            local = fields.Datetime.context_timestamp(rec, order.preset_time)
            header.append("Pickup: %s" % local.strftime("%a %d %b %H:%M"))
        except Exception:
            header.append("Pickup: %s" % order.preset_time)
    return ref, header


def build_targets(order):
    """Return a list of {"ip", "xml", "ref"} for the order's kitchen printers.

    Same routing/formatting as send_kitchen_ticket(), but returns the payloads
    instead of POSTing them. When Odoo runs OFF-SITE (cloud), the server can't
    reach a printer on the shop LAN, so the actual HTTP POST is done by the POS
    terminal (which IS on the shop LAN) — see the module's POS JS. Building the
    ticket here keeps the ORM/category routing on the server where it belongs.
    """
    config = order.config_id
    printers = config.printer_ids if config else False
    if not printers:
        return []
    ref, header = _order_header(order)
    targets = []
    for printer in printers:
        ip = printer.proxy_ip
        if not ip or printer.printer_type != "epson_epos":
            continue
        cat_ids = set(printer.product_categories_ids.ids)
        items = []
        for line in order.lines:
            if cat_ids and not (set(line.product_id.pos_categ_ids.ids) & cat_ids):
                continue  # not routed to this kitchen printer
            items.append((int(line.qty), line.product_id.display_name))
        if not items:
            continue
        targets.append({"ip": ip, "xml": _build_ticket_xml(header, items), "ref": ref})
    return targets


def _post_epos(ip, xml, ref):
    url = "http://%s/cgi-bin/epos/service.cgi?devid=local_printer&timeout=10000" % ip
    try:
        resp = requests.post(
            url, data=xml.encode("utf-8"),
            headers={"Content-Type": "text/xml; charset=utf-8"}, timeout=6,
        )
        _logger.info("[sedap] kitchen ticket %s -> %s : HTTP %s", ref, ip, resp.status_code)
    except Exception as e:
        _logger.warning("[sedap] kitchen ticket %s -> %s FAILED: %s", ref, ip, e)


def send_kitchen_ticket(order):
    """Legacy server-side print. Only works when Odoo shares the LAN with the
    printer (on-prem). On a cloud host this fails harmlessly; the POS terminal
    prints via build_targets() + the bus instead."""
    for t in build_targets(order):
        threading.Thread(target=_post_epos, args=(t["ip"], t["xml"], t["ref"]), daemon=True).start()
