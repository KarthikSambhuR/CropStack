#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>
#include <WebServer.h>
#include <ESP32Servo.h>

// WiFi Credentials
const char* ssid = "SJCCAMPUS";
const char* password = "wireless@sjcet2011";

// API Endpoint
const char* serverName = "http://api.sambhu.design/api/hubs/HUB-3362B8/sensors";

// Pin Definitions
#define DHTPIN 4
#define DHTTYPE DHT11
#define CONTROL_PIN 22
#define SERVO_PIN 18

DHT dht(DHTPIN, DHTTYPE);
WebServer server(80);
Servo myServo;

bool pinState = LOW;
bool servoState = LOW;
TaskHandle_t SensorTask;

// ---------- TOGGLE HANDLER ----------
void handleToggle() {
  // Accept explicit state: /toggle?state=on or /toggle?state=off
  String state = server.arg("state");
  if (state == "on") {
    pinState = HIGH;
  } else if (state == "off") {
    pinState = LOW;
  } else {
    // Fallback: blind toggle if no state specified
    pinState = !pinState;
  }
  digitalWrite(CONTROL_PIN, pinState);

  // CORS so browser/API can call us
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "text/plain", pinState ? "ON" : "OFF");
  Serial.println("LED -> " + String(pinState ? "ON" : "OFF"));
}

// ---------- SERVO HANDLER ----------
void handleServo() {
  String state = server.arg("state");
  if (state == "on") {
    servoState = HIGH;
  } else if (state == "off") {
    servoState = LOW;
  } else {
    servoState = !servoState;
  }

  // Continuous rotation: 0 = full speed, 90 = stop
  myServo.write(servoState ? 0 : 90);

  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "text/plain", servoState ? "ON" : "OFF");
  Serial.println("Servo -> " + String(servoState ? "ON" : "OFF"));
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

        // Include device IP, pin state and servo state
        String ip = WiFi.localIP().toString();
        String data = "{\"temperature\":" + String(t) +
                      ",\"moisture\":" + String(h) +
                      ",\"device_ip\":\"" + ip + "\"" +
                      ",\"pin_state\":\"" + (pinState ? "ON" : "OFF") + "\"" +
                      ",\"servo_state\":\"" + (servoState ? "ON" : "OFF") + "\"}";

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
  digitalWrite(CONTROL_PIN, LOW);  // LED off on startup
  dht.begin();

  // Servo off on startup
  myServo.attach(SERVO_PIN);
  myServo.write(90);  // 90 = stop for continuous rotation servo
  
  connectWiFi();

  server.on("/toggle", handleToggle);
  server.on("/servo", handleServo);
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