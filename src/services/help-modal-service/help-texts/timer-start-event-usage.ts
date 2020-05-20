import {HelpText} from '../../../contracts/index';
import {removeMultilineIndent} from '../remove-multiline-indent';

export const TimerStartEventUsage: HelpText = {
  title: 'How to use timer events',
  message: removeMultilineIndent(`
  #### Timer Start Event

  ![Timer Start Event](src/resources/images/timer_start_event_and_sequence_flow.svg)

  \`Timer Start Events\` can be used to start process instances by use of a timer.

  There are three different types of timers that can be attached to a Start Event:
  * \`Date\`: It's the date and time at which the event should continue.
    The date must be specified according to the <a href="https://en.wikipedia.org/wiki/ISO_8601#Dates" target="_blank">ISO 8601 date standard</a>
    and may also include a time according to the <a href="https://en.wikipedia.org/wiki/ISO_8601#Times" target="_blank">ISO 8601 time standard</a>.
    To do so, <a href="https://en.wikipedia.org/wiki/ISO_8601#Combined_date_and_time_representations" target="_blank">the letter "T" must be used as a delimiter</a>.
    If a time is specified, a time zone according to the <a href="https://en.wikipedia.org/wiki/ISO_8601#Times" target="_blank">ISO 8601 timezone standard</a> can also be specified.

    For example:
      * \`2030-12-06\` - waits untill the 6th of December 2030
      * \`2030-12-06T19:15\` - waits untill the 6th of December 2030 at 19:15
      * \`2030-12-06T19:15+02:00\` - waits untill the 6th of December 2030 at 19:15 (CEST or UTC+2)


  * \`Duration\`: It's the amount of time that the event should wait. The duration must be specified according to the <a href="https://en.wikipedia.org/wiki/ISO_8601#Durations" target="_blank">ISO 8601 duration standard</a>.

    For example:
      * \`PT5S\` - waits 5 seconds
      * \`PT12H\` - waits 12 hours
      * \`token.current\` - uses the value of the current process token


  * \`Cycle\`: Uses a <a href="https://en.wikipedia.org/wiki/Cron#Overview" target="_blank">crontab syntax</a> to start new process instances from this Start Event periodically.

    For example:
      * \`*/2 * * * * *\` - Executes every 2 seconds
      *\`0 0 13 * * *\` - Executes everyday at 1pm


  **How to use it**

  Date- or Duration-based timers will start, as soon as you start the process instance manually.

  Cyclic timers, on the other hand, will be started automatically.

  You only need to deploy the diagram to the AtlasEngine.
  Make sure the start event with the cyclic timer is \`enabled\`.

  You can also start a process model with a cyclic timer manually, but if you do so, the process model will start immediately and not wait for the cronjob to expire.

  **Example**

  Whenever the <a href="https://en.wikipedia.org/wiki/Cron#Overview" target="_blank">crontab</a> expires, a new process instance is started automatically, starting at this Start Event.

  The example below shows a Timer Start Event \`Cycle\` configuration.
  It starts a new instance at 22:00 on every day-of-week from monday through friday.

  <img src="src/resources/images/timer_start_event_configuration.png" width="300px">
  `),
};
