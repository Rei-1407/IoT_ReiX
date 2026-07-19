#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <ArduinoJson.h>

// ===== WIFI / MQTT =====
// Thong tin WiFi + MQTT nam trong secrets.h (khong commit len git)
// Uu tien WIFI1, khong bat duoc thi doi sang WIFI2
#include "secrets.h"

const char* mqtt_server = "192.168.137.1";
const int   mqtt_port   = 1407;

// ===== MQTT TOPIC =====
const char* topic_control = "control";
const char* topic_device  = "device";
const char* topic_sensor  = "sensor";
const char* topic_status  = "status";
const char* topic_restore = "restore";

WiFiClient espClient;
PubSubClient client(espClient);

// ===== PINOUT =====
const int LED_FIRE  = 23;
const int LED_AC    = 19;
const int LED_LIGHT = 18;
const int LED_FAN1  = 15;
const int LED_FAN2  = 2;
const int LED_FAN3  = 4;
const int LED_WARN  = 5;

// ===== I2C =====
#define ADDR_SHT31  0x44
#define ADDR_BH1750 0x23

// ===== STATE =====
bool  isAutoMode = false;
float temp = 0.0f, hum = 0.0f, lux = 0.0f;

// ===== INTERVAL PUBLISH (moi 2 giay) =====
unsigned long lastPublish = 0;
const unsigned long PUBLISH_INTERVAL = 2000;

// PWM
const int CH_AC = 0;

// Trang thai mong muon (manual)
int manualFanLevel = 0;
int manualAcPWM    = 0;
int manualLight    = 0;
int manualFire     = 0;
int manualWarning  = 0;

// Trang thai thuc te
int currentFanLevel = 0;
int currentAcPWM    = 0;
int currentLight    = 0;
int currentFire     = 0;
int currentWarning  = 0;
unsigned long warnBlinkTimer = 0;
bool warnBlinkState = false;

// ===== HAM TIEN ICH =====
static float round2(float x) {
  return ((int)(x * 100.0f + (x >= 0 ? 0.5f : -0.5f))) / 100.0f;
}

static int readFanLevelFromPins() {
  if (digitalRead(LED_FAN3)) return 3;
  if (digitalRead(LED_FAN2)) return 2;
  if (digitalRead(LED_FAN1)) return 1;
  return 0;
}

static void syncCurrentOutputsFromPins() {
  currentFire     = digitalRead(LED_FIRE)  ? 1 : 0;
  currentLight    = digitalRead(LED_LIGHT) ? 1 : 0;
  currentFanLevel = readFanLevelFromPins();
  currentAcPWM    = constrain(currentAcPWM, 0, 255);
}

// ===== DIEU KHIEN THIET BI =====
static void applyFanLevel(int level) {
  level = constrain(level, 0, 3);
  digitalWrite(LED_FAN1, level >= 1 ? HIGH : LOW);
  digitalWrite(LED_FAN2, level >= 2 ? HIGH : LOW);
  digitalWrite(LED_FAN3, level >= 3 ? HIGH : LOW);
  delay(1);
  currentFanLevel = readFanLevelFromPins();
}

static void applyLightState(int state) {
  state = state ? 1 : 0;
  digitalWrite(LED_LIGHT, state ? HIGH : LOW);
  delay(1);
  currentLight = digitalRead(LED_LIGHT) ? 1 : 0;
}

static void applyFireState(int state) {
  state = state ? 1 : 0;
  digitalWrite(LED_FIRE, state ? HIGH : LOW);
  delay(1);
  currentFire = digitalRead(LED_FIRE) ? 1 : 0;
}

static void applyWarningState(int state) {
  state = state ? 1 : 0;
  currentWarning = state;
  if (!state) {
    digitalWrite(LED_WARN, LOW);
    warnBlinkState = false;
  }
}

static void applyAcPWM(int pwm) {
  pwm = constrain(pwm, 0, 255);
  ledcWrite(CH_AC, pwm);
  currentAcPWM = pwm;
}

static void applyManualStates() {
  applyFireState(manualFire);
  applyLightState(manualLight);
  applyFanLevel(manualFanLevel);
  applyAcPWM(manualAcPWM);
  applyWarningState(manualWarning);
}

static void snapshotCurrentToManual() {
  syncCurrentOutputsFromPins();
  manualFire     = currentFire;
  manualLight    = currentLight;
  manualFanLevel = currentFanLevel;
  manualAcPWM    = currentAcPWM;
  manualWarning  = currentWarning;
}

