# Unterstütze BPMN-Elemente

## Activities

### UserTask

<img src="./bpmn-elements-svg/usertask.svg">

Stellt eine Aufgabe dar, die von Benutzern abgearbeitet werden kann. Der Benutzer kann Eingaben machen.

### ManualTask

<img src="./bpmn-elements-svg/manualtask.svg">

Stellt eine Aufgabe dar, die der Benutzer manuell erledigen und 
dann den Task bestätigen muss.

### Empty-Activity

<img src="./bpmn-elements-svg/emptyactivity.svg">

Pausiert die Prozessausführung, bis der Benutzer sie manuell fortsetzt.
Im Gegensatz zu ManualTask und UserTask, stellt dies keine Aktiviität dar, sondern ist eine einfache, untypisierte Pausierung des Prozesses.

### SendTask

<img src="./bpmn-elements-svg/sendtask.svg">

Verschickt eine vordefinierte Message.
Die Ausführung wird pausiert, bis der SendTask eine Empfangsbestätigung von einem ReceiveTask erhalten hat.

### ReceiveTask

<img src="./bpmn-elements-svg/receivetask.svg">

Wartet auf das Eintreffen eine Message, die durch einen SendTask verschickt wurde.

### ScriptTask

<img src="./bpmn-elements-svg/scripttask.svg">

Führt JavaScript Code Snippets aus.

### ServiceTask

<img src="./bpmn-elements-svg/servicetask.svg">

Erlaubt die automatische Ausführung von bereit gestellten Services der ProcessEngine.
Unterstützt aktuell ExternalTasks und Http Tasks.

### CallActivity

<img src="./bpmn-elements-svg/callactivity.svg">

Führt ein anderes, externes Prozessmodell als Subprozess aus. Das referenzierte Prozessmodell muss auf der ProcessEngine deployed sein.
Der Task wird so lange pausiert, bis der referenzierte Prozess abgeschlossen wurde.

### SubProcess

<img src="./bpmn-elements-svg/subprocess.svg">

Ein Subprozess, der, anders als eine CallActivity, direkt in das Prozessmodell eingebettet wird.
Der Task wird so lange pausiert, bis der Subprozess abgeschlossen wurde.

## Participants/Lanes

### Pool

<img src="./bpmn-elements-svg/participant.svg">

Ein Pool definiert den auszuführenden Prozess.
Ein Pool kann mehrere Lanes enthalten.

### Lanes

<img src="./bpmn-elements-svg/lanes.svg">

Lanes dienen zur Organisation und Veranschaulichung verschiedener Verantwortungsbereiche.
Eine Lane kann beliebig viele FlowNodes enthalten, aber eine FlowNode kann immer nur zu einer Lane gehören.

Der Name der Lane entscheidet dabei, ob ein User die darin enthaltenden FlowNodes sehen, bzw ausführen kann.

### Lanesets

<img src="./bpmn-elements-svg/laneset.svg">

Lanes können weitere Lanes in sich Tragen.
Die Parentlane wird dann Laneset genannt.

## Artifacts

### TextAnnotation

<img src="./bpmn-elements-svg/textannotation.svg">

Die TextAnnotation kann benutzt werden, um z.B. Kommentare an eine FlowNode zu knüpfen.
Für die Heatmap kann man hier ebenfalls eine erwartete Laufzeit anhängen.

Beispiel:

````text
RT: 00:01:45
````

## Gateways

### Exclusive Gateway

<img src="./bpmn-elements-svg/exclusivegateway.svg">

Der Prozess wird zu einem der modellierten, ausgehenden Pfade umgeleitet.
Welcher Pfad genommen wird, hängt davon ab, welcher SequenceFlow eine passende Bedingung enthält.
Ein ExclusiveGateway kann beliebig viele ausgehende Pfade besitzen, jedoch kann immer nur **ein** Pfad pro Prozessinstanz ausgeführt werden.

Es ist möglich einen default SequenceFlow zu definieren, der benutzt wird, falls keiner der SequenceFlows eine zutreffende Bedingung enthält.

### Parallel Gateway

<img src="./bpmn-elements-svg/parallelgateway.svg">

Führt alle modellierten Pfade parallel aus.
Anders als beim ExclusiveGateway, sind die Ausführungen dieser Pfade nicht an Bedingungen geknüpft.

## Events

### StartEvents

<img src="./bpmn-elements-svg/startevent.svg">

Stellt den Beginn eines Prozesses dar.
Kann optional mit einem initialen Token gestartet werden.

#### MessageStartEvent

<img src="./bpmn-elements-svg/messagestartevent.svg">

Der Prozess wird automatisch gestartet, wenn eine passende Message eintrifft.

#### SignalStartEvent

<img src="./bpmn-elements-svg/signalstartevent.svg">

Der Prozess wird automatisch gestartet, wenn ein passendes Signal empfangen wird.

#### TimeStartEvent

<img src="./bpmn-elements-svg/timerstartevent.svg">

Der Prozess wird automatisch gestartet, wenn der angehangene Cronjob getriggert wird.

