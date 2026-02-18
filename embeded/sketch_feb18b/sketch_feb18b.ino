#include <WiFiS3.h>
#include <DHT.h>

// WiFi credentials
const char* ssid = "SJCCAMPUS";
const char* password = "wireless@sjcet2011";

// API Details
const char* serverName = "api.sambhu.design";
const char* apiPath = "/api/hubs/HUB-19961A/sensors";

// Pins
#define LED_PIN 2
#define DHTPIN 4
#define DHTTYPE DHT11

// Objects
WiFiServer server(80);
WiFiClient apiClient; 
DHT dht(DHTPIN, DHTTYPE);

// State & Timers
bool ledState = LOW;
unsigned long lastUploadTime = 0;
const unsigned long uploadInterval = 1000; // 10 seconds

void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, ledState);

  dht.begin();

  Serial.println("Connecting to WiFi...");
  while (WiFi.begin(ssid, password) != WL_CONNECTED) {
    Serial.print(".");
    delay(2000);
  }

  Serial.println("\nWiFi Connected!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());

  server.begin();
  Serial.println("Local Server started");
}

void loop() {
  // 1. Handle Local Web Server (Toggle LED / View Status)
  handleLocalRequests();

  // 2. Periodic API Upload (Every 10 seconds)
  if (millis() - lastUploadTime >= uploadInterval) {
    postDataToAPI();
    lastUploadTime = millis();
  }
}

void handleLocalRequests() {
  WiFiClient client = server.available();
  if (client) {
    String request = client.readStringUntil('\r');
    client.flush();

    // Prepare HTTP Header for Browser
    client.println("HTTP/1.1 200 OK");
    client.println("Content-Type: text/plain");
    client.println("Connection: close");
    client.println();

    if (request.indexOf("/toggle") != -1) {
      ledState = !ledState;
      digitalWrite(LED_PIN, ledState);
      client.println(ledState ? "LED: ON" : "LED: OFF");
      Serial.println("LED Toggled via Web");
    } 
    else if (request.indexOf("/dht") != -1) {
      float t = dht.readTemperature();
      float h = dht.readHumidity();
      client.print("Temp: "); client.print(t); client.println(" C");
      client.print("Hum: "); client.print(h); client.println(" %");
    }

    client.stop();
  }
}

void postDataToAPI() {
  if (WiFi.status() == WL_CONNECTED) {
    float t = dht.readTemperature();
    float h = dht.readHumidity();

    if (!isnan(t) && !isnan(h)) {
      Serial.println("Attempting API Upload...");

      if (apiClient.connect(serverName, 80)) {
        // Construct JSON string
        String data = "{\"temperature\":" + String(t) + ",\"moisture\":" + String(h) + "}";

        // Send HTTP POST Request
        apiClient.print("POST "); apiClient.print(apiPath); apiClient.println(" HTTP/1.1");
        apiClient.print("Host: "); apiClient.println(serverName);
        apiClient.println("Content-Type: application/json");
        apiClient.print("Content-Length: "); apiClient.println(data.length());
        apiClient.println("Connection: close");
        apiClient.println(); // End of headers
        apiClient.println(data); // Body

        Serial.println("Data Sent!");
        
        // Brief delay to let the server respond
        delay(500);
        while(apiClient.available()){
          String line = apiClient.readStringUntil('\r');
          Serial.print(line);
        }
        apiClient.stop();
      } else {
        Serial.println("Connection to API failed");
      }
    }
  }
}