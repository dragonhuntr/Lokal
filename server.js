const express = require("express");
const app = express();
app.use(express.json());

let trips = [];
let users = [];
let alerts = [];

// User
app.get("/api/user/:id", (req, res) => {
	const user = users.find((u) => u.id === req.params.id);
	
	if (!user) {
	  res.status(404).json({ error: "User not found" });
	  return;
	}

	res.json(user);
  });
  
  app.put("/api/user/:id", (req, res) => {
	const user = req.body;
  
	if (!user.id || !user.name || !user.email || !user.preferences) {
	  res.status(400).json({ error: "Invalid user data" });
	  return;
	}
  
	const userIndex = users.findIndex((u) => u.id === req.params.id);
	if (userIndex === -1) {
	  users.push(req.body);
	} else {
	  users[userIndex] = req.body;
	}
  
	res.json(req.body);
  });
  
  app.delete("/api/user/:id", (req, res) => {
	const userIndex = users.findIndex((u) => u.id === req.params.id);
	if (userIndex === -1) {
	  res.status(404).json({ error: "User not found" });
	  return;
	}
  
	users.splice(userIndex, 1);
	res.status(204).send();
  });
  
  app.put("/api/user/:id/preferences", (req, res) => {
	const user = users.find((u) => u.id === req.params.id);
	if (!user) {
	  res.status(404).json({ error: "User not found" });
	  return;
	}
  
	const userPreferences = req.body;
  
	if (!userPreferences.notifications || !userPreferences.theme) {
	  res.status(400).json({ error: "Invalid preferences data" });
	  return;
	}
  
	user.preferences = req.body;
	res.json(user);
  });

// Trips
app.get("/trips", (req, res) => {
  res.json(trips);
});

app.post("/trips", (req, res) => {
  const trip = req.body;

  if (!trip.id || !trip.name || !trip.description || !trip.startDate || !trip.endDate) {
    res.status(400).json({ error: "Invalid trip data" });
    return;
  }

  trips.push(req.body);
  res.json(req.body);
});

app.put("/trips/:id", (req, res) => {
  const trip = req.body;

  if (!trip.id || !trip.name || !trip.description || !trip.startDate || !trip.endDate) {
    res.status(400).json({ error: "Invalid trip data" });
    return;
  }

  trips[req.params.id] = req.body;
  res.json(req.body);
});

app.delete("/trips/:id", (req, res) => {
  trips.splice(req.params.id, 1);
  res.status(204).send();
});

// Alerts
app.get("/api/alerts", (req, res) => {
  res.json(alerts);
});

app.post("/api/alerts", (req, res) => {
  const alert = req.body;

  if (!alert.id || !alert.title || !alert.message || !alert.createdAt) {
    res.status(400).json({ error: "Invalid alert data" });
    return;
  }

  alerts.push(req.body);
  res.json(req.body);
});

app.get("/api/alerts/:id", (req, res) => {
  const alert = alerts.find((a) => a.id === req.params.id);

  if (!alert) {
    res.status(404).json({ error: "Alert not found" });
    return;
  }

  res.json(alert);
});

app.delete("/api/alerts/:id", (req, res) => {
  const alertIndex = alerts.findIndex((a) => a.id === req.params.id);

  if (alertIndex === -1) {
    res.status(404).json({ error: "Alert not found" });
    return;
  }

  alerts.splice(alertIndex, 1);
  res.status(204).send();
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});