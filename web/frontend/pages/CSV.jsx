import React, { useState, useEffect } from "react";
import "./OrdersCSV.css";
import * as XLSX from "xlsx";

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

// ===== Additional CSV headers =====
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

// Constants — update these if your rules change
const SHOPIFY_FEE_RATE = 0.04; // 4% total shopify fee (as you said)
const PAYMENT_PROVIDER_FEE = 0; // set to 0 if you don't have provider fee per line
const COMODO_COMMISSION_RATE = 0.30; // 30%
const IMMEDIATE_PAYOUT_SHARE = 0.75; // 75%
const HOLDBACK_SHARE = 0.25; // 25%
const HOLDBACK_DAYS = 14; // holdback release after 14 days from immediate payout date

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

// create rows for a single order (one row per line item)
function buildRowsForOrder(order) {
  const rows = [];
  const orderDate = order.shopify_created_at || order.processed_at || order.createdAt;
  const paymentDate = order.processed_at || order.shopify_created_at || order.createdAt;

  order.line_items.forEach((li) => {
    const lineGross = (parseFloat(li.price || li.line_price || li.total || 0) * (li.quantity || 1)) || 0;

    const shopifyFee = +(lineGross * SHOPIFY_FEE_RATE).toFixed(2);
    const paymentProviderFee = PAYMENT_PROVIDER_FEE; // if you have per-line provider fee, compute here
    const totalShopifyFees = +(shopifyFee + paymentProviderFee).toFixed(2);

    const netAfterShopify = +(lineGross - totalShopifyFees).toFixed(2);

    const comodoCommissionAmount = +(netAfterShopify * COMODO_COMMISSION_RATE).toFixed(2);
    const merchantRevenue = +(netAfterShopify - comodoCommissionAmount).toFixed(2);

    const immediatePayout = +(merchantRevenue * IMMEDIATE_PAYOUT_SHARE).toFixed(2);
    const holdbackAmount = +(merchantRevenue * HOLDBACK_SHARE).toFixed(2);

    // determine payout dates
    const scheduledPayoutDate = formatDateISO(orderDate); // use orderDate as scheduled payout date placeholder
    const holdbackStartDate = scheduledPayoutDate; // per your rule: holdback start counted from first (75%) payout date
    const holdbackReleaseDateObj = addDays(holdbackStartDate, HOLDBACK_DAYS);
    const holdbackReleaseDate = formatDateISO(holdbackReleaseDateObj);

    // determine payout status using current date
    const now = new Date();
    const actualPayoutDate = (new Date(holdbackReleaseDateObj) <= now) ? holdbackReleaseDate : "";
    const payoutStatus = actualPayoutDate ? "released" : "pending";

    // build a payout batch id (placeholder — replace with real batch logic if you have)
    const payoutBatchId = `batch-${order.order_number || order.order_name || order._id}-${scheduledPayoutDate}`;
    rows.push([
      `${order.shopify_order_id || order.order_number || order._id}`,
      formatDateISO(orderDate),
      formatDateISO(paymentDate),
      li.id || li.line_item_id || `${li.variant_id}` || "",
      li.title || li.product_name || "",
      li.quantity || 1,
      li.vendor || li.vendor_display_name || (order.vendor || ""),
      li.vendor_internal_id || li.vendor_id || "",
      lineGross.toFixed(2),
      shopifyFee.toFixed(2),
      paymentProviderFee.toFixed(2),
      totalShopifyFees.toFixed(2),
      netAfterShopify.toFixed(2),
      `${(COMODO_COMMISSION_RATE * 100).toFixed(0)}%`,
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

// ===== Build payout summary (grouped by vendor) =====
function buildPayoutSummaryRows(order) {
  const map = {};
  const orderDate = order.shopify_created_at || order.processed_at || order.createdAt;
  const payoutPeriodStart = formatDateISO(orderDate);
  const payoutPeriodEnd = formatDateISO(addDays(payoutPeriodStart, HOLDBACK_DAYS));

  order.line_items.forEach((li) => {
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

    const lineGross = (parseFloat(li.price || 0) * (li.quantity || 1)) || 0;
    const shopifyFee = +(lineGross * SHOPIFY_FEE_RATE).toFixed(2);
    const netAfterShopify = lineGross - shopifyFee;
    const commission = +(netAfterShopify * COMODO_COMMISSION_RATE).toFixed(2);
    const merchantRevenue = netAfterShopify - commission;

    const immediate = +(merchantRevenue * IMMEDIATE_PAYOUT_SHARE).toFixed(2);
    const holdback = +(merchantRevenue * HOLDBACK_SHARE).toFixed(2);

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

// ===== Vendor mapping rows =====
function buildVendorMappingRows(order) {
  const seen = new Set();
  const rows = [];

  order.line_items.forEach(li => {
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


function OrdersCSV() {
  const [data, setData] = useState([]);
  const [store, setStore] = useState("");
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("daily");
  const [selectedOrders, setSelectedOrders] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedOrder, setExpandedOrder] = useState(null);

  console.log(data, "<<<< data ")

  useEffect(() => {
    fetch("/api/getShop")
      .then(res => res.json())
      .then(d => setStore(d.domain))
      .catch(() => setStore(""));
  }, []);

  useEffect(() => {
    if (!store) return;
    // keep your shopify_store_id logic — update this string if needed
    fetch(`/api/getShopifyOrder?shopify_store_id=${"developer-12799.myshopify.com"}`)
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

  const generateOrderCSV = (order) => {
    // 1) build each sheet's rows (these helper functions already exist in your file)
    const detailRows = buildRowsForOrder(order); // returns array of arrays (line item rows)
    const summaryRows = buildPayoutSummaryRows(order); // returns array of arrays
    const vendorRows = buildVendorMappingRows(order); // returns array of arrays

    // 2) prepend headers for each sheet
    const detailAoA = [CSV_HEADERS, ...detailRows];
    const summaryAoA = [PAYOUT_SUMMARY_HEADERS, ...summaryRows];
    const vendorAoA = [VENDOR_MAPPING_HEADERS, ...vendorRows];

    // 3) create workbook and sheets
    const wb = XLSX.utils.book_new();

    // Use sheet names with ORDER ID included (as you requested)
    const orderSuffix = `${order.order_number || order._id}`;

    const sheetName1 = `merchant_payout_details-${orderSuffix}`.slice(0, 31); // Excel sheet name limit protection
    const sheetName2 = `payout_summary-${orderSuffix}`.slice(0, 31);
    const sheetName3 = `vendor_mapping-${orderSuffix}`.slice(0, 31);

    const ws1 = XLSX.utils.aoa_to_sheet(detailAoA);
    XLSX.utils.book_append_sheet(wb, ws1, sheetName1);

    const ws2 = XLSX.utils.aoa_to_sheet(summaryAoA);
    XLSX.utils.book_append_sheet(wb, ws2, sheetName2);

    const ws3 = XLSX.utils.aoa_to_sheet(vendorAoA);
    XLSX.utils.book_append_sheet(wb, ws3, sheetName3);

    // 4) write file (single xlsx with 3 sheets)
    const filename = `payouts-${orderSuffix}.xlsx`;
    XLSX.writeFile(wb, filename);
  };


  // Export CSV for selected orders (flatten to line-item rows)
  const generateSelectedCSV = () => {
    const rows = Array.from(selectedOrders).flatMap(id => {
      const o = data.find(x => x._id === id || x.shopify_order_id === id);
      return o ? buildRowsForOrder(o) : [];
    });

    downloadCSV(CSV_HEADERS, rows, `orders-selected.csv`);
  };

  // Export CSV for current timeRange (all filtered orders transformed to line items)
  const generateTimeRangeCSV = () => {
    const rows = data.flatMap(o => buildRowsForOrder(o));
    downloadCSV(CSV_HEADERS, rows, `orders-${timeRange}.csv`);
  };

  /* ---------------- UI HELPERS (unchanged) ---------------- */

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