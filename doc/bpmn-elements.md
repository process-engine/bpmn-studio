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

Wird ausgeführt.

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

Fängt ein Signal und führt den Prozess am ausgehenden Pfad weiter.

#### SignalIntermediateThrowEvent

<img src="./bpmn-elements-svg/signalintermediatethrowevent.svg">

Wirft ein Signal und führt den Prozess am ausgehenden Pfad weiter.

#### MessageIntermediateCatchEvent

<img src="./bpmn-elements-svg/messagecatchevent.svg">

Fängt eine Message und führt den Prozess am ausgehenden Pfad weiter.

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

???

#### SignalEndEvent

<img src="./bpmn-elements-svg/signalendevent.svg">

Sendet beim beenden des Prozesses ein Signal.

#### MessageEndEvent

<img src="./bpmn-elements-svg/messageendevent.svg">

Sendet beim beenden des Prozesses eine Message.

#### TerminateEndEvent

<img src="./bpmn-elements-svg/terminateendevent.svg">

???
