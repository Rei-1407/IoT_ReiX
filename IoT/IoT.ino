#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <ArduinoJson.h>

// ===== WIFI / MQTT =====
const char* ssid = "Rei";
const char* password = "12345678";

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

// ===== I2C =====
#define ADDR_SHT31  0x44
#define ADDR_BH1750 0x23

// ===== STATE =====
bool  isAutoMode = false;
float temp = 0.0f, hum = 0.0f, lux = 0.0f;
bool effect1Running = false;
bool effect2Running = false;
int effectStep = 0;
unsigned long effectTimer = 0;

// ===== INTERVAL PUBLISH (mỗi 2 giây) =====
unsigned long lastPublish = 0;
const unsigned long PUBLISH_INTERVAL = 2000; // 2 giây

// PWM
const int CH_AC = 0;

// Manual desired states
int manualFanLevel = 0;
int manualAcPWM    = 0;
int manualLight    = 0;
int manualFire     = 0;

// Current reported states
int currentFanLevel = 0;
int currentAcPWM    = 0;
int currentLight    = 0;
int currentFire     = 0;

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
  currentAcPWM = constrain(currentAcPWM, 0, 255);
}

// ===== FAN LED HELPER =====
static void writeFanLedRaw(int s1, int s2, int s3) {
  digitalWrite(LED_FAN1, s1 ? HIGH : LOW);
  digitalWrite(LED_FAN2, s2 ? HIGH : LOW);
  digitalWrite(LED_FAN3, s3 ? HIGH : LOW);
  delay(1);
  currentFanLevel = readFanLevelFromPins();
}

static void setSingleFanLed(int idx, int state) {
  state = state ? 1 : 0;

  if (idx == 1) {
    digitalWrite(LED_FAN1, state ? HIGH : LOW);
  } else if (idx == 2) {
    digitalWrite(LED_FAN2, state ? HIGH : LOW);
  } else if (idx == 3) {
    digitalWrite(LED_FAN3, state ? HIGH : LOW);
  }

  delay(1);
  currentFanLevel = readFanLevelFromPins();
  manualFanLevel = currentFanLevel;
}

static void setAllFanLed(int state) {
  state = state ? 1 : 0;
  writeFanLedRaw(state, state, state);

  if (state) manualFanLevel = 3;
  else manualFanLevel = 0;
}

static void effectCustom3Led1(int enable) {
  enable = enable ? 1 : 0;

  if (!enable) {
    writeFanLedRaw(0, 0, 0);
    manualFanLevel = 0;
    return;
  }


  writeFanLedRaw(1, 0, 0);
  delay(120);
  writeFanLedRaw(0, 1, 0);
  delay(120);
  writeFanLedRaw(0, 0, 1);
  delay(120);
  writeFanLedRaw(0, 0, 0);
  delay(120);

  manualFanLevel = currentFanLevel;
}

static void effectCustom3Led2(int enable) {
  enable = enable ? 1 : 0;

  if (!enable) {
    writeFanLedRaw(0, 0, 0);
    manualFanLevel = 0;
    return;
  }

  writeFanLedRaw(1, 0, 0);
  delay(120);
  writeFanLedRaw(1, 1, 0);
  delay(120);
  writeFanLedRaw(1, 1, 1);
  delay(180);
  writeFanLedRaw(1, 1, 0);
  delay(120);
  writeFanLedRaw(1, 0, 0);
  delay(120);
  writeFanLedRaw(0, 0, 0);
  delay(120);

  manualFanLevel = currentFanLevel;
}

static void applyFanLevel(int level) {
  level = constrain(level, 0, 3);

  digitalWrite(LED_FAN1, level >= 1 ? HIGH : LOW);
  digitalWrite(LED_FAN2, level >= 2 ? HIGH : LOW);
  digitalWrite(LED_FAN3, level >= 3 ? HIGH : LOW);

  currentFanLevel = readFanLevelFromPins();

  if (currentFanLevel != level) {
    digitalWrite(LED_FAN1, level >= 1 ? HIGH : LOW);
    digitalWrite(LED_FAN2, level >= 2 ? HIGH : LOW);
    digitalWrite(LED_FAN3, level >= 3 ? HIGH : LOW);
    delay(1);
    currentFanLevel = readFanLevelFromPins();
  }
}

