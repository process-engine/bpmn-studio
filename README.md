![Node CI](https://github.com/process-engine/bpmn-studio/workflows/Node%20CI/badge.svg?branch=master)

# BPMN Studio

BPMN Studio ist eine Desktop- und Web-Applikation zum Erstellen, Verwalten, Ausführen und Auswerten von BPMN-Prozessen, implementiert in Electron, Aurelia & TypeScript.

## Was sind die Ziele dieses Projekts?

BPMN Studio soll es dem Anwender so leicht wie möglich machen BPMN-Diagramme zu
erstellen und zu pflegen. Des Weiteren bringt BPMN Studio eine Workflow
Engine mit, um diese Diagramme auszuführen.

## Relevante URLs

[ProcessEngine.io](https://www.process-engine.io/)

[ProcessEngine Runtime](https://github.com/process-engine/process_engine_runtime)

[Changelog und Release](https://github.com/process-engine/bpmn-studio/releases/latest)

## Downloads für Windows, macOS und Docker

Es stehen [Releases von BPMN Studio für Windows und macOS](https://github.com/process-engine/bpmn-studio/releases/latest) zum Download bereit.

Ein [Docker-Image des kompletten Bundles](https://hub.docker.com/r/5minds/bpmn-studio-bundle) (BPMN Studio & ProcessEngine Runtime) wird auf Docker Hub bereitgestellt.

## Wie kann ich das Projekt aufsetzen?

### Voraussetzungen

* Node [active LTS](https://github.com/nodejs/Release#release-schedule)
* Python 

### Setup/Installation

**TL;DR**

1. `npm install`
1. `npm run build`
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
1. `npm run electron-build-<OS>`
1. `npm test`

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

Nach dem Bauen befindet sich die fertige Applikation im `dist/electron/mac` Ordner.

**Windows:**

Vor dem ersten Build müssen die windows-build-tools installiert werden:

```shell
npm --vs2015 install --global windows-build-tools
```

Danach kann gebuildet werden:

```shell
npm run electron-build-windows
```

Der Buildvorgang generiert im `dist/electron/` Ordner die Datei `bpmn-studio-setup-<VERSION>.exe`.
Diese kann zur Installation der Applikation genutzt werden; 
`<VERSION>` entspricht dabei der Version, in welcher die Applikation installiert wird.

Beispiel:

`dist/electron/bpmn-studio-setup-5.7.0.exe`

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

## Shortcut Skripte

Es sind Skripte in der `package.json` vordefiniert, welche
sich durch `npm run <script name>` ausführen lassen.

Die folgenden Skripte, werden in unserem Tooling verwendet:

* `build`

   Baut alles, was zum Ausführen der Webversion, der Electron-Dev App und der Tests notwendig ist.

* `reinstall`

  Entfernt die aktuell installierten Abhängigkeiten, installiert diese neu und baut die komplette Anwendung.

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

* `lint`

  Startet `eslint` für das gesamte Projekt.

* `electron-build-macos`

  Baut die Electron-Anwendung für macOS.

* `electron-build-windows`

  Baut die Electron-Anwendung für Windows.

* `electron-rebuild`

  Baut alle nativen Abhängigkeiten.

* `test`

  Führt die Spectron Tests für das BPMN Studio in Electron aus.

* `test-electron`

  Baut die Tests und führt diese mit der gebauten BPMN Studio App aus.

* `test-electron-macos`

  Führt die Tests in der Electron Dev Variante auf macOS aus.

  * `test-electron-windows`

  Führt die Tests in der Electron Dev Variante auf Windows aus.


## Was muss ich sonst noch wissen?

Die Konfiguration liegt unter `aurelia_project/environments/dev.ts`.

# Wen kann ich auf das Projekt ansprechen?

[Alexander Kasten](mailto:alexander.kasten@5minds.de)
[Christian Werner](mailto:christian.werner@5minds.de)
[René Föhring](mailto:rene.foehring@5minds.de)
[Steffen Knaup](mailto:steffen.knaup@5minds.de)
