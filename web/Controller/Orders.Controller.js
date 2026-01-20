
import ShopifyOrder from "../Model/Orders.Model.js";
import shopify from "../shopify.js";

export const createShopifyOrder = async (payload, shop) => {
    try {
        const order = payload;

        // Save order to DB (unchanged)
        const savedOrder = await ShopifyOrder.create({
            shopify_store_id: shop,
            shopify_order_id: order.id,
            shopify_graphql_id: order.admin_graphql_api_id,
            order_number: order.order_number,
            order_name: order.name,
            confirmation_number: order.confirmation_number,
            token: order.token,
            payment_gateway: order.payment_gateway_names,
            payment_status: order.financial_status === "paid" ? "paid" : "pending",
            financial_status: order.financial_status,
            total_price: order.total_price,
            subtotal_price: order.subtotal_price,
            total_tax: order.total_tax,
            total_discounts: order.total_discounts,
            currency: order.currency,
            presentment_currency: order.presentment_currency,
            total_price_set: order.total_price_set,
            fulfillment_status: order.fulfillment_status,
            customer: {
                shopify_customer_id: order.customer?.id,
                email: order.customer?.email,
                first_name: order.customer?.first_name,
                last_name: order.customer?.last_name,
                phone: order.customer?.phone
            },
            shipping_address: order.shipping_address,
            billing_address: order.billing_address,
            line_items: order.line_items.map(item => ({
                shopify_line_item_id: item.id,
                product_id: item.product_id,
                variant_id: item.variant_id,
                title: item.title,
                price: item.price,
                quantity: item.quantity,
                vendor: item.vendor,
                fulfillment_status: item.fulfillment_status,
                fulfillment_service: item.fulfillment_service
            })),
            test_order: order.test,
            confirmed: order.confirmed,
            source_name: order.source_name,
            browser_ip: order.browser_ip,
            landing_site: order.landing_site,
            referring_site: order.referring_site,
            shopify_created_at: order.created_at,
            shopify_updated_at: order.updated_at,
            processed_at: order.processed_at
        });

        return {
            success: true,
            order: savedOrder,
        };

    } catch (error) {
        console.error("createShopifyOrder error:", error);

        // More detailed error logging
        if (error.response) {
            console.error("Error response status:", error.response.code || error.response.status);
            console.error("Error response body:", JSON.stringify(error.response.body, null, 2));
            console.error("Error response headers:", error.response.headers);
        }

        if (error instanceof shopify.api.clients.HttpResponseError) {
            console.error("HttpResponseError details:", {
                code: error.code,
                statusText: error.statusText,
                body: error.body
            });
        }

        return { success: false, error: error.message };
    }
};

export const getShopifyOrder = async (req, res) => {
    try {
        const { shopify_store_id } = req.query;

        const orders = await ShopifyOrder.find({ shopify_store_id });

        if (!orders) {
            return res.status(404).json({ error: "Orders not found", success: false });
        }

        return res.status(200).json({ orders, success: true });
    } catch (error) {
        console.error("getShopifyOrder error:", error);
        return res.status(500).json({ error: error.message, success: false });
    }
}