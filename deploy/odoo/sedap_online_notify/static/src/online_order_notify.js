/** @odoo-module **/
import { patch } from "@web/core/utils/patch";
import { PosStore } from "@point_of_sale/app/services/pos_store";

patch(PosStore.prototype, {
    async setup() {
        await super.setup(...arguments);
        // Listen for online orders pushed from the website (source="mobile").
        try {
            this.data.connectWebSocket("SEDAP_ONLINE_ORDER", (payload) => {
                this._sedapOnlineOrderAlert(payload || {});
            });
        } catch (e) {
            console.error("[sedap] could not subscribe to online-order notifications", e);
        }
    },

    _sedapOnlineOrderAlert(payload) {
        const ref = payload.reference || "";
        const partner = payload.partner ? ` — ${payload.partner}` : "";
        const amount = payload.amount ? ` ($${payload.amount})` : "";
        const message = `New online order ${ref}${partner}${amount}`;

        try {
            this.notification.add(message, {
                type: "success",
                title: "🛎️ Online order received",
                sticky: true,
            });
        } catch (e) {
            console.error("[sedap] notification failed", e);
        }

        try {
            const audio = new Audio("/point_of_sale/static/src/sounds/order-receive-tone.mp3");
            audio.play().catch(() => {});
        } catch (e) {
            /* sound is best-effort */
        }

        // Print the kitchen ticket(s) FROM THIS TERMINAL. The terminal is on the
        // shop LAN, so it can reach the Epson printer (the cloud Odoo server
        // cannot). Server built the ePOS XML and sent it in payload.epos.
        try {
            const targets = Array.isArray(payload.epos) ? payload.epos : [];
            for (const t of targets) {
                if (t && t.ip && t.xml) {
                    this._sedapPrintTicket(t.ip, t.xml);
                }
            }
        } catch (e) {
            console.error("[sedap] kitchen print dispatch failed", e);
        }
    },

    async _sedapPrintTicket(ip, xml) {
        const path = "/cgi-bin/epos/service.cgi?devid=local_printer&timeout=10000";
        // Try HTTPS first (this POS is served over HTTPS, and the printer's cert
        // is already trusted here since in-person printing works), then HTTP (for
        // shops whose browser is set to allow insecure content). no-cors lets us
        // tell "sent" (resolves) from "blocked" (rejects) so we never double-print.
        for (const url of ["https://" + ip + path, "http://" + ip + path]) {
            try {
                await fetch(url, { method: "POST", body: xml, mode: "no-cors" });
                console.log("[sedap] kitchen ticket sent to printer via", url);
                return;
            } catch (e) {
                console.warn("[sedap] printer attempt failed:", url, e && e.message);
            }
        }
        console.error("[sedap] could not reach kitchen printer", ip);
    },
});
