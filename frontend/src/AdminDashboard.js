import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./AdminDashboard.css";

function Dashboard({ token }) {
  const [searchReg, setSearchReg] = useState("");
  const [vehicles, setVehicles] = useState([]);
  const [foundVehicle, setFoundVehicle] = useState(null);
  const [error, setError] = useState("");
  const [actionMsg, setActionMsg] = useState("");
  const [isListening, setIsListening] = useState(false);
  const navigate = useNavigate();

  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = SpeechRecognition ? new SpeechRecognition() : null;

  // --- Fetch all vehicles ---
  const fetchAllVehicles = async () => {
    const res = await fetch("http://127.0.0.1:8000/cars");
    const data = await res.json();
    setVehicles(data);
  };

  useEffect(() => {
    fetchAllVehicles();
  }, []);

  // --- Search Vehicle ---
  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    setError("");
    setFoundVehicle(null);
    setActionMsg("");

    try {
      const res = await fetch(`http://127.0.0.1:8000/cars/${searchReg}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Vehicle not found");
      setFoundVehicle(data);
      speakResult(data); // voice output (optional)
    } catch (err) {
      setError(err.message);
    }
  };

  // --- Voice Recognition Handler ---
  const handleVoiceSearch = () => {
    if (!recognition) {
      alert("Voice recognition not supported in this browser!");
      return;
    }

    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
      setActionMsg("🎤 Listening... Please say the registration number");
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.trim().toUpperCase();
      setSearchReg(transcript.replace(/\s+/g, ""));
      setActionMsg(`✅ Heard: ${transcript}`);
      setIsListening(false);
      setTimeout(() => handleSearch(), 800); // auto-search after recognizing
    };

    recognition.onerror = (event) => {
      console.error("Voice recognition error:", event.error);
      setIsListening(false);
      setActionMsg("❌ Could not recognize voice. Try again.");
    };

    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  // --- Voice Output (Optional) ---
  const speakResult = (vehicle) => {
    if (!window.speechSynthesis) return;
    const synth = window.speechSynthesis;
    const text = `Vehicle ${vehicle.brand} ${vehicle.model}, Registration ${vehicle.reg}, Price ₹${vehicle.price}`;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-IN";
    synth.speak(utter);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  return (
    <div className="dashboard-container">
      <div className="header">
        <h1>🚗 Vehicle Registry Dashboard</h1>
        <div className="header-buttons">
          <button onClick={() => navigate("/add-vehicle")}>➕ Add Vehicle</button>
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        </div>
      </div>

      {/* Search Section */}
      <div className="search-section">
        <form onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="Enter Registration Number..."
            value={searchReg}
            onChange={(e) => setSearchReg(e.target.value)}
            required
          />
          <button type="submit">Search</button>
        </form>

        <button
          onClick={handleVoiceSearch}
          className={`mic-btn ${isListening ? "listening" : ""}`}
        >
          🎤
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {actionMsg && <p className="action-msg">{actionMsg}</p>}

      {foundVehicle && (
  <div className="found-card">
    <h2>{foundVehicle.brand || "Unknown"} {foundVehicle.model || ""}</h2>
    <div className="car-details">
      <p><b>Registration:</b> {foundVehicle.reg || "N/A"}</p>
      <p><b>Year:</b> {foundVehicle.year || "N/A"}</p>
      <p><b>Fuel:</b> {foundVehicle.fuel || "N/A"}</p>
      <p><b>Transmission:</b> {foundVehicle.transmission || "N/A"}</p>
      <p><b>Owner:</b> {foundVehicle.owner || "N/A"}</p>
      <p><b>Kilometers:</b> {foundVehicle.kms?.toLocaleString() || 0} km</p>
      <p><b>Price:</b> ₹{foundVehicle.price?.toLocaleString() || 0}</p>
      <p><b>Status:</b> {foundVehicle.is_sold ? "✅ SOLD" : "🚗 Available"}</p>
      <p><b>Description:</b> {foundVehicle.description || "No details available"}</p>
    </div>


          <div className="image-gallery">
            {foundVehicle.images?.map((img, i) => (
              <img
                key={i}
                src={`http://127.0.0.1:8000${img}`}
                alt={`Car ${i}`}
                className="vehicle-img"
              />
            ))}
          </div>
        </div>
      )}

      <h2 className="list-title">All Available Vehicles</h2>
      <div className="vehicle-grid">
        {vehicles.map((v, i) => (
          <div
            key={i}
            className="vehicle-card clickable"
            onClick={() => navigate(`/vehicle/${v.reg}`)}
          >
            <img
              src={v.images?.[0] ? `http://127.0.0.1:8000${v.images[0]}` : "/no-car.png"}
              alt={v.model}
            />
            <div className="vehicle-info">
              <h3>{v.brand} {v.model}</h3>
              <p>Reg: {v.reg}</p>
              <p>₹{v.price.toLocaleString()}</p>
              <p>{v.is_sold ? "✅ SOLD" : "🚗 Available"}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Dashboard;
