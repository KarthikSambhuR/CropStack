#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>
#include <WebServer.h>

// WiFi Credentials
const char* ssid = "SJCCAMPUS";
const char* password = "wireless@sjcet2011";

// API Endpoint
const char* serverName = "http://api.sambhu.design/api/hubs/HUB-3362B8/sensors";

// Pin Definitions
#define DHTPIN 4
#define DHTTYPE DHT11
#define CONTROL_PIN 22

DHT dht(DHTPIN, DHTTYPE);
WebServer server(80);

bool pinState = LOW;
TaskHandle_t SensorTask;

// ---------- TOGGLE HANDLER ----------
void handleToggle() {
  pinState = !pinState;
  digitalWrite(CONTROL_PIN, pinState);
  server.send(200, "text/plain", pinState ? "ON" : "OFF");
  Serial.println("Toggle Triggered");
}

// ---------- SENSOR TASK (Core 0) ----------
void sensorTaskCode(void * parameter) {
  HTTPClient http;
  
  while(true) {
    if(WiFi.status() == WL_CONNECTED) {
      float h = dht.readHumidity();
      float t = dht.readTemperature();

      if(!isnan(h) && !isnan(t)) {
        // Reuse the connection to speed up the 1-second interval
        http.begin(serverName); 
        http.addHeader("Content-Type", "application/json");
        http.setTimeout(900); // Must be less than 1000ms since we loop every second

        String data = "{\"temperature\":" + String(t) + ",\"moisture\":" + String(h) + "}";

        // Send POST request
        int httpResponseCode = http.POST(data);
        
        if (httpResponseCode > 0) {
          Serial.printf("[%lu] Sent: %s | Status: %d\n", millis(), data.c_str(), httpResponseCode);
        } else {
          Serial.print("Error: ");
          Serial.println(http.errorToString(httpResponseCode).c_str());
        }

        http.end();
      }
    } else {
      Serial.println("WiFi Lost");
    }

    // High-frequency 1-second delay
    vTaskDelay(1000 / portTICK_PERIOD_MS);
  }
}

// ---------- WIFI SETUP ----------
void connectWiFi() {
  Serial.print("Connecting");
  WiFi.begin(ssid, password);
  while(WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected! IP: " + WiFi.localIP().toString());
}

void setup() {
  Serial.begin(115200);
  pinMode(CONTROL_PIN, OUTPUT);
  dht.begin();
  
  connectWiFi();

  server.on("/toggle", handleToggle);
  server.begin();

  // Start the background task
  xTaskCreatePinnedToCore(
    sensorTaskCode,
    "SensorTask",
    10000,
    NULL,
    1,
    &SensorTask,
    0
  );
}

void loop() {
  server.handleClient();
  delay(1); 
}