static void applyLightState(int state) {
  state = state ? 1 : 0;
  digitalWrite(LED_LIGHT, state ? HIGH : LOW);

  currentLight = digitalRead(LED_LIGHT) ? 1 : 0;

  if (currentLight != state) {
    digitalWrite(LED_LIGHT, state ? HIGH : LOW);
    delay(1);
    currentLight = digitalRead(LED_LIGHT) ? 1 : 0;
  }
}

static void applyFireState(int state) {
  state = state ? 1 : 0;
  digitalWrite(LED_FIRE, state ? HIGH : LOW);

  currentFire = digitalRead(LED_FIRE) ? 1 : 0;

  if (currentFire != state) {
    digitalWrite(LED_FIRE, state ? HIGH : LOW);
    delay(1);
    currentFire = digitalRead(LED_FIRE) ? 1 : 0;
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
}

static void snapshotCurrentToManual() {
  syncCurrentOutputsFromPins();
  manualFire     = currentFire;
  manualLight    = currentLight;
  manualFanLevel = currentFanLevel;
  manualAcPWM    = currentAcPWM;
}

// ===== PUBLISH DEVICE STATE =====
static void publishDeviceNow() {
  StaticJsonDocument<256> doc;

  doc["auto"]  = isAutoMode;
  doc["fire"]  = currentFire;
  doc["ac"]    = currentAcPWM;
  doc["light"] = currentLight;
  doc["fan"]   = currentFanLevel;

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
void setup_wifi() {
  WiFi.mode(WIFI_STA);
  WiFi.disconnect(true);
  delay(200);

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi Connected!");
}

// ===== FORWARD DECLARE =====
void readSensors();
void autoControl();

// ===== MQTT RECONNECT =====
void reconnect() {
  while (!client.connected()) {

    String clientId = "ESP32-ReiX-SmartHome-" + String((uint32_t)ESP.getEfuseMac(), HEX);

    if (client.connect(clientId.c_str(), "gianghoanglong", "14072004")) {
      client.subscribe(topic_control);

      // Sau khi subscribe xong, yêu cầu Backend gửi trạng thái từ DB
      delay(500);
      StaticJsonDocument<64> doc;
      doc["request"] = "restore";
      char buf[64];
      size_t n = serializeJson(doc, buf);
      client.publish(topic_restore, buf, n);
      Serial.println("📡 Sent restore request to Backend");
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

  // ===== MODE SWITCH =====
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

  // ===== REQUEST SENSOR =====
  if (strcmp(action, "get_sensor") == 0) {
    publishSensorNow();
    return;
  }

  // ===== REQUEST DEVICE STATE =====
  if (strcmp(action, "get_device") == 0) {
    syncCurrentOutputsFromPins();
    publishDeviceNow();
    return;
  }

    // ===== MANUAL CONTROL =====
  if (!isAutoMode) {

    if (strcmp(action, "fan") == 0) {
      effect1Running = false;
      effect2Running = false;
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
    else if (strcmp(action, "onled1fan") == 0) {

      int expected = doc["val"].as<int>() ? 1 : 0;
      setSingleFanLed(1, expected);
      publishStatus("onled1fan", expected, digitalRead(LED_FAN1) ? 1 : 0);

    }
    else if (strcmp(action, "onled2fan") == 0) {

      int expected = doc["val"].as<int>() ? 1 : 0;
      setSingleFanLed(2, expected);
      publishStatus("onled2fan", expected, digitalRead(LED_FAN2) ? 1 : 0);

    }
    else if (strcmp(action, "onled3fan") == 0) {

      int expected = doc["val"].as<int>() ? 1 : 0;
      setSingleFanLed(3, expected);
      publishStatus("onled3fan", expected, digitalRead(LED_FAN3) ? 1 : 0);

    }
    else if (strcmp(action, "on3ledfan") == 0) {

    int expected = doc["val"].as<int>() ? 1 : 0;
    setAllFanLed(expected);

    int allOn  = (digitalRead(LED_FAN1) && digitalRead(LED_FAN2) && digitalRead(LED_FAN3)) ? 1 : 0;
    int allOff = (!digitalRead(LED_FAN1) && !digitalRead(LED_FAN2) && !digitalRead(LED_FAN3)) ? 1 : 0;

    int actual = expected ? allOn : (allOff ? 0 : 1);

    publishStatus("on3ledfan", expected, actual);

    }
    else if (strcmp(action, "custom3led1") == 0) {

    effect1Running = doc["val"].as<int>() ? true : false;
    effect2Running = false;

    publishStatus("custom3led1", effect1Running, effect1Running);

  }
    else if (strcmp(action, "custom3led2") == 0) {

    effect2Running = doc["val"].as<int>() ? true : false;
    effect1Running = false;

    effectStep = 0;

    publishStatus("custom3led2", effect2Running, effect2Running);

    }

    publishDeviceNow();
  }
}

void runLedEffects(){

  if(!effect1Running && !effect2Running) return;

  if(millis() - effectTimer < 120) return;

  effectTimer = millis();

  if(effect1Running){

    if(effectStep == 0) writeFanLedRaw(1,0,0);
    else if(effectStep == 1) writeFanLedRaw(0,1,0);
    else if(effectStep == 2) writeFanLedRaw(0,0,1);
    else if(effectStep == 3) writeFanLedRaw(0,0,0);

    effectStep++;
    if(effectStep > 3) effectStep = 0;
  }
  else if(effect2Running){

    if(effectStep == 0) writeFanLedRaw(1,0,0);
    else if(effectStep == 1) writeFanLedRaw(1,1,0);
    else if(effectStep == 2) writeFanLedRaw(1,1,1);
    else if(effectStep == 3) writeFanLedRaw(1,1,0);
    else if(effectStep == 4) writeFanLedRaw(1,0,0);
    else if(effectStep == 5) writeFanLedRaw(0,0,0);

    effectStep++;
    if(effectStep > 5) effectStep = 0;
  }

}
// ===== SENSOR READ =====
void readSensors() {

  Wire.beginTransmission(ADDR_SHT31);
  Wire.write(0x2C);
  Wire.write(0x06);
  Wire.endTransmission();

  delay(50);

  if (Wire.requestFrom(ADDR_SHT31, 6) == 6) {

    uint16_t t = (Wire.read() << 8) | Wire.read();
    Wire.read();

    uint16_t h = (Wire.read() << 8) | Wire.read();
    Wire.read();

    temp = -45.0f + 175.0f * ((float)t / 65535.0f);
    hum  = 100.0f * ((float)h / 65535.0f);
  }

  if (Wire.requestFrom(ADDR_BH1750, 2) == 2) {

    uint16_t l = (Wire.read() << 8) | Wire.read();
    lux = (float)l / 1.2f;
  }
}

// ===== AUTO CONTROL =====
void autoControl() {

  if (!isAutoMode) return;

  int fireState = (temp > 50.0f) ? 1 : 0;
  applyFireState(fireState);

  int fanLvl = 0;
  if (temp >= 31) fanLvl = 3;
  else if (temp >= 28) fanLvl = 2;
  else if (temp >= 25) fanLvl = 1;
  applyFanLevel(fanLvl);

  int acPWM = 0;
  if (temp > 32) acPWM = 255;
  else if (hum > 80) acPWM = 150;
  else if (temp > 28) acPWM = 80;
  applyAcPWM(acPWM);

  int lightState = (lux < 100) ? 1 : 0;
  applyLightState(lightState);
}

void setup() {

  Serial.begin(115200);

  Wire.begin();

  pinMode(LED_FIRE, OUTPUT);
  pinMode(LED_LIGHT, OUTPUT);
  pinMode(LED_FAN1, OUTPUT);
  pinMode(LED_FAN2, OUTPUT);
  pinMode(LED_FAN3, OUTPUT);

  ledcSetup(CH_AC, 5000, 8);
  ledcAttachPin(LED_AC, CH_AC);

  Wire.beginTransmission(ADDR_BH1750);
  Wire.write(0x10);
  Wire.endTransmission();

  applyFireState(0);
  applyLightState(0);
  applyFanLevel(0);
  applyAcPWM(0);

  setup_wifi();

  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
}

void loop() {

  if (!client.connected()) reconnect();

  client.loop();

  runLedEffects();

  // ===== Publish sensor + device mỗi 2 giây =====
  unsigned long now = millis();
  if (now - lastPublish >= PUBLISH_INTERVAL) {
    lastPublish = now;

    readSensors();

    if (isAutoMode) {
      autoControl();
    }

    // Đồng bộ trạng thái hiện tại từ pin thật
    syncCurrentOutputsFromPins();

    // Publish sensor data (temp, hum, lux)
    publishSensorNow();

    // Publish device state (auto, fire, ac, light, fan)
    publishDeviceNow();
  }
}