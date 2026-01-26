import React, { useState, useEffect } from "react";
import "./OrdersCSV.css";
import * as XLSX from "xlsx";
import { toast } from "react-toastify";

const CSV_HEADERS = [
  "order_id",
  "order_date",
  "payment_date",
  "line_item_id",
  "product_name",
  "quantity",
  "vendor_display_name",
  "vendor_internal_id",
  "line_gross_amount",
  "shopify_transaction_fee",
  "payment_provider_fee",
  "total_shopify_fees",
  "net_amount_after_shopify_fees",
  "comodo24_commission_rate",
  "comodo24_commission_amount",
  "merchant_revenue_after_commission",
  "immediate_payout_amount",
  "holdback_amount",
  "holdback_start_date",
  "holdback_release_date",
  "payout_status",
  "scheduled_payout_date",
  "actual_payout_date",
  "payout_batch_id"
];

const PAYOUT_SUMMARY_HEADERS = [
  "payout_batch_id",
  "vendor_internal_id",
  "vendor_display_name",
  "payout_period_start",
  "payout_period_end",
  "total_orders",
  "total_immediate_payout",
  "total_holdback_released",
  "total_payout_amount",
  "payout_status",
  "payout_date"
];

const VENDOR_MAPPING_HEADERS = [
  "vendor_internal_id",
  "vendor_display_name",
  "notes"
];

function formatDateISO(d) {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toISOString().split("T")[0];
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d;
}

