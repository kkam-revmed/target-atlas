// Configure only after an authenticated, durable feedback service is connected.
// The static Atlas cannot receive feedback or start an automation by itself.
window.AtlasFeedbackConfig = Object.freeze({ endpoint: null });
