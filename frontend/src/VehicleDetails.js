import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Lightbox from "react-simple-image-viewer";
import "./AdminDashboard.css";

function VehicleDetails({ token }) {
  const { reg } = useParams();
  const [vehicle, setVehicle] = useState(null);
  const [msg, setMsg] = useState("");
  const [photoIndex, setPhotoIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  // 🧠 Fetch vehicle details (wrapped in useCallback to fix ESLint warning)
  const fetchVehicle = useCallback(async () => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/cars/${reg}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Vehicle not found");
      setVehicle(data);
      speakDetails(data);
    } catch (err) {
      setMsg(`❌ ${err.message}`);
    }
  }, [reg]);

  // 🔁 Auto-fetch when reg changes
  useEffect(() => {
    fetchVehicle();
  }, [fetchVehicle]);

  // 🗣️ Voice synthesis: reads out details
  const speakDetails = (v) => {
    if (!window.speechSynthesis) return;
    const synth = window.speechSynthesis;
    const text = `Showing details for ${v.brand} ${v.model}, Registration ${v.reg}. 
      It is a ${v.year} model with ${v.fuel} engine and ${v.transmission} transmission. 
      The price is ₹${v.price}.`;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-IN";
    synth.speak(utter);
  };

  // ✅ Mark vehicle as sold
  const markAsSold = async () => {
    const res = await fetch(`http://127.0.0.1:8000/cars/${reg}/sold`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (res.ok) {
      setMsg("✅ Marked as sold successfully!");
      setVehicle({ ...vehicle, is_sold: true });
    } else setMsg(`❌ ${data.detail}`);
  };

  // 🗑️ Delete vehicle
  const deleteVehicle = async () => {
    if (!window.confirm("Are you sure you want to delete this vehicle?")) return;
    const res = await fetch(`http://127.0.0.1:8000/cars/${reg}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (res.ok) {
      setMsg("🗑️ Vehicle deleted successfully!");
      setTimeout(() => navigate("/dashboard"), 1500);
    } else setMsg(`❌ ${data.detail}`);
  };

  if (!vehicle)
    return <p className="loading">Loading vehicle details...</p>;

  const images = vehicle.images?.map((img) => `http://127.0.0.1:8000${img}`);

  return (
    <div className="dashboard-container">
      {/* 🔙 Back Button */}
      <button className="back-btn" onClick={() => navigate("/dashboard")}>
        ← Back to Dashboard
      </button>

      {/* 🚗 3D Icon Header */}
      <h1 className="dashboard-title">
        <img
          src="https://cdn-icons-png.flaticon.com/512/743/743007.png"
          alt="Car Icon"
          className="car-icon-img"
        />
        Vehicle Details
      </h1>

      {/* 🧾 Vehicle Details */}
      <div className="found-card">
        <h2>{vehicle.brand || "Unknown"} {vehicle.model || ""}</h2>
        <div className="car-details">
          <p><b>Registration:</b> {vehicle.reg || "N/A"}</p>
          <p><b>Year:</b> {vehicle.year || "N/A"}</p>
          <p><b>Fuel:</b> {vehicle.fuel || "N/A"}</p>
          <p><b>Transmission:</b> {vehicle.transmission || "N/A"}</p>
          <p><b>Owner:</b> {vehicle.owner || "N/A"}</p>
          <p><b>Kilometers:</b> {vehicle.kms?.toLocaleString() || 0} km</p>
          <p><b>Price:</b> ₹{vehicle.price?.toLocaleString() || 0}</p>
          <p><b>Status:</b> {vehicle.is_sold ? "✅ SOLD" : "🚗 Available"}</p>
          <p><b>Description:</b> {vehicle.description || "No details available"}</p>
        </div>

        {/* 📸 Image Gallery */}
        <div className="image-gallery">
          {images?.length > 0 ? (
            images.map((img, i) => (
              <img
                key={i}
                src={img}
                alt={`Car ${i}`}
                className="vehicle-img"
                onClick={() => {
                  setPhotoIndex(i);
                  setIsOpen(true);
                }}
              />
            ))
          ) : (
            <p>No images available</p>
          )}
        </div>

        {/* 🔘 Admin Actions */}
        <div className="admin-buttons">
          {!vehicle.is_sold && (
            <button onClick={markAsSold} className="sold-btn">
              Mark as Sold
            </button>
          )}
          <button onClick={deleteVehicle} className="delete-btn">
            Delete
          </button>
        </div>

        {msg && <p className="action-msg">{msg}</p>}
      </div>

      {/* 🔍 Lightbox Viewer */}
      {isOpen && (
        <Lightbox
          src={images}
          currentIndex={photoIndex}
          onClose={() => setIsOpen(false)}
          backgroundStyle={{ backgroundColor: "rgba(0,0,0,0.9)" }}
        />
      )}
    </div>
  );
}

export default VehicleDetails;
