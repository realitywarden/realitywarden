/*
 * RealityWarden ESP32 firmware - SG90 servo + HC-SR04 pulse-width sensor.
 * Host protocol: newline-delimited JSON over USB serial @ 115200.
 *   Host -> ESP32: {"id":"abc","cmd":"move_to_angle","args":{"angle":45}}
 *   Host -> ESP32: {"id":"def","cmd":"read_distance"}
 *   ESP32 -> Host: {"id":"abc","ok":true,"data":{"angle":45}}
 *   On error:      {"id":"...","ok":false,"detail":"..."}
 *
 * SAFETY CONTRACT (do not weaken):
 * - The firmware enforces the 0-180 servo limit as the LAST line of defense.
 *   Out-of-range commands are REFUSED, never clamped, even though the host
 *   safety layer should have blocked them already.
 * - Sensor failures are reported honestly (ok:false), never as fake readings;
 *   the host default-blocks actuation on missing data.
 * - Unknown commands are refused explicitly - no silent fallback.
 * - data.deviceMs (device-side monotonic clock, audit 2.2) lets the host judge
 *   freshness by the DEVICE clock and detect frozen firmware/sensors.
 *
 * Wiring: SG90=GPIO18, Trig=GPIO5, Echo=GPIO4.
 * ESP32-S3 GPIO is not 5V tolerant: use 3.3V sensor power for a direct test,
 * or a proper 5V-to-3.3V divider/level shifter on Echo when powered at 5V.
 * Requires the "ESP32Servo" library (Library Manager) and ArduinoJson.
 */
#include <ESP32Servo.h>
#include <ArduinoJson.h>

const int SERVO_PIN = 18;
const int TRIG_PIN = 5;
const int ECHO_PIN = 4;
const unsigned long ECHO_TIMEOUT_US = 30000;
const size_t MAX_REQUEST_LINE_BYTES = 512;

Servo servo;
String lineBuffer;
bool discardingOversizedLine = false;

void setup() {
  Serial.begin(115200);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  digitalWrite(TRIG_PIN, LOW);
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
  const float angle = args["angle"].as<float>();
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

unsigned long measureEchoDuration() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  return pulseIn(ECHO_PIN, HIGH, ECHO_TIMEOUT_US);
}

void handleReadDistance(const char* id) {
  const unsigned long durationUs = measureEchoDuration();
  if (durationUs == 0) {
    // Sensor unplugged or nothing in range: report failure honestly,
    // never a fake reading. The host will default-block actuation.
    sendError(id, "no echo pulse (sensor disconnected, underpowered, or target out of range)");
    return;
  }
  StaticJsonDocument<160> doc;
  doc["id"] = id;
  doc["ok"] = true;
  doc["data"]["distanceCm"] = durationUs / 58.0f;
  doc["data"]["echoDurationUs"] = durationUs;
  doc["data"]["deviceMs"] = millis();
  serializeJson(doc, Serial);
  Serial.println();
}

void handleDiagnoseHardware(const char* id) {
  const int echoIdleLevel = digitalRead(ECHO_PIN);
  int successfulEchoes = 0;
  unsigned long lastDurationUs = 0;
  for (int sample = 0; sample < 3; sample += 1) {
    const unsigned long durationUs = measureEchoDuration();
    if (durationUs > 0) {
      successfulEchoes += 1;
      lastDurationUs = durationUs;
    }
    delay(60);
  }
  StaticJsonDocument<512> doc;
  doc["id"] = id;
  doc["ok"] = true;
  doc["data"]["firmware"] = "realitywarden-esp32";
  doc["data"]["firmwareVersion"] = "0.1.4";
  doc["data"]["protocolVersion"] = 4;
  doc["data"]["servoPin"] = SERVO_PIN;
  doc["data"]["sensorModel"] = "HC-SR04-compatible";
  doc["data"]["sensorInterface"] = "pulse_width";
  doc["data"]["trigPin"] = TRIG_PIN;
  doc["data"]["echoPin"] = ECHO_PIN;
  doc["data"]["echoIdleLevel"] = echoIdleLevel;
  doc["data"]["successfulEchoes"] = successfulEchoes;
  doc["data"]["lastDurationUs"] = lastDurationUs;
  if (lastDurationUs > 0) doc["data"]["lastDistanceCm"] = lastDurationUs / 58.0f;
  doc["data"]["deviceMs"] = millis();
  serializeJson(doc, Serial);
  Serial.println();
}

void handleDiagnoseGpioLoopback(const char* id) {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(50);
  const int echoWhileLow = digitalRead(ECHO_PIN);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(50);
  const int echoWhileHigh = digitalRead(ECHO_PIN);
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(50);
  const int echoAfterLow = digitalRead(ECHO_PIN);
  const bool passed = echoWhileLow == LOW && echoWhileHigh == HIGH && echoAfterLow == LOW;
  StaticJsonDocument<256> doc;
  doc["id"] = id;
  doc["ok"] = true;
  doc["data"]["loopbackPassed"] = passed;
  doc["data"]["echoWhileLow"] = echoWhileLow;
  doc["data"]["echoWhileHigh"] = echoWhileHigh;
  doc["data"]["echoAfterLow"] = echoAfterLow;
  doc["data"]["trigPin"] = TRIG_PIN;
  doc["data"]["echoPin"] = ECHO_PIN;
  doc["data"]["deviceMs"] = millis();
  serializeJson(doc, Serial);
  Serial.println();
}

void handleLine(const String& line) {
  StaticJsonDocument<256> doc;
  const DeserializationError parseError = deserializeJson(doc, line);
  if (parseError) {
    sendError("unknown", "malformed json");
    return;
  }
  const char* id = doc["id"] | "unknown";
  const char* cmd = doc["cmd"] | "";
  if (strcmp(cmd, "move_to_angle") == 0) handleMoveToAngle(id, doc["args"]);
  else if (strcmp(cmd, "read_distance") == 0) handleReadDistance(id);
  else if (strcmp(cmd, "diagnose_hardware") == 0) handleDiagnoseHardware(id);
  else if (strcmp(cmd, "diagnose_gpio_loopback") == 0) handleDiagnoseGpioLoopback(id);
  // No silent fallback: unknown commands are refused explicitly.
  else sendError(id, "unsupported cmd");
}

void loop() {
  while (Serial.available() > 0) {
    const char c = (char)Serial.read();
    if (c == '\n') {
      if (discardingOversizedLine) {
        // Never parse a retained prefix of an oversized command: a valid
        // actuation JSON prefix followed by padding must not reach the servo.
        sendError("unknown", "request line too long");
        discardingOversizedLine = false;
      } else {
        lineBuffer.trim();
        if (lineBuffer.length() > 0) handleLine(lineBuffer);
      }
      lineBuffer = "";
    } else if (discardingOversizedLine) {
      continue;
    } else if (lineBuffer.length() < MAX_REQUEST_LINE_BYTES) {
      lineBuffer += c;
    } else {
      // Drop the whole physical line through its newline. Silently truncating
      // here would allow the truncated prefix to be interpreted as a command.
      lineBuffer = "";
      discardingOversizedLine = true;
    }
  }
}