function downloadCSV(headers, rows, name) {
  const csv = [
    headers.join(","),
    ...rows.map((r) => r.map((c) => `"${(c ?? "").toString().replace(/"/g, '""')}"`).join(","))
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
}

function OrdersCSV() {
  const [data, setData] = useState([]);
  const [store, setStore] = useState("");
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("daily");
  const [selectedOrders, setSelectedOrders] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedOrder, setExpandedOrder] = useState(null);

  // defaults -> these act as fallback if settings aren't present
  const [form, setForm] = useState({
    ShopifyFeeRate: 4,           // percent
    PaymentProviderFee: 0,       // absolute value per line (currency)
    comodoCommissionRate: 30,    // percent
    immediatePayoutShare: 75,    // percent
    holdBackShare: 25,           // percent
    holdBackDays: 14,            // days
  });

  // Derived rates object (pass this to helpers)
  const rates = {
    shopifyFeeRate: (form?.ShopifyFeeRate ?? 4) / 100,
    paymentProviderFee: Number(form?.PaymentProviderFee ?? 0),
    comodoCommissionRate: (form?.comodoCommissionRate ?? 30) / 100,
    immediatePayoutShare: (form?.immediatePayoutShare ?? 75) / 100,
    holdbackShare: (form?.holdBackShare ?? 25) / 100,
    holdbackDays: Number(form?.holdBackDays ?? 14)
  };

  /* ---------------- HELPERS (use `rates` for calculations) ---------------- */

  function buildRowsForOrder(order, ratesObj) {
    // ensure ratesObj exists
    const {
      shopifyFeeRate = 0.04,
      paymentProviderFee = 0,
      comodoCommissionRate = 0.30,
      immediatePayoutShare = 0.75,
      holdbackShare = 0.25,
      holdbackDays = 14
    } = ratesObj || {};

    const rows = [];
    const orderDate = order.shopify_created_at || order.processed_at || order.createdAt;
    const paymentDate = order.processed_at || order.shopify_created_at || order.createdAt;

    (order.line_items || []).forEach((li) => {
      const qty = li.quantity || 1;
      const unitPrice = parseFloat(li.price ?? li.line_price ?? li.total ?? 0) || 0;
      const lineGross = +(unitPrice * qty).toFixed(2);

      const shopifyFee = +(lineGross * shopifyFeeRate).toFixed(2);
      const ppFee = +Number(paymentProviderFee).toFixed(2);
      const totalShopifyFees = +(shopifyFee + ppFee).toFixed(2);

      const netAfterShopify = +(lineGross - totalShopifyFees).toFixed(2);
      const comodoCommissionAmount = +(netAfterShopify * comodoCommissionRate).toFixed(2);
      const merchantRevenue = +(netAfterShopify - comodoCommissionAmount).toFixed(2);

      const immediatePayout = +(merchantRevenue * immediatePayoutShare).toFixed(2);
      const holdbackAmount = +(merchantRevenue * holdbackShare).toFixed(2);

      // payout dates
      const scheduledPayoutDate = formatDateISO(orderDate);
      const holdbackStartDate = scheduledPayoutDate;
      const holdbackReleaseDateObj = addDays(holdbackStartDate, holdbackDays);
      const holdbackReleaseDate = formatDateISO(holdbackReleaseDateObj);

      const now = new Date();
      const actualPayoutDate = (new Date(holdbackReleaseDateObj) <= now) ? holdbackReleaseDate : "";
      const payoutStatus = actualPayoutDate ? "released" : "pending";

      const payoutBatchId = `batch-${order.order_number || order.order_name || order._id}-${scheduledPayoutDate}`;

      rows.push([
        `${order.shopify_order_id || order.order_number || order._id}`,
        formatDateISO(orderDate),
        formatDateISO(paymentDate),
        li.id || li.line_item_id || `${li.variant_id}` || "",
        li.title || li.product_name || "",
        qty,
        li.vendor || li.vendor_display_name || (order.vendor || ""),
        li.vendor_internal_id || li.vendor_id || "",
        lineGross.toFixed(2),
        shopifyFee.toFixed(2),
        ppFee.toFixed(2),
        totalShopifyFees.toFixed(2),
        netAfterShopify.toFixed(2),
        `${(comodoCommissionRate * 100).toFixed(0)}%`,
        comodoCommissionAmount.toFixed(2),
        merchantRevenue.toFixed(2),
        immediatePayout.toFixed(2),
        holdbackAmount.toFixed(2),
        holdbackStartDate,
        holdbackReleaseDate,
        payoutStatus,
        scheduledPayoutDate,
        actualPayoutDate,
        payoutBatchId
      ]);
    });

    return rows;
  }

  function buildPayoutSummaryRows(order, ratesObj) {
    const {
      shopifyFeeRate = 0.04,
      comodoCommissionRate = 0.30,
      immediatePayoutShare = 0.75,
      holdbackShare = 0.25,
      holdbackDays = 14
    } = ratesObj || {};

    const map = {};
    const orderDate = order.shopify_created_at || order.processed_at || order.createdAt;
    const payoutPeriodStart = formatDateISO(orderDate);
    const payoutPeriodEnd = formatDateISO(addDays(payoutPeriodStart, holdbackDays));

    (order.line_items || []).forEach((li) => {
      const vendorId = li.vendor_internal_id || li.vendor_id || "";
      const vendorName = li.vendor || li.vendor_display_name || "";

      if (!map[vendorId]) {
        map[vendorId] = {
          vendor_internal_id: vendorId,
          vendor_display_name: vendorName,
          total_orders: new Set(),
          total_immediate_payout: 0,
          total_holdback_released: 0,
          payout_batch_id: `batch-${order.order_number || order._id}-${payoutPeriodStart}`
        };
      }

      const qty = li.quantity || 1;
      const unitPrice = parseFloat(li.price ?? 0) || 0;
      const lineGross = +(unitPrice * qty).toFixed(2);

      const shopifyFee = +(lineGross * shopifyFeeRate).toFixed(2);
      const netAfterShopify = +(lineGross - shopifyFee).toFixed(2);
      const commission = +(netAfterShopify * comodoCommissionRate).toFixed(2);
      const merchantRevenue = +(netAfterShopify - commission).toFixed(2);

      const immediate = +(merchantRevenue * immediatePayoutShare).toFixed(2);
      const holdback = +(merchantRevenue * holdbackShare).toFixed(2);

      map[vendorId].total_orders.add(order.shopify_order_id || order._id);
      map[vendorId].total_immediate_payout += immediate;
      map[vendorId].total_holdback_released += holdback;
    });

    return Object.values(map).map(v => {
      const totalOrders = v.total_orders.size;
      const totalPayout = +(v.total_immediate_payout + v.total_holdback_released).toFixed(2);

      return [
        v.payout_batch_id,
        v.vendor_internal_id,
        v.vendor_display_name,
        payoutPeriodStart,
        payoutPeriodEnd,
        totalOrders,
        v.total_immediate_payout.toFixed(2),
        v.total_holdback_released.toFixed(2),
        totalPayout.toFixed(2),
        "pending",
        payoutPeriodEnd
      ];
    });
  }

  function buildVendorMappingRows(order) {
    const seen = new Set();
    const rows = [];
    (order.line_items || []).forEach(li => {
      const vendorId = li.vendor_internal_id || li.vendor_id || "";
      if (seen.has(vendorId)) return;
      seen.add(vendorId);

      rows.push([
        vendorId,
        li.vendor || li.vendor_display_name || "",
        ""
      ]);
    });
    return rows;
  }

  /* ---------------- EFFECTS ---------------- */

  // 1) fetch store domain (from your backend)
  useEffect(() => {
    fetch("/api/getShop")
      .then(res => res.json())
      .then(d => setStore(d.domain || ""))
      .catch(() => setStore(""));
  }, []);

  // 2) fetch settings for current store (POST with { domain })
  useEffect(() => {
    if (!store) return;

    const fetchSettings = async () => {
      try {
        const res = await fetch("/api/getSettings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain: store }),
        });

        const payload = await res.json();

        if (res.ok && payload.store) {
          const s = payload.store;
          setForm({
            ShopifyFeeRate: s.ShopifyFeeRate ?? 4,
            PaymentProviderFee: s.PaymentProviderFee ?? 0,
            comodoCommissionRate: s.comodoCommissionRate ?? 30,
            immediatePayoutShare: s.immediatePayoutShare ?? 75,
            holdBackShare: s.holdBackShare ?? 25,
            holdBackDays: s.holdBackDays ?? 14,
          });
        } else {
          // don't panic — keep defaults, but show a small toast so user knows
          toast.warn(payload.message || "No settings found — using defaults");
        }
      } catch (err) {
        console.error("Error fetching settings:", err);
        toast.error("Error fetching settings (network/server)");
      }
    };

    fetchSettings();
  }, [store]);

  // 3) fetch orders
  useEffect(() => {
    if (!store) return;
    fetch(`/api/getShopifyOrder?shopify_store_id=developer-12799.myshopify.com`)
      .then(res => res.json())
      .then(d => {
        setData(d.orders || []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [store]);

  /* ---------------- CSV / XLSX GENERATION ---------------- */

  const generateOrderCSV = (order) => {
    const detailRows = buildRowsForOrder(order, rates);
    const summaryRows = buildPayoutSummaryRows(order, rates);
    const vendorRows = buildVendorMappingRows(order);

    const wb = XLSX.utils.book_new();
    const orderSuffix = `${order.order_number || order._id}`;
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([CSV_HEADERS, ...detailRows]), `merchant_payout_details-${orderSuffix}`.slice(0, 31));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([PAYOUT_SUMMARY_HEADERS, ...summaryRows]), `payout_summary-${orderSuffix}`.slice(0, 31));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([VENDOR_MAPPING_HEADERS, ...vendorRows]), `vendor_mapping-${orderSuffix}`.slice(0, 31));

    XLSX.writeFile(wb, `payouts-${orderSuffix}.xlsx`);
  };

  const generateSelectedCSV = () => {
    const rows = Array.from(selectedOrders).flatMap(id => {
      const o = data.find(x => x._id === id || x.shopify_order_id === id);
      return o ? buildRowsForOrder(o, rates) : [];
    });

    downloadCSV(CSV_HEADERS, rows, `orders-selected.csv`);
  };

  const generateTimeRangeCSV = () => {
    const rows = data.flatMap(o => buildRowsForOrder(o, rates));
    downloadCSV(CSV_HEADERS, rows, `orders-${timeRange}.csv`);
  };

  /* ---------------- UI HELPERS ---------------- */

  const toggleSelect = (id) => {
    const s = new Set(selectedOrders);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelectedOrders(s);
  };

  const toggleSelectAll = () => {
    selectedOrders.size === data.length
      ? setSelectedOrders(new Set())
      : setSelectedOrders(new Set(data.map(o => o._id)));
  };

  const filteredOrders = data.filter(o =>
    o.order_number.toString().includes(searchTerm) ||
    (o.customer && o.customer.email && o.customer.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (o.customer && o.customer.first_name && o.customer.first_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (o.customer && o.customer.last_name && o.customer.last_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (o.shipping_address && o.shipping_address.city && o.shipping_address.city.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) return <div className="loader">Loading orders…</div>;

  return (
    <div className="orders-app">
      <header className="app-header">
        <h1>Orders (detailed CSV)</h1>
        <span>{store}</span>
      </header>

      <div className="controls">
        <div className="control-group">
          <select
            id="timeRange"
            value={timeRange}
            onChange={e => setTimeRange(e.target.value)}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="annually">Annually</option>
          </select>
        </div>

        <button className="primary export-btn" onClick={generateTimeRangeCSV}>
          Export {timeRange} 📤
        </button>

        <div className="control-group search-group">
          <input
            type="text"
            placeholder="Search orders..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          <span className="search-icon">🔍</span>
        </div>
      </div>

      {selectedOrders.size > 0 && (
        <div className="bulk">
          <span>{selectedOrders.size} selected</span>
          <button onClick={generateSelectedCSV}>Export Selected</button>
        </div>
      )}

      <div className="orders">
        <div className="orders-head">
          <input
            type="checkbox"
            checked={selectedOrders.size === data.length}
            onChange={toggleSelectAll}
          />
          <span>{filteredOrders.length} orders</span>
        </div>

        {filteredOrders.map(order => (
          <div key={order._id} className="order-card">
            <div className="order-row">
              <input
                type="checkbox"
                checked={selectedOrders.has(order._id)}
                onChange={() => toggleSelect(order._id)}
              />

              <div>
                <b>#{order.order_number}</b>
                <small>{order.customer && order.customer.email}</small>
              </div>

              <div>${order.total_price}</div>

              <button onClick={() =>
                setExpandedOrder(expandedOrder === order._id ? null : order._id)
              }>
                Details
              </button>

              <button onClick={() => generateOrderCSV(order)}>
                CSV
              </button>
            </div>

            <div className={`order-details ${expandedOrder === order._id ? "open" : ""}`}>
              <div className="details-header">
                <h3>Order Details</h3>
                <span className={`badge ${order.payment_status && order.payment_status.toLowerCase()}`}>
                  {order.payment_status}
                </span>
              </div>

              <div className="details-grid">
                <p><span>Name</span>{order.customer && order.customer.first_name} {order.customer && order.customer.last_name}</p>
                <p><span>Phone</span>{order.customer && order.customer.phone || "N/A"}</p>
                <p><span>City</span>{order.shipping_address && order.shipping_address.city}</p>
                <p><span>Status</span>{order.status}</p>
              </div>

              <div className="items">
                <h4>Items</h4>
                {order.line_items.map((i, idx) => (
                  <div key={idx} className="item-row">
                    <span>{i.title}</span>
                    <span>{i.quantity} × ${i.price}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default OrdersCSV;
