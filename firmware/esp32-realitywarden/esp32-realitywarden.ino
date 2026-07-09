/*
 * RealityWarden ESP32 firmware — SG90 servo + HC-SR04 ultrasonic sensor.
 *
 * Protocol: newline-delimited JSON over USB serial @ 115200.
 *   Host -> ESP32: {"id":"abc","cmd":"move_to_angle","args":{"angle":45}}
 *   Host -> ESP32: {"id":"def","cmd":"read_distance"}
 *   ESP32 -> Host: {"id":"abc","ok":true,"data":{"angle":45}}
 *   ESP32 -> Host: {"id":"def","ok":true,"data":{"distanceCm":42.5}}
 *   On error:      {"id":"...","ok":false,"detail":"..."}
 *
 * The firmware enforces the 0-180 servo limit as a LAST line of defense.
 * The host safety layer must have blocked out-of-range commands already;
 * if an out-of-range command reaches this firmware it is refused, never clamped.
 *
 * Wiring (adjust pins below to your board):
 *   SG90 signal  -> GPIO 18
 *   HC-SR04 TRIG -> GPIO 5
 *   HC-SR04 ECHO -> GPIO 4  (use a voltage divider: ECHO is 5V, ESP32 is 3.3V)
 *
 * Requires the "ESP32Servo" library (Library Manager) and ArduinoJson.
 */
#include <ESP32Servo.h>
#include <ArduinoJson.h>

const int SERVO_PIN = 18;
const int TRIG_PIN = 5;
const int ECHO_PIN = 4;
const unsigned long ECHO_TIMEOUT_US = 30000; // ~5m max, times out if unplugged

Servo servo;
String lineBuffer;

void setup() {
  Serial.begin(115200);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  servo.attach(SERVO_PIN, 500, 2400);
}

void sendError(const char* id, const char* detail) {
  StaticJsonDocument<192> doc;
  doc["id"] = id;
  doc["ok"] = false;
  doc["detail"] = detail;
  serializeJson(doc, Serial);
  Serial.println();
}

void handleMoveToAngle(const char* id, JsonVariantConst args) {
  if (!args["angle"].is<float>() && !args["angle"].is<int>()) {
    sendError(id, "missing numeric args.angle");
    return;
  }
  float angle = args["angle"].as<float>();
  if (angle < 0 || angle > 180) {
    // Refuse, never clamp: an out-of-range command should have been blocked
    // by the host safety layer and must not actuate here either.
    sendError(id, "angle outside 0-180 refused by firmware");
    return;
  }
  servo.write((int)angle);
  StaticJsonDocument<128> doc;
  doc["id"] = id;
  doc["ok"] = true;
  doc["data"]["angle"] = angle;
  serializeJson(doc, Serial);
  Serial.println();
}

void handleReadDistance(const char* id) {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  unsigned long durationUs = pulseIn(ECHO_PIN, HIGH, ECHO_TIMEOUT_US);
  if (durationUs == 0) {
    // Sensor unplugged or nothing in range: report failure honestly,
    // never a fake reading. The host will default-block actuation.
    sendError(id, "no echo (sensor disconnected or out of range)");
    return;
  }
  float distanceCm = durationUs / 58.0f;
  StaticJsonDocument<128> doc;
  doc["id"] = id;
  doc["ok"] = true;
  doc["data"]["distanceCm"] = distanceCm;
  // Device-side monotonic timestamp (audit 2.2). The host uses this to judge
  // freshness by the DEVICE clock, not host arrival time, and to detect a
  // frozen firmware/sensor (value stuck while the device clock stops advancing).
  doc["data"]["deviceMs"] = millis();
  serializeJson(doc, Serial);
  Serial.println();
}

void handleLine(const String& line) {
  StaticJsonDocument<256> doc;
  DeserializationError parseError = deserializeJson(doc, line);
  if (parseError) {
    sendError("unknown", "malformed json");
    return;
  }
  const char* id = doc["id"] | "unknown";
  const char* cmd = doc["cmd"] | "";
  if (strcmp(cmd, "move_to_angle") == 0) {
    handleMoveToAngle(id, doc["args"]);
  } else if (strcmp(cmd, "read_distance") == 0) {
    handleReadDistance(id);
  } else {
    // No silent fallback: unknown commands are refused explicitly.
    sendError(id, "unsupported cmd");
  }
}

void loop() {
  while (Serial.available() > 0) {
    char c = (char)Serial.read();
    if (c == '\n') {
      lineBuffer.trim();
      if (lineBuffer.length() > 0) {
        handleLine(lineBuffer);
      }
      lineBuffer = "";
    } else if (lineBuffer.length() < 512) {
      lineBuffer += c;
    }
  }
}
