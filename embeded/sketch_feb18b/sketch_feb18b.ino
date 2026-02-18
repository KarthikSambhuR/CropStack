#include <WiFiS3.h>
#include <DHT.h>
#include <Servo.h>

// WiFi Credentials
const char* ssid = "SJCCAMPUS";
const char* password = "wireless@sjcet2011";

// API Details
const char* serverName = "api.sambhu.design";
const char* apiPath = "/api/hubs/HUB-19961A/sensors";

// Pin Definitions
#define DHTPIN 4
#define DHTTYPE DHT11
#define CONTROL_PIN 2
#define SERVO_PIN 9

// Objects
WiFiServer webServer(80);
WiFiClient apiClient;
DHT dht(DHTPIN, DHTTYPE);
Servo myServo;

// State
bool pinState = LOW;
bool servoState = LOW;

// Timers
unsigned long lastUploadTime = 0;
const unsigned long uploadInterval = 1000; // 1 second

// ---------- HELPERS ----------

// Extract query param value from a request line, e.g. "state" from "/toggle?state=on"
String getQueryParam(const String& request, const String& param) {
  int qIdx = request.indexOf('?');
  if (qIdx == -1) return "";
  String query = request.substring(qIdx + 1);
  // query might end at space: "/toggle?state=on HTTP/1.1"
  int spaceIdx = query.indexOf(' ');
  if (spaceIdx != -1) query = query.substring(0, spaceIdx);

  int pIdx = query.indexOf(param + "=");
  if (pIdx == -1) return "";
  String val = query.substring(pIdx + param.length() + 1);
  int ampIdx = val.indexOf('&');
  if (ampIdx != -1) val = val.substring(0, ampIdx);
  return val;
}

// Send HTTP response with CORS
void sendResponse(WiFiClient& client, const String& body) {
  client.println("HTTP/1.1 200 OK");
  client.println("Content-Type: text/plain");
  client.println("Access-Control-Allow-Origin: *");
  client.println("Connection: close");
  client.println();
  client.println(body);
}

// Get local IP as String
String getLocalIP() {
  IPAddress ip = WiFi.localIP();
  return String(ip[0]) + "." + String(ip[1]) + "." + String(ip[2]) + "." + String(ip[3]);
}

// ---------- ROUTE HANDLERS ----------

void handleToggle(WiFiClient& client, const String& request) {
  String state = getQueryParam(request, "state");
  if (state == "on") {
    pinState = HIGH;
  } else if (state == "off") {
    pinState = LOW;
  } else {
    pinState = !pinState;
  }
  digitalWrite(CONTROL_PIN, pinState);

  sendResponse(client, pinState ? "ON" : "OFF");
  Serial.println("LED -> " + String(pinState ? "ON" : "OFF"));
}

void handleServo(WiFiClient& client, const String& request) {
  String state = getQueryParam(request, "state");
  if (state == "on") {
    servoState = HIGH;
  } else if (state == "off") {
    servoState = LOW;
  } else {
    servoState = !servoState;
  }

  // Continuous rotation: 0 = full speed, 90 = stop
  myServo.write(servoState ? 0 : 90);

  sendResponse(client, servoState ? "ON" : "OFF");
  Serial.println("Servo -> " + String(servoState ? "ON" : "OFF"));
}

// ---------- LOCAL WEB SERVER ----------

void handleLocalRequests() {
  WiFiClient client = webServer.available();
  if (!client) return;

  // Wait for data
  unsigned long timeout = millis() + 2000;
  while (!client.available() && millis() < timeout) {
    delay(1);
  }
  if (!client.available()) { client.stop(); return; }

  String request = client.readStringUntil('\r');
  client.flush();

  // Route: GET /toggle?state=on
  if (request.indexOf("GET /toggle") != -1) {
    handleToggle(client, request);
  }
  // Route: GET /servo?state=on
  else if (request.indexOf("GET /servo") != -1) {
    handleServo(client, request);
  }
  // Route: GET /status — quick health check
  else if (request.indexOf("GET /status") != -1) {
    String body = "LED:" + String(pinState ? "ON" : "OFF") +
                  " Servo:" + String(servoState ? "ON" : "OFF") +
                  " IP:" + getLocalIP();
    sendResponse(client, body);
  }
  // Fallback
  else {
    sendResponse(client, "CropStack Uno R4 Ready");
  }

  delay(1);
  client.stop();
}

// ---------- API UPLOAD ----------

void postDataToAPI() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi Lost");
    return;
  }

  float t = dht.readTemperature();
  float h = dht.readHumidity();

  if (isnan(t) || isnan(h)) return;

  String ip = getLocalIP();

  // Build JSON with device IP, pin state and servo state (same as ESP32)
  String data = "{\"temperature\":" + String(t) +
                ",\"moisture\":" + String(h) +
                ",\"device_ip\":\"" + ip + "\"" +
                ",\"pin_state\":\"" + (pinState ? "ON" : "OFF") + "\"" +
                ",\"servo_state\":\"" + (servoState ? "ON" : "OFF") + "\"}";

  if (apiClient.connect(serverName, 80)) {
    apiClient.print("POST "); apiClient.print(apiPath); apiClient.println(" HTTP/1.1");
    apiClient.print("Host: "); apiClient.println(serverName);
    apiClient.println("Content-Type: application/json");
    apiClient.print("Content-Length: "); apiClient.println(data.length());
    apiClient.println("Connection: close");
    apiClient.println();
    apiClient.println(data);

    Serial.print("["); Serial.print(millis()); Serial.print("] Sent: ");
    Serial.print(data); Serial.print(" | Status: ");

    // Read response status
    unsigned long respTimeout = millis() + 1000;
    while (!apiClient.available() && millis() < respTimeout) { delay(1); }
    if (apiClient.available()) {
      String statusLine = apiClient.readStringUntil('\n');
      Serial.println(statusLine);
    } else {
      Serial.println("No response");
    }

    apiClient.stop();
  } else {
    Serial.println("API connection failed");
  }
}

// ---------- WIFI SETUP ----------

void connectWiFi() {
  Serial.print("Connecting");
  while (WiFi.begin(ssid, password) != WL_CONNECTED) {
    Serial.print(".");
    delay(2000);
  }
  Serial.println("\nConnected! IP: " + getLocalIP());
}

// ---------- MAIN ----------

void setup() {
  Serial.begin(115200);
  delay(1000);

  // LED off on startup
  pinMode(CONTROL_PIN, OUTPUT);
  digitalWrite(CONTROL_PIN, LOW);

  // Servo off on startup (90 = stop for continuous rotation)
  myServo.attach(SERVO_PIN);
  myServo.write(90);

  dht.begin();

  connectWiFi();

  webServer.begin();
  Serial.println("Web server started on port 80");
}

void loop() {
  // 1. Handle incoming web requests (toggle, servo, status)
  handleLocalRequests();

  // 2. Periodic sensor upload (every 1 second)
  if (millis() - lastUploadTime >= uploadInterval) {
    postDataToAPI();
    lastUploadTime = millis();
  }
}