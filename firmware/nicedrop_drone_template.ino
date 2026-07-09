// ============================================================================
//  NiceDrop — Firmware ESP32 (TEMPLATE)
// ----------------------------------------------------------------------------
//  Este ficheiro é um TEMPLATE. NÃO o compiles diretamente — as marcas
//  29, MEO-BEA7B0 e 5561827982 são substituídas pela consola
//  admin quando carregas em "Gerar .ino". Descarrega sempre o ficheiro
//  nicedrop_drone_<id>.ino a partir da consola e é ESSE que gravas no ESP32.
//
//  Bibliotecas necessárias (Arduino IDE → Library Manager):
//    - WiFiManager (tzapu)
//    - WebSockets (Markus Sattler)  -> WebSocketsClient
//    - ESP32Servo
//    - ArduinoJson
//    (WiFi.h, WiFiMulti.h, Preferences.h, HTTPClient.h vêm com o core ESP32)
//
//  COMO FUNCIONA O WiFi (simples):
//    1) O .ino gerado traz o WiFi inicial já metido (bootstrap) → 1º flash liga
//       logo, sem configurar nada no telemóvel.
//    2) Se mudares o WiFi na consola, o Supabase Realtime empurra as credenciais
//       novas para o ESP32; ele guarda-as na flash e liga-se sozinho à rede nova
//       quando a antiga cair (WiFiMulti). Não é preciso ir ao local.
//    3) Só se TODAS as redes conhecidas falharem é que abre o portal WiFiManager
//       (rede de emergência "NiceDrop-Setup-XXXX", password nicedrop123).
// ============================================================================

#include <WiFi.h>
#include <WiFiMulti.h>
#include <WiFiManager.h>
#include <Preferences.h>
#include <WebSocketsClient.h>
#include <ESP32Servo.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>

// ==== GERADO PELA CONSOLA NICEDROP (substituído ao descarregar) ====
const long  DRONE_ID_BOOTSTRAP  = {{DRONE_ID}};
const char* WIFI_SSID_BOOTSTRAP = "{{WIFI_SSID}}";
const char* WIFI_PASS_BOOTSTRAP = "{{WIFI_PASS}}";
// ===================================================================

#define SERVO_PIN       19
#define BOTAO_RESET_PIN 0

const int SERVO_ABERTO  = 90;
const int SERVO_FECHADO = 185;
const char* STATUS_ENTREGA = "complete";

const char* supabase_host = "ggpjinhvxvieaeulhdyw.supabase.co";
const int   supabase_port = 443;
const char* supabase_anon_key =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdncGppbmh2eHZpZWFldWxoZHl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzOTg1MzUsImV4cCI6MjA3Njk3NDUzNX0.2TsTZEQaJ8Dq7BRLm7SVjjA8SH9JWphQ6kF7OFztiug";

Servo servo;
WiFiMulti wifiMulti;
WebSocketsClient webSocket;
Preferences prefs;

bool websocketStarted = false;
unsigned long lastWifiAttempt = 0;
unsigned long lastHeartbeat = 0;

int  droneId = 0;
char droneIdBuffer[8] = "0";

// ---------------------------------------------------------------------------
//  WiFi — redes guardadas (bootstrap + credenciais empurradas pela consola)
// ---------------------------------------------------------------------------
// Semeia o drone_id a partir do bootstrap na 1ª vez (se ainda não existir).
void seedBootstrapDroneId() {
  prefs.begin("nicedrop", false);
  String savedId = prefs.getString("drone_id", "");
  if (savedId.length() == 0 && DRONE_ID_BOOTSTRAP > 0) {
    prefs.putString("drone_id", String(DRONE_ID_BOOTSTRAP));
    Serial.print("drone_id semeado do bootstrap: ");
    Serial.println(DRONE_ID_BOOTSTRAP);
  }
  prefs.end();
}

// Carrega no WiFiMulti a rede de bootstrap + a última rede empurrada (se houver).
void carregarRedesNoMulti() {
  if (strlen(WIFI_SSID_BOOTSTRAP) > 0) {
    wifiMulti.addAP(WIFI_SSID_BOOTSTRAP, WIFI_PASS_BOOTSTRAP);
    Serial.print("Rede bootstrap adicionada: ");
    Serial.println(WIFI_SSID_BOOTSTRAP);
  }
  prefs.begin("nicedrop", true);
  String ps = prefs.getString("wifi_ssid", "");
  String pp = prefs.getString("wifi_pass", "");
  prefs.end();
  if (ps.length() > 0) {
    wifiMulti.addAP(ps.c_str(), pp.c_str());
    Serial.print("Rede empurrada (flash) adicionada: ");
    Serial.println(ps);
  }
}