// ===== PUBLISH DEVICE STATE =====
static void publishDeviceNow() {
  StaticJsonDocument<256> doc;
  doc["auto"]    = isAutoMode;
  doc["fire"]    = currentFire;
  doc["ac"]      = currentAcPWM;
  doc["light"]   = currentLight;
  doc["fan"]     = currentFanLevel;
  doc["warning"] = currentWarning;

  char buffer[256];
  size_t n = serializeJson(doc, buffer);
  client.publish(topic_device, buffer, n);
}

// ===== PUBLISH SENSOR DATA =====
static void publishSensorNow() {
  StaticJsonDocument<256> doc;
  doc["temp"] = round2(temp);
  doc["hum"]  = round2(hum);
  doc["lux"]  = round2(lux);

  char buffer[256];
  size_t n = serializeJson(doc, buffer);
  client.publish(topic_sensor, buffer, n);
}

// ===== PUBLISH CONTROL STATUS =====
static void publishStatus(const char* action, int expected, int actual) {
  StaticJsonDocument<256> doc;
  doc["action"]   = action;
  doc["expected"] = expected;
  doc["actual"]   = actual;
  doc["result"]   = (expected == actual) ? "success" : "fail";

  char buffer[256];
  size_t n = serializeJson(doc, buffer);
  client.publish(topic_status, buffer, n);
}

// ===== WIFI =====
// Thu ket noi 1 mang WiFi trong toi da timeoutMs
static bool tryConnectWifi(const char* ssid, const char* pass, unsigned long timeoutMs) {
  Serial.print("Dang thu WiFi: ");
  Serial.println(ssid);
  WiFi.begin(ssid, pass);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < timeoutMs) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  return WiFi.status() == WL_CONNECTED;
}

void setup_wifi() {
  WiFi.mode(WIFI_STA);
  WiFi.disconnect(true);
  delay(200);

  // Uu tien "Nghiem thoan", khong bat duoc thi doi sang "TP-Link-1407"
  while (true) {
    if (tryConnectWifi(WIFI1_SSID, WIFI1_PASS, 10000)) break;
    if (tryConnectWifi(WIFI2_SSID, WIFI2_PASS, 10000)) break;
  }

  Serial.print("WiFi Connected: ");
  Serial.println(WiFi.SSID());
}

// ===== FORWARD DECLARE =====
void readSensors();
void autoControl();

// ===== MQTT RECONNECT =====
void reconnect() {
  while (!client.connected()) {
    // Rot WiFi thi ket noi lai (co fallback 2 mang)
    if (WiFi.status() != WL_CONNECTED) setup_wifi();

    String clientId = "ESP32-ReiX-SmartHome-" + String((uint32_t)ESP.getEfuseMac(), HEX);

    if (client.connect(clientId.c_str(), "gianghoanglong", "14072004")) {
      client.subscribe(topic_control);

      // Yeu cau Backend gui trang thai tu DB
      delay(500);
      StaticJsonDocument<64> doc;
      doc["request"] = "restore";
      char buf[64];
      size_t n = serializeJson(doc, buf);
      client.publish(topic_restore, buf, n);
      Serial.println("Sent restore request to Backend");
    }
    else {
      delay(1500);
    }
  }
}

// ===== MQTT CALLBACK =====
void callback(char* topic, byte* payload, unsigned int length) {
  if (strcmp(topic, topic_control) != 0) return;

  String message;
  message.reserve(length + 1);
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }

  StaticJsonDocument<256> doc;
  if (deserializeJson(doc, message)) return;

  const char* action = doc["action"] | "";
  if (!action[0]) return;

  // ===== CHUYEN CHE DO =====
  if (strcmp(action, "mode") == 0) {
    const char* val = doc["val"] | "auto";
    bool nextAuto = (String(val) == "auto");

    if (isAutoMode && !nextAuto) {
      snapshotCurrentToManual();
      applyManualStates();
    }

    isAutoMode = nextAuto;

    if (isAutoMode) {
      readSensors();
      autoControl();
    } else {
      syncCurrentOutputsFromPins();
    }

    publishDeviceNow();
    return;
  }

  // ===== YEU CAU SENSOR =====
  if (strcmp(action, "get_sensor") == 0) {
    publishSensorNow();
    return;
  }

  // ===== YEU CAU TRANG THAI THIET BI =====
  if (strcmp(action, "get_device") == 0) {
    syncCurrentOutputsFromPins();
    publishDeviceNow();
    return;
  }

  // ===== DIEU KHIEN CANH BAO (ca auto lan manual) =====
  if (strcmp(action, "warning") == 0) {
    int expected = doc["val"].as<int>() ? 1 : 0;
    applyWarningState(expected);
    manualWarning = expected;
    publishStatus("warning", expected, currentWarning);
    publishDeviceNow();
    return;
  }

  // ===== DIEU KHIEN THU CONG =====
  if (!isAutoMode) {

    if (strcmp(action, "fan") == 0) {
      manualFanLevel = constrain(doc["val"].as<int>(), 0, 3);
      applyFanLevel(manualFanLevel);
      publishStatus("fan", manualFanLevel, currentFanLevel);
    }
    else if (strcmp(action, "ac") == 0) {
      manualAcPWM = constrain(doc["val"].as<int>(), 0, 255);
      applyAcPWM(manualAcPWM);
      publishStatus("ac", manualAcPWM, currentAcPWM);
    }
    else if (strcmp(action, "light") == 0) {
      manualLight = doc["val"].as<int>() ? 1 : 0;
      applyLightState(manualLight);
      publishStatus("light", manualLight, currentLight);
    }
    else if (strcmp(action, "fire") == 0) {
      manualFire = doc["val"].as<int>() ? 1 : 0;
      applyFireState(manualFire);
      publishStatus("fire", manualFire, currentFire);
    }

    publishDeviceNow();
  }
}

