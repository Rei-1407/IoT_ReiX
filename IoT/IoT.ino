// ============================================
// IoT ReiX — Home Monitor
// ESP32 doc SHT31 (nhiet do, do am) + BH1750 (anh sang)
//   -> publish MQTT len HiveMQ Cloud (TLS, retained)
// 3 LED hieu ung phan anh trang thai cam bien (khong dieu khien)
// Nhiet do vuot nguong chay -> gui canh bao len ntfy.sh
// Khong can backend / database — web tinh doc truc tiep tu broker
// ============================================

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <ArduinoJson.h>

// Thong tin WiFi / MQTT / ntfy nam trong secrets.h (khong commit len git)
// Uu tien WIFI1, khong bat duoc thi doi sang WIFI2
#include "secrets.h"

// ===== MQTT TOPIC =====
const char* TOPIC_SENSOR = "reix/sensor";  // du lieu cam bien (retained)
const char* TOPIC_STATUS = "reix/status";  // online/offline (retained + LWT)

WiFiClientSecure espClient;
PubSubClient client(espClient);

// ===== PINOUT: 7 LED hieu ung (giu nguyen chan tu ban cu, khong phai cam lai) =====
const int LED_TEMP  = 23;  // LED DO        — nhiet do: cang nong cang dam, bao chay thi nhay
const int LED_HUM   = 19;  // LED XANH DUONG — do am: cang am cang dam
const int LED_LIGHT = 18;  // LED VANG       — anh sang: troi cang toi den cang sang

// Thang 3 LED bao muc nhiet (3 LED quat cu): >=25 sang 1, >=28 sang 2, >=31 sang 3
const int LED_BAR1  = 15;
const int LED_BAR2  = 2;
const int LED_BAR3  = 4;

// LED canh bao (cu): chop nhanh khi bao chay, chop cham khi dang mat ket noi
const int LED_WARN  = 5;

// PWM channel
const int CH_TEMP  = 0;
const int CH_HUM   = 1;
const int CH_LIGHT = 2;

// ===== I2C =====
#define ADDR_SHT31  0x44
#define ADDR_BH1750 0x23

// ===== STATE =====
float temp = 0.0f, hum = 0.0f, lux = 0.0f;

// ===== NGUONG BAO CHAY =====
const float FIRE_ON_TEMP  = 40.0f;  // vuot nguong nay -> bao chay
const float FIRE_OFF_TEMP = 35.0f;  // ha xuong duoi nguong nay moi coi la het chay
bool fireActive = false;

// ntfy: gui ngay khi phat hien chay, sau do nhac lai moi 5 phut neu van chay
unsigned long lastNtfySent = 0;
const unsigned long NTFY_COOLDOWN = 5UL * 60UL * 1000UL;
bool ntfySentOnce = false;

// ===== INTERVAL PUBLISH (moi 2 giay) =====
unsigned long lastPublish = 0;
const unsigned long PUBLISH_INTERVAL = 2000;

// LED do nhay khi bao chay
unsigned long fireBlinkTimer = 0;
bool fireBlinkState = false;

// ===== HAM TIEN ICH =====
static float round2(float x) {
  return ((int)(x * 100.0f + (x >= 0 ? 0.5f : -0.5f))) / 100.0f;
}

// Quy doi gia tri cam bien -> do sang LED 0..255 trong khoang [vMin, vMax]
static int mapBrightness(float v, float vMin, float vMax) {
  if (v <= vMin) return 0;
  if (v >= vMax) return 255;
  return (int)((v - vMin) * 255.0f / (vMax - vMin));
}

// ===== LED HIEU UNG =====
static void updateLeds() {
  // LED DO — nhiet do: 20 do C bat dau sang, 45 do C sang max
  // Dang bao chay thi nhay lien tuc o muc sang max
  if (fireActive) {
    if (millis() - fireBlinkTimer >= 250) {
      fireBlinkTimer = millis();
      fireBlinkState = !fireBlinkState;
    }
    ledcWrite(CH_TEMP, fireBlinkState ? 255 : 0);
  } else {
    ledcWrite(CH_TEMP, mapBrightness(temp, 20.0f, 45.0f));
  }

  // LED XANH DUONG — do am: 40% bat dau sang, 90% sang max
  ledcWrite(CH_HUM, mapBrightness(hum, 40.0f, 90.0f));

  // LED VANG — anh sang: troi cang toi den cang sang (tu 300 lux tro len thi tat)
  ledcWrite(CH_LIGHT, mapBrightness(300.0f - lux, 0.0f, 300.0f));

  // Thang 3 LED bao muc nhiet
  digitalWrite(LED_BAR1, temp >= 25.0f ? HIGH : LOW);
  digitalWrite(LED_BAR2, temp >= 28.0f ? HIGH : LOW);
  digitalWrite(LED_BAR3, temp >= 31.0f ? HIGH : LOW);

  // LED canh bao chop nhanh cung nhip voi LED do khi dang bao chay
  digitalWrite(LED_WARN, (fireActive && fireBlinkState) ? HIGH : LOW);
}

