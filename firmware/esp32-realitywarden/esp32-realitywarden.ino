/*
 * RealityWarden ESP32 firmware - SG90 servo + distance sensor.
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
 * ---------------------------------------------------------------------------
 * DISTANCE SENSOR INTERFACE - pick ONE at compile time (no runtime guessing):
 *   0 = HC-SR04 pulse-width. Wiring: Trig=GPIO5, Echo=GPIO4.
 *       ESP32-S3 GPIO is not 5V tolerant: power the sensor at 3.3V for a
 *       direct Echo connection, or use a 5V->3.3V divider on Echo at 5V.
 *   1 = IOE-SR05 style serial TTL (many "wide voltage 3-5.5V HC-SR04" boards
 *       are really this). Wiring: EN=GPIO5, sensor TXD -> GPIO4 (UART1 RX),
 *       9600 8N1. EN LOW enables measurement; frames are FF, distH, distL,
 *       SUM where SUM = (0xFF + distH + distL) & 0xFF, distance in mm.
 *       Power at 3.3V and connect TXD directly; at 5V use a divider on TXD.
 * ---------------------------------------------------------------------------
 * Wiring (both variants): SG90=GPIO18.
 * Requires the "ESP32Servo" library (Library Manager) and ArduinoJson.
 */
#define DISTANCE_SENSOR_SERIAL_TTL 0

#include <ESP32Servo.h>
#include <ArduinoJson.h>

const char* FIRMWARE_VERSION = "0.1.5";
const int PROTOCOL_VERSION = 4;

const int SERVO_PIN = 18;
const int TRIG_PIN = 5;   // serial_ttl variant: EN pin (LOW = enabled)
const int ECHO_PIN = 4;   // serial_ttl variant: sensor TXD -> UART1 RX
const unsigned long ECHO_TIMEOUT_US = 30000;
const size_t MAX_REQUEST_LINE_BYTES = 512;

#if DISTANCE_SENSOR_SERIAL_TTL
const long SENSOR_BAUD = 9600;
const unsigned long TTL_FRAME_TIMEOUT_MS = 150;
HardwareSerial SensorSerial(1);
unsigned long ttlChecksumErrors = 0;
long ttlLastDistanceMm = -1;
#endif

Servo servo;
String lineBuffer;
bool discardingOversizedLine = false;

