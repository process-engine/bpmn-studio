# BPMN Studio

BPMN Studio ist eine Web- und Desktop-Applikation zur Erstellung, Verwaltung,
Ausführung und Auswertung von BPMN-Prozessen.  Es setzt auf dem BPMN.io auf und
den BPMN-Standard 2.x um.

## Was sind die Ziele dieses Projekts?

BPMN Studio soll es dem Anwender so leicht wie möglich machen BPMN-Diagramme zu
erstellen und zu pflegen.  Des Weiteren kann BPMN Studio mit einer Workflow
Engine verbunden werden, um diese Diagramme auszuführen.

## Relevante URLs

[ProcessEngine](https://github.com/process-engine/process_engine)
[Dokumentation](https://github.com/process-engine/documentation)
[Minimales Skeleton](https://github.com/process-engine/skeleton)

## Wie kann ich das Projekt aufsetzen?

### Voraussetzungen

* Node [active LTS](https://github.com/nodejs/Release#release-schedule)
* Laufende ProcessEngine

### Setup/Installation

**TL;DR**

1. `npm install`
1. `npm run build`
1. `npm run electron-build-<OS>`
1. `npm start` / `npm run start_dev`

**Notizen:**

1. Für `npm run electron-build-<OS>` gilt:

   Für den Platzhalter `<OS>` können folgende Werte eingesetzt werden:

   - `macos` für MacOS
   - `windows` für Windows

   Beispiel:

   `npm run electron-build-macos`

**TL;DR Tests**

1. `npm start`
1. `npm run test-init`
1. `npm run test`

## Wie kann ich das Projekt benutzen?

### Installation der Abhängigkeiten

Die Abhängigkeiten werden wie folgt installiert:

```shell
npm install
```

### Benutzung

**Zum bauen:**

```shell
npm run build
```

Dieses Skript baut die Anwendung, das Ergebnis ist produktionsreif.

**Zum starten:**

```shell
npm start
```

Dieses Skript startet die statische Auslieferung der Anwendung auf Port 17290.
Zuerst muss die Anwendung gebaut worden sein.

Es ist möglich einen anderen Port zu spezifizieren:

```shell
npm start -- --port 9000
```

Das startet das BPMN Studio auf Port 9000.

**Anmerkung**

Der Port muss aus technischen Gründen zwischen 1000 und 65535 liegen.

**Erreichbarkeit**

Es ist möglich eine andere IP-Adresse als 127.0.0.1 zu spezifizieren:

```shell
npm start -- --host 0.0.0.0
```

Damit ist das BPMN Studio auch von außen erreichbar.

**Zum starten (Entwicklung)**

```shell
npm run start_dev
```

Dieses Skript startet die Auslieferung der Anwendung für die Entwicklung.
Bei Änderungen im Quelltext wird die Anwendung neugebaut und der Webbrowser
automatisch neu geladen.

### Electron Applikation

**Zum bauen:**

**Mac:**

```shell
npm run electron-build-macos
```

Nach dem Bauen kann man in dem `dist/mac` Ordner die fertige Applikation finden
und ausführen.

**Windows:**

Vor dem erstmaligen Builden müssen  die windows-build-tools installiert werden:

```shell
npm install --global --production windows-build-tools
```

Danach kann gebuildet werden:

```shell
npm run electron-build-windows
```

Nach dem Bauen, kann man in dem `dist/` Ordner die Datei `bpmn-studio Setup
<VERSION>.exe` ausführen, um die Applikation zu installieren; `<VERSION>` wird
durch die entsprechende Version ersetzt.

Beispiel:

`dist/bpmn-studio Setup 1.2.1.exe`

**Alternative:**

Die Releases des BPMN Studios lassen sich alternativ auch
[hier](https://github.com/process-engine/bpmn-studio/releases)
herunterladen.

### Docker Image

#### Container bauen

Das Image lässt sich wie folgt bauen:

```shell
docker build --tag bpmn-studio:latest .
```

#### Container bauen mit optionalen Parametern

Es ist möglich, das base image, sowie die Paketversionen anzupassen:

* `node_version`: Base image version mit NodeJS und Alpine Linux

```shell
docker build --build-arg node_version=10-alpine \
             --tag bpmn-studio:latest.
```

#### Container starten

Der Container lässt sich mit folgendem Befehl starten:

```shell
docker run -p 9000:9000 bpmn-studio:latest
```

Anschließend lässt sich das BPMN Studio unter URL `http://localhost:17290`
aufrufen.

## End-to-End-Tests

Die End-to-End-Tests werden mit Hilfe des
[Protractor Frameworks](https://www.protractortest.org/#/)
durchgeführt.

Unser Ziel ist es, die Testabdeckung ausreichend auszubauen, um das Vertrauen
in einen Release zu verbessern. Es wird keine 100% Abdeckung angestrebt, aber
generelle Tests für alle unterstützten Plattformen sind gewünscht.

**Hinweis:**

Alle Befehle müssen im geklonten Repository ausgeführt werden.

**Hinweis:**

Aufgrund eines
[Fehlers](https://github.com/process-engine/process_engine_runtime/issues/9)
bei der verwendeten Version der ProcessEngine-Runtime, schlagen aktuell einige
Tests fehl.

### Voraussetzungen

Es werden folgende Pakete benötigt:

1. Allgemein:

   * [Java Development Kit](http://www.oracle.com/technetwork/java/javase/downloads/jdk8-downloads-2133151.html)
   * [Chrome](https://www.google.com/intl/de_ALL/chrome/)

1. Nur bei lokalen Tests mit Docker:

   * Docker

1. Nur bei CrossBrowserTesting:

   * VM oder vergleichbares mit öffentlicher IP
   * Docker
   * CrossBrowserTesting Account

### Lokale Tests ohne Docker ausführen

1. Initial müssen folgende Befehle in einem Terminal ausgeführt werden:

   ```shell
   npm install
   ```

1. Anschließend folgenden Befehl eingeben, um den Selenium Server und die ProcessEngine zu starten:

   ```shell
   npm run test-init
   ```

1. Die End-to-End Tests können in einem weiteren Terminal mit folgendem Befehl
   gestartet werden:

   ```shell
   npm run test
   ```

### Lokale Tests mit Docker ausführen

1. Ein Terminal öffnen und folgenden Befehl eingeben, um den Selenium
   Server zu starten:

   ```shell
   npm run test-init
   ```

1. Die End-to-End Tests können in einem weiteren Terminal mit folgendem Befehl
   gestartet werden:

   ```shell
   npm run test-docker
   ```

### Crossbrowser Tests mit Docker ausführen

[<img src="https://crossbrowsertesting.com/design/images/brand/cbt-sb-logo.svg" width="250px">](https://crossbrowsertesting.com)

1. Initial müssen folgende Umgebungsvariablen gesetzt werden:

   ```shell
   export CB_USER=""           # CrossBrowserTesting E-Mail Adresse
   export CB_KEY=""            # CrossBrowserTesting API Key
   export aureliaUrl=""        # URL oder IP der VM + Port des BPMN Studios, z.B. http://1.1.1.1:9000
   export processEngineUrl=""  # URL oder IP der VM + Port der ProcessEngine, z.B. http://1.1.1.1:8000
   ```

1. Ein Terminal öffnen und das BPMN Studio auf der VM mit folgendem Befehl
   starten:

   ```shell
   docker run -p 8000:8000 -p 9000:9000 5minds/bpmn-studio-bundle:latest
   ```

1. Ein Terminal auf dem lokalen Computer öffnen und mit folgenden Befehl die
   CrossBrowserTesting Tests starten:

   ```shell
   npm run test-crossbrowser
   ```

## Shortcut Skripte

Es sind Skripte in der `package.json` vordefiniert, welche
sich durch `npm run <script name>` ausführen lassen.

Die folgenden Skripte, werden in unserem Tooling verwendet:

* `build`

   Baut das Aurelia Bundle.

* `reinstall`

  Entfernt die aktuell installierten Abhängigkeiten und installiert diese neu.

* `reset`

  Entfernt alle aktuell installierten Abhängigkeiten.

* `start`

  Startet die BPMN Studio Webanwendung.

* `start_dev`

  Startet die BPMN Studio Webanwendung und trackt die Quelldatein
  (geänderte Quelltextdatein werden neu transpiliert und die
  Webanwendung wird neu geladen).

* `electron-start-dev`

  Baut das Aurelia Bundle und startet die Electron Anwendung.

* `reset`

  Entfernt alle node_modules, die `package-lock.json` Datei und bereinigt den NPM-Cache.

* `lint`

  Startet `eslint` für das gesamte Projekt.

* `electron-build-macos`

  Baut die Electron-Anwendung für macOS.

* `electron-build-windows`

  Baut die Electron-Anwendung für Windows.

* `electron-rebuild`

  Baut alle nativen Abhängigkeiten.

* `test-init`

  Startet die installierte ProcessEngine und den Webdriver, welcher für
  die End-to-End Tests benötigt wird.

* `test`

  Führt die End-to-End Tests für das BPMN Studio Frontend aus.

* `test-docker`

  Startet die BPMN Studio Webanwendung als Docker Container und führt
  die End-to-End Tests gegen der im Container laufenden Instanz der
  BPMN Studio Webanwendung aus.

## Was muss ich sonst noch wissen?

Die Konfiguration liegt unter `aurelia_project/environments/dev.ts`.

# Wen kann ich auf das Projekt ansprechen?

[Christoph Gnip](mailto:christoph.gnip@5minds.de)
[Alexander Kasten](mailto:alexander.kasten@5minds.de)
[Paul Heidenreich](mailto:paul.heidenreich@5minds.de)
