
import React, { useEffect } from 'react'

function index() {
  const fetchStore = async () => {
    try {
      const response = await fetch('/api/getShop');
      const data = await response.json();
      console.log(data);
    } catch (error) {
      console.error(error);
    }
  }

  useEffect(() => {
    fetchStore();
  }, []);
  return (
    <div>index</div>
  )
}

export default index