void setup() {
  Serial.begin(115200);
  pinMode(TRIG_PIN, OUTPUT);
#if DISTANCE_SENSOR_SERIAL_TTL
  digitalWrite(TRIG_PIN, HIGH); // EN high = sensor idle until a read runs
  SensorSerial.begin(SENSOR_BAUD, SERIAL_8N1, ECHO_PIN, -1);
#else
  pinMode(ECHO_PIN, INPUT);
  digitalWrite(TRIG_PIN, LOW);
#endif
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

#if DISTANCE_SENSOR_SERIAL_TTL

// Read one checksum-valid IOE-SR05 frame. Returns distance in mm, or -1.
// Honesty rules: checksum failures are counted and reported, never "fixed";
// no frame means no reading - the caller reports an explicit error.
long readTtlDistanceMm() {
  while (SensorSerial.available() > 0) SensorSerial.read(); // drop stale bytes
  digitalWrite(TRIG_PIN, LOW); // EN low = start measuring/streaming
  long distanceMm = -1;
  const unsigned long startedMs = millis();
  while (millis() - startedMs < TTL_FRAME_TIMEOUT_MS) {
    if (SensorSerial.available() == 0) continue;
    const int header = SensorSerial.read();
    if (header != 0xFF) continue;
    uint8_t frame[3];
    int index = 0;
    const unsigned long frameStartMs = millis();
    while (index < 3 && millis() - frameStartMs < 30) {
      if (SensorSerial.available() > 0) frame[index++] = (uint8_t)SensorSerial.read();
    }
    if (index < 3) continue; // incomplete frame: keep scanning until timeout
    const uint8_t expectedSum = (uint8_t)((0xFF + frame[0] + frame[1]) & 0xFF);
    if (expectedSum != frame[2]) {
      ttlChecksumErrors += 1;
      continue;
    }
    distanceMm = (long)frame[0] * 256 + (long)frame[1];
    break;
  }
  digitalWrite(TRIG_PIN, HIGH); // EN high = sensor idle
  if (distanceMm >= 0) ttlLastDistanceMm = distanceMm;
  return distanceMm;
}

void handleReadDistance(const char* id) {
  const unsigned long errorsBefore = ttlChecksumErrors;
  const long distanceMm = readTtlDistanceMm();
  if (distanceMm < 0) {
    // Report failure honestly, never a fake reading; the host default-blocks.
    sendError(id, ttlChecksumErrors > errorsBefore
      ? "IOE-SR05 frame failed checksum (check TXD signal quality, shared ground, 9600 baud)"
      : "no IOE-SR05 serial frame (EN->GPIO5 must be wired, TXD->GPIO4, 9600 8N1, sensor powered)");
    return;
  }
  StaticJsonDocument<160> doc;
  doc["id"] = id;
  doc["ok"] = true;
  doc["data"]["distanceCm"] = distanceMm / 10.0f;
  doc["data"]["distanceMm"] = distanceMm;
  doc["data"]["deviceMs"] = millis();
  serializeJson(doc, Serial);
  Serial.println();
}

void handleDiagnoseHardware(const char* id) {
  int successfulFrames = 0;
  for (int sample = 0; sample < 3; sample += 1) {
    if (readTtlDistanceMm() >= 0) successfulFrames += 1;
    delay(60);
  }
  StaticJsonDocument<512> doc;
  doc["id"] = id;
  doc["ok"] = true;
  doc["data"]["firmware"] = "realitywarden-esp32";
  doc["data"]["firmwareVersion"] = FIRMWARE_VERSION;
  doc["data"]["protocolVersion"] = PROTOCOL_VERSION;
  doc["data"]["servoPin"] = SERVO_PIN;
  doc["data"]["sensorModel"] = "IOE-SR05";
  doc["data"]["sensorInterface"] = "serial_ttl";
  doc["data"]["sensorBaud"] = SENSOR_BAUD;
  doc["data"]["enablePin"] = TRIG_PIN;
  doc["data"]["sensorRxPin"] = ECHO_PIN;
  doc["data"]["successfulFrames"] = successfulFrames;
  doc["data"]["checksumErrors"] = ttlChecksumErrors;
  if (ttlLastDistanceMm >= 0) doc["data"]["lastDistanceMm"] = ttlLastDistanceMm;
  doc["data"]["deviceMs"] = millis();
  serializeJson(doc, Serial);
  Serial.println();
}

void handleDiagnoseGpioLoopback(const char* id) {
  // Wiring self-test: temporarily reclaim GPIO4 from UART1 so the host can
  // verify the GPIO5 -> GPIO4 jumper path. Disconnect the sensor TXD first,
  // otherwise the sensor drives the line and the result is meaningless.
  SensorSerial.end();
  pinMode(ECHO_PIN, INPUT);
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(50);
  const int echoWhileLow = digitalRead(ECHO_PIN);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(50);
  const int echoWhileHigh = digitalRead(ECHO_PIN);
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(50);
  const int echoAfterLow = digitalRead(ECHO_PIN);
  digitalWrite(TRIG_PIN, HIGH); // restore EN idle
  SensorSerial.begin(SENSOR_BAUD, SERIAL_8N1, ECHO_PIN, -1);
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

#else // pulse-width HC-SR04

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
  doc["data"]["firmwareVersion"] = FIRMWARE_VERSION;
  doc["data"]["protocolVersion"] = PROTOCOL_VERSION;
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

#endif // DISTANCE_SENSOR_SERIAL_TTL

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
