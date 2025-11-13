import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./login";
import Dashboard from "./AdminDashboard";
import AddVehicle from "./postvehicle";
import VehicleDetails from "./VehicleDetails";

function App() {
  const [token, setToken] = useState(localStorage.getItem("token"));

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login setToken={setToken} />} />
        <Route
          path="/dashboard"
          element={token ? <Dashboard token={token} /> : <Navigate to="/" />}
        />
        <Route
          path="/add-vehicle"
          element={token ? <AddVehicle token={token} /> : <Navigate to="/" />}
        />
        <Route
          path="/vehicle/:reg"
          element={token ? <VehicleDetails token={token} /> : <Navigate to="/" />}
        />
      </Routes>
    </Router>
  );
}

export default App;