### IntermediateEvents

<img src="./bpmn-elements-svg/intermediatethrowevent.svg">

Ein untypisiertes Event, das einfach ausgeführt wird, ohne eine Aktion zu tätigen.

#### IntermediateLinkCatchEvent

<img src="./bpmn-elements-svg/intermediatelinkcatchevent.svg">

Führt den Prozess an dieser Stelle weiter, wenn ein passendes `IntermediateLinkThrowEvent` erreicht wurde.

Wichtig:
Es darf pro Prozessmodell immer nur **ein** `IntermediateLinkCatchEvent` pro Link geben!

#### IntermediateLinkThrowEvent

<img src="./bpmn-elements-svg/intermediatelinkthrowevent.svg">

Der Prozessfluss wird über den definierten Link zu einem `IntermediateLinkCatchEvent` weitergeleitet, welches die gleiche Linkdefinition enthält.

#### IntermediateTimerEvent

<img src="./bpmn-elements-svg/intermediatetimerevent.svg">

Startet einen Timer, der die Prozessausführung für eine bestimmte Zeit pausiert.
Es kann eine konkrete Dauer angegeben werden, oder ein bestimmtes Datum, an dem die Prozessausführung fortgesetzt werden soll.

#### SignalIntermediateCatchEvent

<img src="./bpmn-elements-svg/signalintermediatecatchevent.svg">

Pausiert die Prozessausführung, bis ein vordefiniertes Signal empfangen wurde.

#### SignalIntermediateThrowEvent

<img src="./bpmn-elements-svg/signalintermediatethrowevent.svg">

Schickt ein vordefiniertes Signal aus und führt den Prozess ohne Unterbrechung weiter.

Anders als beim SendTask, wird hier nicht auf eine Empfangsbestätigung gewartet ("Fire and forget").

#### MessageIntermediateCatchEvent

<img src="./bpmn-elements-svg/messagecatchevent.svg">

Pausiert die Prozessausführung, bis eine vordefinierte Message empfangen wurde.

#### MessageIntermediateThrowEvent

<img src="./bpmn-elements-svg/messagethrowevent.svg">

Wirft eine Message und führt den Prozess am ausgehenden Pfad weiter.

### BoundaryEvents

#### ErrorBoundaryEvent

<img src="./bpmn-elements-svg/errorboundaryevent.svg">

Im Fall eines Errors am zugehörigen Task wird der Prozess am ausgehenden
Pfad des BoundaryEvents weitergeführt.

#### SignalBoundaryEvent

<img src="./bpmn-elements-svg/signalboundaryevent.svg">

Wenn ein Signal empfangen wird läuft der Prozess am ausgehenden
Pfad des BoundaryEvents weiter. 

#### MessageBoundaryEvent

<img src="./bpmn-elements-svg/messageboundaryevent.svg">

Wenn eine Message empfangen wird läuft der Prozess am ausgehenden
Pfad des BoundaryEvents weiter. 

#### TimerBoundaryEvent

<img src="./bpmn-elements-svg/timerboundaryevent.svg">

Wenn das konfigurierte Datum oder die zu wartende Dauer erreicht wurde, 
läuft der Prozess am ausgehenden Pfad des BoundaryEvents weiter. 

#### NonInterruptingMessageBoundaryEvent

<img src="./bpmn-elements-svg/noninterruptingmessageboundaryevent.svg">

Bricht den Task beim Empfangen einer Message nicht ab und führt den Prozess
zusätzlich am ausgehenden Pfad weiter.

#### NonInterruptingSignalBoundaryEvent

<img src="./bpmn-elements-svg/noninterruptingsignalboundaryevent.svg">

Bricht den Task beim Empfangen eines Signals nicht ab und führt den Prozess
zusätzlich am ausgehenden Pfad weiter.

#### NonInterruptingTimerBoundaryEvent

<img src="./bpmn-elements-svg/noninterruptingtimerboundaryevent.svg">

Bricht den Task nach Ablauf des Datums/der Dauer nicht ab und führt den Prozess
zusätzlich am ausgehenden Pfad weiter.

### EndEvents

<img src="./bpmn-elements-svg/endevent.svg">

Der Prozess wird bei erreichen des Events beendet.

#### ErrorEndEvent

<img src="./bpmn-elements-svg/errorendevent.svg">

Der Prozess wird mit dem modellierten Fehler beendet.

Der Prozess wird dabei auch in der Datenbank als fehlerhaft markiert.

#### SignalEndEvent

<img src="./bpmn-elements-svg/signalendevent.svg">

Sendet beim beenden des Prozesses ein Signal.

#### MessageEndEvent

<img src="./bpmn-elements-svg/messageendevent.svg">

Sendet beim beenden des Prozesses eine Message.

#### TerminateEndEvent

<img src="./bpmn-elements-svg/terminateendevent.svg">

Für die Ausführung mit ParallelGateways:

Wie ErrorEndEvent, forciert jedoch das sofortige Beenden aller parallel laufenden Pfade.