// Tenta ligar a qualquer rede conhecida durante timeoutMs. true se ligou.
bool ligarComRedesGuardadas(unsigned long timeoutMs) {
  Serial.println("A tentar ligar as redes conhecidas (WiFiMulti)...");
  unsigned long inicio = millis();
  while (millis() - inicio < timeoutMs) {
    if (wifiMulti.run() == WL_CONNECTED) {
      Serial.print("Ligado a: ");
      Serial.println(WiFi.SSID());
      return true;
    }
    delay(300);
  }
  Serial.println("Nenhuma rede conhecida disponivel dentro do tempo.");
  return false;
}

// ---------------------------------------------------------------------------
//  WiFiManager — só como emergência (fallback quando tudo o resto falha)
// ---------------------------------------------------------------------------
void configurarWiFiEDroneId() {
  prefs.begin("nicedrop", false);
  String savedId = prefs.getString("drone_id", String(DRONE_ID_BOOTSTRAP));
  savedId.toCharArray(droneIdBuffer, 8);

  WiFiManager wm;
  WiFiManagerParameter custom_drone_id(
    "drone_id", "ID do Drone (número da tabela drones)", droneIdBuffer, 8
  );
  wm.addParameter(&custom_drone_id);

  uint64_t chipid = ESP.getEfuseMac();
  char apName[32];
  sprintf(apName, "NiceDrop-Setup-%04X", (uint16_t)(chipid & 0xFFFF));

  wm.setConfigPortalTimeout(180);
  bool ligado = wm.autoConnect(apName, "nicedrop123");

  if (!ligado) {
    Serial.println("Nao foi possivel configurar WiFi - reiniciando...");
    delay(2000);
    ESP.restart();
  }

  prefs.putString("drone_id", custom_drone_id.getValue());
  prefs.end();

  Serial.println("WiFi configurado com sucesso (portal)!");
}

void carregarDroneId() {
  prefs.begin("nicedrop", true);
  droneId = prefs.getString("drone_id", "0").toInt();
  prefs.end();
  Serial.print("Drone ID carregado da memoria: ");
  Serial.println(droneId);
}

void verificarBotaoDeReset() {
  pinMode(BOTAO_RESET_PIN, INPUT_PULLUP);
  delay(50);
  if (digitalRead(BOTAO_RESET_PIN) == LOW) {
    Serial.println("Botao de reset premido - a contar 3 segundos...");
    unsigned long inicio = millis();
    while (digitalRead(BOTAO_RESET_PIN) == LOW) {
      if (millis() - inicio > 3000) {
        Serial.println(">>> A APAGAR CONFIGURACAO WIFI <<<");
        WiFiManager wm;
        wm.resetSettings();
        prefs.begin("nicedrop", false);
        prefs.remove("wifi_ssid");
        prefs.remove("wifi_pass");
        prefs.end();
        delay(500);
        ESP.restart();
      }
    }
  }
}

void confirmarReconfigTratado() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = "https://" + String(supabase_host) +
               "/rest/v1/drones?id=eq." + String(droneId);
  http.begin(url);
  http.addHeader("apikey", supabase_anon_key);
  http.addHeader("Authorization", "Bearer " + String(supabase_anon_key));
  http.addHeader("Content-Type", "application/json");
  http.PATCH("{\"force_reconfig\": false}");
  http.end();
}

// Diz à BD "estou vivo" -> o site mostra o drone ONLINE.
void enviarHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  String url = "https://" + String(supabase_host) + "/rest/v1/rpc/drone_heartbeat";
  http.begin(url);
  http.addHeader("apikey", supabase_anon_key);
  http.addHeader("Authorization", "Bearer " + String(supabase_anon_key));
  http.addHeader("Content-Type", "application/json");
  http.POST("{\"p_id\": " + String(droneId) + "}");
  http.end();
}

void apagarWifiEReiniciar() {
  Serial.println(">>> RECONFIGURACAO REMOTA PEDIDA PELO SITE <<<");
  confirmarReconfigTratado();
  WiFiManager wm;
  wm.resetSettings();
  prefs.begin("nicedrop", false);
  prefs.remove("wifi_ssid");
  prefs.remove("wifi_pass");
  prefs.end();
  delay(500);
  ESP.restart();
}

// Guarda as credenciais WiFi empurradas pela consola e junta-as ao WiFiMulti.
void guardarCredenciaisEmpurradas(const char* ns, const char* np) {
  if (!ns || !np || strlen(ns) == 0) return;
  prefs.begin("nicedrop", false);
  String curS = prefs.getString("wifi_ssid", "");
  String curP = prefs.getString("wifi_pass", "");
  if (curS != ns || curP != np) {
    prefs.putString("wifi_ssid", ns);
    prefs.putString("wifi_pass", np);
    wifiMulti.addAP(ns, np);
    Serial.print(">>> Novas credenciais WiFi guardadas (usadas quando a rede atual cair): ");
    Serial.println(ns);
  }
  prefs.end();
}

