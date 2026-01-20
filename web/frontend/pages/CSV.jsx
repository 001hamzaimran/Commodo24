import { useState, useEffect } from "react";
import "./OrdersCSV.css";

function OrdersCSV() {
  const [data, setData] = useState([]);
  const [store, setStore] = useState("");
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("daily");
  const [selectedOrders, setSelectedOrders] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedOrder, setExpandedOrder] = useState(null);

  useEffect(() => {
    fetch("/api/getShop")
      .then(res => res.json())
      .then(d => setStore(d.domain));
  }, []);

  useEffect(() => {
    if (!store) return;
    fetch(`/api/getShopifyOrder?shopify_store_id=${store}`)
      .then(res => res.json())
      .then(d => {
        setData(d.orders || []);
        setLoading(false);
      });
  }, [store]);

  /* ---------------- CSV HELPERS ---------------- */

  const downloadCSV = (headers, rows, name) => {
    const csv = [
      headers.join(","),
      ...rows.map(r => r.map(c => `"${c ?? ""}"`).join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
  };

  const generateOrderCSV = (order) => {
    downloadCSV(
      [
        "Order ID", "Order Number", "Customer", "Email", "Phone",
        "Total Price", "Status", "Payment Status", "Date",
        "Items", "Shipping Address", "Billing Address",
        "City", "Country"
      ],
      [[
        order.shopify_order_id,
        order.order_number,
        `${order.customer.first_name} ${order.customer.last_name}`,
        order.customer.email,
        order.customer.phone || "N/A",
        order.total_price,
        order.status,
        order.payment_status,
        new Date(order.shopify_created_at).toLocaleDateString(),
        order.line_items.map(i => `${i.title} (${i.quantity})`).join(" | "),
        `${order.shipping_address.address1}, ${order.shipping_address.city}`,
        `${order.billing_address.address1}, ${order.billing_address.city}`,
        order.shipping_address.city,
        order.shipping_address.country
      ]],
      `order-${order.order_number}.csv`
    );
  };

  const generateSelectedCSV = () => {
    const rows = Array.from(selectedOrders).map(id => {
      const o = data.find(x => x._id === id);
      return [
        o.shopify_order_id,
        o.order_number,
        `${o.customer.first_name} ${o.customer.last_name}`,
        o.customer.email,
        o.total_price,
        o.status,
        o.payment_status,
        new Date(o.shopify_created_at).toLocaleDateString(),
        o.shipping_address.city,
        o.shipping_address.country,
        o.line_items.length
      ];
    });

    downloadCSV(
      [
        "Order ID", "Order Number", "Customer", "Email",
        "Total Price", "Status", "Payment Status",
        "Date", "City", "Country", "Items Count"
      ],
      rows,
      "orders-selected.csv"
    );
  };

  const generateTimeRangeCSV = () => {
    const rows = data.map(o => [
      o.shopify_order_id,
      o.order_number,
      `${o.customer.first_name} ${o.customer.last_name}`,
      o.customer.email,
      o.total_price,
      o.status,
      o.payment_status,
      new Date(o.shopify_created_at).toLocaleDateString(),
      o.line_items.map(i => i.title).join(" | "),
      o.shipping_address.city
    ]);

    downloadCSV(
      [
        "Order ID", "Order Number", "Customer", "Email",
        "Total Price", "Status", "Payment Status",
        "Date", "Items", "City"
      ],
      rows,
      `orders-${timeRange}.csv`
    );
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
    o.customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.customer.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.customer.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.shipping_address.city.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="loader">Loading orders…</div>;

  return (
    <div className="orders-app">

      <header className="app-header">
        <h1>Orders</h1>
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


      <div className="stats">
        <div className="stat-card revenue">
          <div className="stat-icon">💰</div>
          <div className="stat-info">
            <b>${data.reduce((s, o) => s + +o.total_price, 0).toFixed(2)}</b>
            <span>Revenue</span>
          </div>
        </div>

        <div className="stat-card orders-count">
          <div className="stat-icon">📦</div>
          <div className="stat-info">
            <b>{data.length}</b>
            <span>Orders</span>
          </div>
        </div>

        <div className="stat-card avg">
          <div className="stat-icon">⚖️</div>
          <div className="stat-info">
            <b>{(data.reduce((s, o) => s + +o.total_price, 0) / data.length).toFixed(2)}</b>
            <span>Avg</span>
          </div>
        </div>

        <div className="stat-card items">
          <div className="stat-icon">🛒</div>
          <div className="stat-info">
            <b>{data.reduce((s, o) => s + o.line_items.reduce((i, x) => i + x.quantity, 0), 0)}</b>
            <span>Items</span>
          </div>
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
                <small>{order.customer.email}</small>
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
                <span className={`badge ${order.payment_status.toLowerCase()}`}>
                  {order.payment_status}
                </span>
              </div>

              <div className="details-grid">
                <p><span>Name</span>{order.customer.first_name} {order.customer.last_name}</p>
                <p><span>Phone</span>{order.customer.phone || "N/A"}</p>
                <p><span>City</span>{order.shipping_address.city}</p>
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
