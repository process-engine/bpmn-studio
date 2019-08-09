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

Der Prozess halt bei der Ausführung an dem Task an.
Es wird gewartet bis der Benutzer die Ausführung weiterführt.

### SendTask

<img src="./bpmn-elements-svg/sendtask.svg">

Sendet eine vorher definierte Message an die ProcessEngine.

### ReceiveTask

<img src="./bpmn-elements-svg/receivetask.svg">

Empfängt eine Message.

### ScriptTask

<img src="./bpmn-elements-svg/scripttask.svg">

Führt JavaScript aus.

### ServiceTask

<img src="./bpmn-elements-svg/servicetask.svg">

Zur Benutzung von der ProcessEngine bereitgestellten Services.
Aktuell HTTP Tasks und ExternalTasks.

### CallActivity

<img src="./bpmn-elements-svg/callactivity.svg">

Führt ein anderes auf der ProcessEngine befindliches Prozessmodell aus.

### SubProcess

<img src="./bpmn-elements-svg/subprocess.svg">

Ein SubProcess.

## Participants/Lanes

### Pool

<img src="./bpmn-elements-svg/participant.svg">

Ein Pool definiert den auszuführenden Prozess.
Ein Diagramm kann mehrere Pools enthalten und Pools können mehrere Lanes enthalten.

### Lanes

<img src="./bpmn-elements-svg/lanes.svg">

Lanes dienen zur Organisation und Veranschaulichung verschiedener Verantwortungsbereiche.

### Lanesets

<img src="./bpmn-elements-svg/laneset.svg">

Lanes können weitere Lanes in sich Tragen.
Die Parentlane wird dann Laneset genannt.

## Artifacts

### TextAnnotation

<img src="./bpmn-elements-svg/textannotation.svg">

Die TextAnnotation kann benutzt werden um an Elementen/Activites eine erwartete Laufzeit zu definieren.

Beispiel:

````text
RT: 00:01:45
````

## Gateways

### Exclusive Gateway

<img src="./bpmn-elements-svg/exclusivegateway.svg">

Der Prozessfluss wird in Abhängigkeit einer vorher an Sequenzflows definierten Bedingung geleitet. Es können mehrere Pfade verbunden werden.

### Parallel Gateway

<img src="./bpmn-elements-svg/parallelgateway.svg">

Hängt nicht von einer Bedingung ab, sondern leitet den Prozessfluss an alle ausgehende Pfade.

## Events

### StartEvents

<img src="./bpmn-elements-svg/startevent.svg">

Der Prozess wird optional mit einem initiellen Token über ein normales StartEvent gestartet.

#### MessageStartEvent

<img src="./bpmn-elements-svg/messagestartevent.svg">

Der Prozess wird anhand einer Message gestartet.

#### SignalStartEvent

<img src="./bpmn-elements-svg/signalstartevent.svg">

Der Prozess wird anhand eines Signals gestartet.

#### TimeStartEvent

<img src="./bpmn-elements-svg/timerstartevent.svg">

Der Prozess wird anhand eines Timers im Cronjob format gestartet.

### IntermediateEvents

<img src="./bpmn-elements-svg/intermediatethrowevent.svg">

#### IntermediateLinkCatchEvent

<img src="./bpmn-elements-svg/intermediatelinkcatchevent.svg">

Wenn der Link gecatcht wird, wird der Prozessfluss an den ausgehenden Pfaden des Events weitergeführt.

#### IntermediateLinkThrowEvent

<img src="./bpmn-elements-svg/intermediatelinkthrowevent.svg">

Es wird ein Link mit einem vorher definierten Linkname geworfen.

#### IntermediateTimerEvent

<img src="./bpmn-elements-svg/intermediatetimerevent.svg">

Es kann ein Datum oder eine Dauer/Duration gesetzt werden, an dem die Ausführung des Prozesses fortgeführt wird.

#### SignalIntermediateCatchEvent

<img src="./bpmn-elements-svg/signalintermediatecatchevent.svg">

#### SignalIntermediateThrowEvent

<img src="./bpmn-elements-svg/signalintermediatethrowevent.svg">


#### MessageIntermediateCatchEvent

<img src="./bpmn-elements-svg/messagecatchevent.svg">


#### MessageIntermediateThrowEvent

<img src="./bpmn-elements-svg/messagethrowevent.svg">

### BoundaryEvents

#### ErrorBoundaryEvent

<img src="./bpmn-elements-svg/errorboundaryevent.svg">

#### NonInterruptingMessageBoundaryEvent

<img src="./bpmn-elements-svg/noninterruptingmessageboundaryevent.svg">


#### NonInterruptingSignalBoundaryEvent

<img src="./bpmn-elements-svg/noninterruptingsignalboundaryevent.svg">

#### NonInterruptingTimerBoundaryEvent

<img src="./bpmn-elements-svg/noninterruptingtimerboundaryevent.svg">

### EndEvents

<img src="./bpmn-elements-svg/endevent.svg">

Der Prozess wird bei erreichen des Events beendet.

#### ErrorEndEvent

<img src="./bpmn-elements-svg/errorendevent.svg">

#### SignalEndEvent

<img src="./bpmn-elements-svg/signalendevent.svg">

#### MessageEndEvent

<img src="./bpmn-elements-svg/messageendevent.svg">

#### TerminateEndEvent

<img src="./bpmn-elements-svg/terminateendevent.svg">

#### EscalationEndEvent

<img src="./bpmn-elements-svg/escalationendevent.svg">