// ===== DOC SENSOR =====
void readSensors() {
  // Doc SHT31 (nhiet do, do am)
  Wire.beginTransmission(ADDR_SHT31);
  Wire.write(0x2C);
  Wire.write(0x06);
  Wire.endTransmission();
  delay(50);

  if (Wire.requestFrom(ADDR_SHT31, 6) == 6) {
    uint16_t t = (Wire.read() << 8) | Wire.read();
    Wire.read(); // CRC
    uint16_t h = (Wire.read() << 8) | Wire.read();
    Wire.read(); // CRC

    temp = -45.0f + 175.0f * ((float)t / 65535.0f);
    hum  = 100.0f * ((float)h / 65535.0f);
  }

  // Doc BH1750 (anh sang)
  if (Wire.requestFrom(ADDR_BH1750, 2) == 2) {
    uint16_t l = (Wire.read() << 8) | Wire.read();
    lux = (float)l / 1.2f;
  }
}

// ===== DIEU KHIEN TU DONG =====
void autoControl() {
  if (!isAutoMode) return;

  // Canh bao chay khi nhiet do > 50
  int fireState = (temp > 50.0f) ? 1 : 0;
  applyFireState(fireState);

  // Quat theo nhiet do
  int fanLvl = 0;
  if (temp >= 31) fanLvl = 3;
  else if (temp >= 28) fanLvl = 2;
  else if (temp >= 25) fanLvl = 1;
  applyFanLevel(fanLvl);

  // Dieu hoa theo nhiet do va do am
  int acPWM = 0;
  if (temp > 32) acPWM = 255;
  else if (hum > 80) acPWM = 150;
  else if (temp > 28) acPWM = 80;
  applyAcPWM(acPWM);

  // Den theo anh sang
  int lightState = (lux < 100) ? 1 : 0;
  applyLightState(lightState);
}

// ===== SETUP =====
void setup() {
  Serial.begin(115200);
  Wire.begin();

  // Cau hinh chan output
  pinMode(LED_FIRE, OUTPUT);
  pinMode(LED_LIGHT, OUTPUT);
  pinMode(LED_FAN1, OUTPUT);
  pinMode(LED_FAN2, OUTPUT);
  pinMode(LED_FAN3, OUTPUT);
  pinMode(LED_WARN, OUTPUT);

  // PWM cho dieu hoa
  ledcSetup(CH_AC, 5000, 8);
  ledcAttachPin(LED_AC, CH_AC);

  // Khoi tao BH1750 che do do lien tuc
  Wire.beginTransmission(ADDR_BH1750);
  Wire.write(0x10);
  Wire.endTransmission();

  // Tat tat ca thiet bi
  applyFireState(0);
  applyLightState(0);
  applyFanLevel(0);
  applyAcPWM(0);
  applyWarningState(0);

  // Ket noi WiFi va MQTT
  setup_wifi();
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
}

// ===== LOOP =====
void loop() {
  if (!client.connected()) reconnect();
  client.loop();

  // LED canh bao nhay lien tuc khi bat
  if (currentWarning) {
    if (millis() - warnBlinkTimer >= 250) {
      warnBlinkTimer = millis();
      warnBlinkState = !warnBlinkState;
      digitalWrite(LED_WARN, warnBlinkState ? HIGH : LOW);
    }
  }

  // Publish sensor + device moi 2 giay
  unsigned long now = millis();
  if (now - lastPublish >= PUBLISH_INTERVAL) {
    lastPublish = now;

    readSensors();

    if (isAutoMode) {
      autoControl();
    }

    syncCurrentOutputsFromPins();
    publishSensorNow();
    publishDeviceNow();
  }
}
