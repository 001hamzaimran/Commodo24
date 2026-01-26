import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import "./SettingsPage.css";

const SettingsPage = () => {
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({
        ShopifyFeeRate: 4,
        PaymentProviderFee: 0,
        comodoCommissionRate: 30,
        immediatePayoutShare: 75,
        holdBackShare: 25,
        holdBackDays: 14,
    });
    const [domain, setDomain] = useState("");
    const [loader, setLoader] = useState(false);

    useEffect(() => {
        fetch("/api/getShop")
            .then(res => res.json())
            .then(data => setDomain(data.domain))
            .catch(() => setDomain(""));
    }, []);

    useEffect(() => {
        if (!domain) return;

        const fetchSettings = async () => {
            try {
                const res = await fetch("/api/getSettings", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ domain }),
                });
                const data = await res.json();
                if (res.ok && data.store) {
                    const s = data.store;
                    setForm({
                        ShopifyFeeRate: s.ShopifyFeeRate ?? 4,
                        PaymentProviderFee: s.PaymentProviderFee ?? 0,
                        comodoCommissionRate: s.comodoCommissionRate ?? 30,
                        immediatePayoutShare: s.immediatePayoutShare ?? 75,
                        holdBackShare: s.holdBackShare ?? 25,
                        holdBackDays: s.holdBackDays ?? 14,
                    });
                } else {
                    toast.error(data.message || "Failed to fetch settings");
                }
            } catch (err) {
                console.log(err);
                toast.error("Error fetching settings");
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, [domain]);

    const handleChange = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const saveSettings = async () => {
        try {
            setLoader(true);
            const payload = { domain, ...form };

            const res = await fetch("/api/createSettings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            const s = data.store;
            setForm({
                ShopifyFeeRate: s.ShopifyFeeRate ?? 4,
                PaymentProviderFee: s.PaymentProviderFee ?? 0,
                comodoCommissionRate: s.comodoCommissionRate ?? 30,
                immediatePayoutShare: s.immediatePayoutShare ?? 75,
                holdBackShare: s.holdBackShare ?? 25,
                holdBackDays: s.holdBackDays ?? 14,
            });

            if (res.ok) toast.success("Settings saved successfully");
            else toast.error(data.message || "Failed to save settings");
        } catch (err) {
            console.log(err);
            toast.error("An error occurred while saving settings");
        } finally {
            setLoader(false);
        }
    };

    if (loading) {
        return (
            <div className="loading-overlay">
                <div className="spinner"></div>
                <p>Loading settings...</p>
            </div>
        );
    }

    return (
        <div className="settings-app">
            <header className="app-header">
                <h1>Settings</h1>
                <span>Payout & Fees Configuration</span>
            </header>

            <div className="settings-card">
                <div className="settings-grid">
                    <label>
                        <span>Shopify Fee Rate (%)</span>
                        <input
                            type="number"
                            value={form.ShopifyFeeRate}
                            onChange={e => handleChange("ShopifyFeeRate", +e.target.value)}
                        />
                    </label>

                    <label>
                        <span>Payment Provider Fee</span>
                        <input
                            type="number"
                            value={form.PaymentProviderFee}
                            onChange={e => handleChange("PaymentProviderFee", +e.target.value)}
                        />
                    </label>

                    <label>
                        <span>Comodo Commission Rate (%)</span>
                        <input
                            type="number"
                            value={form.comodoCommissionRate}
                            onChange={e => handleChange("comodoCommissionRate", +e.target.value)}
                        />
                    </label>

                    <label>
                        <span>Immediate Payout Share (%)</span>
                        <input
                            type="number"
                            value={form.immediatePayoutShare}
                            onChange={e => handleChange("immediatePayoutShare", +e.target.value)}
                        />
                    </label>

                    <label>
                        <span>Holdback Share (%)</span>
                        <input
                            type="number"
                            value={form.holdBackShare}
                            onChange={e => handleChange("holdBackShare", +e.target.value)}
                        />
                    </label>

                    <label>
                        <span>Holdback Days</span>
                        <input
                            type="number"
                            value={form.holdBackDays}
                            onChange={e => handleChange("holdBackDays", +e.target.value)}
                        />
                    </label>
                </div>

                <button className="primary save-btn" onClick={saveSettings}>
                    {loader ? "Saving..." : "Save Settings"}
                </button>
            </div>
        </div>
    );
};

export default SettingsPage;