// Chop cham LED canh bao trong luc dang doi ket noi WiFi/MQTT
static void blinkWarnWhileWaiting() {
  static unsigned long t = 0;
  static bool s = false;
  if (millis() - t >= 500) {
    t = millis();
    s = !s;
    digitalWrite(LED_WARN, s ? HIGH : LOW);
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

// ===== PUBLISH SENSOR (retained de web mo len thay ngay gia tri cuoi) =====
static void publishSensorNow() {
  StaticJsonDocument<192> doc;
  doc["temp"] = round2(temp);
  doc["hum"]  = round2(hum);
  doc["lux"]  = round2(lux);
  doc["fire"] = fireActive;

  char buffer[192];
  size_t n = serializeJson(doc, buffer);
  client.publish(TOPIC_SENSOR, (const uint8_t*)buffer, n, true);
}

// ===== CANH BAO CHAY QUA NTFY.SH =====
static void sendFireAlert() {
  WiFiClientSecure ntfyClient;
  ntfyClient.setInsecure();
  HTTPClient http;

  String url = String("https://ntfy.sh/") + NTFY_TOPIC;
  if (!http.begin(ntfyClient, url)) return;

  http.addHeader("Title", "CANH BAO CHAY!");
  http.addHeader("Priority", "urgent");
  http.addHeader("Tags", "fire,rotating_light");

  char body[128];
  snprintf(body, sizeof(body),
           "Nhiet do trong nha dang %.1f do C (vuot nguong %.0f do C). KIEM TRA NGAY!",
           temp, FIRE_ON_TEMP);
  int code = http.POST(String(body));
  http.end();

  Serial.print("ntfy alert sent, HTTP code: ");
  Serial.println(code);
}

// Phat hien chay theo nguong + hysteresis (het chay khi ha xuong duoi FIRE_OFF_TEMP)
static void checkFire() {
  if (!fireActive && temp >= FIRE_ON_TEMP) {
    fireActive = true;
    ntfySentOnce = false;  // cho phep gui canh bao ngay lap tuc
  } else if (fireActive && temp < FIRE_OFF_TEMP) {
    fireActive = false;
  }

  if (fireActive && (!ntfySentOnce || millis() - lastNtfySent >= NTFY_COOLDOWN)) {
    sendFireAlert();
    ntfySentOnce = true;
    lastNtfySent = millis();
  }
}

// ===== WIFI =====
// Thu ket noi 1 mang WiFi trong toi da timeoutMs
static bool tryConnectWifi(const char* ssid, const char* pass, unsigned long timeoutMs) {
  Serial.print("Dang thu WiFi: ");
  Serial.println(ssid);
  WiFi.begin(ssid, pass);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < timeoutMs) {
    blinkWarnWhileWaiting();
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

  // Uu tien WIFI1, khong bat duoc thi doi sang WIFI2
  while (true) {
    if (tryConnectWifi(WIFI1_SSID, WIFI1_PASS, 10000)) break;
    if (tryConnectWifi(WIFI2_SSID, WIFI2_PASS, 10000)) break;
  }

  Serial.print("WiFi Connected: ");
  Serial.println(WiFi.SSID());
}

// ===== MQTT RECONNECT =====
void reconnect() {
  while (!client.connected()) {
    // Rot WiFi thi ket noi lai (co fallback 2 mang)
    if (WiFi.status() != WL_CONNECTED) setup_wifi();

    String clientId = "ESP32-ReiX-Monitor-" + String((uint32_t)ESP.getEfuseMac(), HEX);

    // LWT: ESP32 rot mang thi broker tu phat {"online":false} cho web
    if (client.connect(clientId.c_str(), MQTT_USER, MQTT_PASSWORD,
                       TOPIC_STATUS, 1, true, "{\"online\":false}")) {
      client.publish(TOPIC_STATUS, "{\"online\":true}", true);
      digitalWrite(LED_WARN, LOW);  // het canh bao mat ket noi
      Serial.println("MQTT connected (HiveMQ Cloud)");
    } else {
      Serial.print("MQTT connect failed, rc=");
      Serial.println(client.state());
      // Vua doi vua chop cham LED canh bao
      for (int i = 0; i < 4; i++) {
        blinkWarnWhileWaiting();
        delay(500);
      }
    }
  }
}

// ===== SETUP =====
void setup() {
  Serial.begin(115200);
  Wire.begin();

  // 3 kenh PWM cho 3 LED hieu ung
  ledcSetup(CH_TEMP, 5000, 8);
  ledcAttachPin(LED_TEMP, CH_TEMP);
  ledcSetup(CH_HUM, 5000, 8);
  ledcAttachPin(LED_HUM, CH_HUM);
  ledcSetup(CH_LIGHT, 5000, 8);
  ledcAttachPin(LED_LIGHT, CH_LIGHT);
  ledcWrite(CH_TEMP, 0);
  ledcWrite(CH_HUM, 0);
  ledcWrite(CH_LIGHT, 0);

  // 4 LED digital: thang muc nhiet + canh bao
  pinMode(LED_BAR1, OUTPUT);
  pinMode(LED_BAR2, OUTPUT);
  pinMode(LED_BAR3, OUTPUT);
  pinMode(LED_WARN, OUTPUT);
  digitalWrite(LED_BAR1, LOW);
  digitalWrite(LED_BAR2, LOW);
  digitalWrite(LED_BAR3, LOW);
  digitalWrite(LED_WARN, LOW);

  // Khoi tao BH1750 che do do lien tuc
  Wire.beginTransmission(ADDR_BH1750);
  Wire.write(0x10);
  Wire.endTransmission();

  // Ket noi WiFi + MQTT (TLS)
  setup_wifi();
  espClient.setInsecure();  // bo qua kiem tra cert (du an ca nhan, du dung cho HiveMQ)
  client.setServer(MQTT_HOST, MQTT_PORT);
}

// ===== LOOP =====
void loop() {
  if (!client.connected()) reconnect();
  client.loop();

  updateLeds();

  // Doc sensor + kiem tra chay + publish moi 2 giay
  unsigned long now = millis();
  if (now - lastPublish >= PUBLISH_INTERVAL) {
    lastPublish = now;

    readSensors();
    checkFire();
    publishSensorNow();
  }
}