void joinRealtime() {
  String joinMsg = R"({
    "topic": "realtime:public",
    "event": "phx_join",
    "payload": {
      "config": {
        "postgres_changes": [
          { "event": "*", "schema": "public", "table": "drones" },
          { "event": "*", "schema": "public", "table": "orders" }
        ]
      }
    },
    "ref": "1"
  })";

  webSocket.sendTXT(joinMsg);
  Serial.println("JOIN + SUBSCRIBE enviado (drones + orders)");
}

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch (type) {

    case WStype_CONNECTED:
      Serial.println("Conectado ao Supabase!");
      joinRealtime();
      break;

    case WStype_TEXT: {
      DynamicJsonDocument doc(8192);
      if (deserializeJson(doc, payload)) return;
      if (!doc.containsKey("event")) return;

      String eventType = doc["event"].as<String>();
      if (eventType != "postgres_changes") return;

      String tabela = doc["payload"]["data"]["table"].as<String>();
      JsonObject record = doc["payload"]["data"]["record"];
      if (record.isNull()) return;

      if (tabela == "drones") {
        int id = record["id"];
        if (id != droneId) return;

        // Credenciais WiFi novas empurradas pela consola (OTA-config)
        if (record.containsKey("wifi_ssid") && record.containsKey("wifi_password")) {
          const char* ns = record["wifi_ssid"];
          const char* np = record["wifi_password"];
          guardarCredenciaisEmpurradas(ns, np);
        }

        if (record.containsKey("force_reconfig")) {
          bool pedido = record["force_reconfig"];
          if (pedido) {
            apagarWifiEReiniciar();
            return;
          }
        }

        String status = record["status"].as<String>();
        bool servo_state = record["servo_state"];

        Serial.print("[MANUAL] status: ");
        Serial.print(status);
        Serial.print("  | servo_state: ");
        Serial.println(servo_state);

        if (status != "pending" && status != "ready") {
          Serial.println(">>> IGNORADO - status nao permite controlo do servo");
          return;
        }

        // Só mexe o servo quando o estado MUDA (evita repetir a cada heartbeat)
        static int ultimoServo = -1;
        if ((int)servo_state != ultimoServo) {
          ultimoServo = (int)servo_state;
          if (servo_state) {
            servo.write(SERVO_ABERTO);
            Serial.println(">>> Servo aberto MANUALMENTE (carregar encomenda)");
          } else {
            servo.write(SERVO_FECHADO);
            Serial.println(">>> Servo fechado MANUALMENTE (pronto para descolar)");
          }
        }
      }

      else if (tabela == "orders") {
        if (!record.containsKey("drone_id")) return;
        long droneIdEncomenda = record["drone_id"];
        if (droneIdEncomenda != droneId) return;

        if (!record.containsKey("status")) return;
        String status = record["status"].as<String>();

        Serial.print("[AUTO] DB orders.status -> ");
        Serial.println(status);

        if (status == STATUS_ENTREGA) {
          servo.write(SERVO_ABERTO);
          Serial.println(">>> Servo aberto AUTOMATICAMENTE (entrega concluida)");
        }
      }

      break;
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(2000);

  ESP32PWM::allocateTimer(0);
  servo.setPeriodHertz(50);
  servo.attach(SERVO_PIN, 500, 2400);
  servo.write(SERVO_FECHADO);

  Serial.println("Sistema NiceDrop (Universal) iniciado");

  // O id vem SEMPRE do .ino gerado (não da flash). Senão, um ESP32 já usado
  // ficava com o id antigo guardado e ignorava os comandos do drone certo.
  droneId = DRONE_ID_BOOTSTRAP;
  Serial.print("Drone ID: ");
  Serial.println(droneId);

  verificarBotaoDeReset();
  carregarRedesNoMulti();
  if (!ligarComRedesGuardadas(20000)) {
    Serial.println("Redes conhecidas falharam -> a abrir portal WiFiManager (emergencia)");
    configurarWiFiEDroneId();
  }
}

void loop() {

  if (WiFi.status() != WL_CONNECTED) {
    if (millis() - lastWifiAttempt > 5000) {
      lastWifiAttempt = millis();
      Serial.println("WiFi perdido - a tentar religar (WiFiMulti)...");
      wifiMulti.run();
      websocketStarted = false;
    }
  }
  else {
    if (!websocketStarted) {
      Serial.println("WiFi ligado, a iniciar WebSocket...");
      webSocket.beginSSL(supabase_host, supabase_port,
                          ("/realtime/v1/websocket?apikey=" +
                           String(supabase_anon_key) + "&vsn=1.0.0").c_str());
      webSocket.onEvent(webSocketEvent);
      webSocket.setReconnectInterval(5000);
      websocketStarted = true;
    }
    webSocket.loop();

    // Heartbeat: dá sinal de vida a cada 30s -> site mostra ONLINE
    if (millis() - lastHeartbeat > 30000) {
      lastHeartbeat = millis();
      enviarHeartbeat();
    }
  }
}
