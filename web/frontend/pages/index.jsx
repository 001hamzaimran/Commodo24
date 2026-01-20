import React, { useEffect } from "react";
import "./Home.css";
import { Link } from "react-router-dom";

function index() {
  const fetchStore = async () => {
    try {
      const response = await fetch("/api/getShop");
      const data = await response.json();
      console.log(data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchStore();
  }, []);

  return (
    <div className="home-app">
      <div className="home-container">
        <h1 className="app-name">Commodo24</h1>
        <p className="app-tagline">
          Welcome! Generate CSV for each order and get full tracking of your
          Shopify orders.
        </p>
        <Link to="/CSV" className="cta-btn">Get Started</Link>
      </div>
    </div>
  );
}

export default index;
