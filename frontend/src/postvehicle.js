import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./postvehicle.css";

function AddVehicle({ token }) {
  const [form, setForm] = useState({
    reg: "",
    brand: "",
    model: "",
    year: "",
    price: "",
    kms: "",
    fuel: "",
    transmission: "",
    owner: "",
    description: "",
  });
  const [images, setImages] = useState([]);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const handleFileChange = (e) => setImages(e.target.files);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    const formData = new FormData();
    Object.entries(form).forEach(([k, v]) => formData.append(k, v));
    for (let file of images) formData.append("images", file);

    const res = await fetch("http://127.0.0.1:8000/cars", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    const data = await res.json();
    if (res.ok) {
      setMessage(" Vehicle added successfully!");
      setTimeout(() => navigate("/dashboard"), 1500);
    } else {
      setMessage(` ${data.detail || "Failed to add vehicle"}`);
    }
  };

  return (
    <div className="add-container">
      <h2>Add New Vehicle</h2>
      <form onSubmit={handleSubmit}>
        {Object.keys(form).map((key) => (
          <input
            key={key}
            type={["year", "price", "kms"].includes(key) ? "number" : "text"}
            name={key}
            placeholder={key.toUpperCase()}
            value={form[key]}
            onChange={handleChange}
            required
          />
        ))}
        <textarea
          name="description"
          placeholder="Description"
          value={form.description}
          onChange={handleChange}
          required
        />
        <input type="file" multiple onChange={handleFileChange} />
        <button type="submit">Add Vehicle</button>
      </form>
      {message && <p className="message">{message}</p>}
    </div>
  );
}

export default AddVehicle;
