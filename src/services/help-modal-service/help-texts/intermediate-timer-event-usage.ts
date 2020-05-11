import {HelpText} from '../../../contracts/index';
import {removeMultilineIndent} from '../remove-multiline-indent';

export const IntermediateTimerEventUsage: HelpText = {
  title: 'How to use timer events',
  message: removeMultilineIndent(`
  #### Intermediate Timer Event

  ![Intermediate Timer Event](src/resources/images/intermediate_timer_event.svg)

  The Intermediate Timer Event is used to pause the process execution for a given amount of time, or until a certain date has been reached.

  **How to use it**

  An Intermediate Timer Event is configured with two parameters.

  First, the type of timer to execute:

  - Date
  - Duration

  Second, the value of the timer.

  * For a \`Date\` timer, it's the date and time at which the event should continue. The date must be specified according to the <a href="https://en.wikipedia.org/wiki/ISO_8601#Dates" target="_blank">ISO 8601 date standard</a> and may also include a time according to the <a href="https://en.wikipedia.org/wiki/ISO_8601#Times" target="_blank">ISO 8601 time standard</a>. To do so, <a href="https://en.wikipedia.org/wiki/ISO_8601#Combined_date_and_time_representations" target="_blank">the letter "T" must be used as a delimiter</a>.

    For example:
      * \`2030-12-06\` - waits untill the 6th of December 2030
      * \`2030-12-06T19:15\` - waits untill the 6th of December 2030 at 19:15


  * For a \`Duration\` timer,  it's the amount of time that the event should wait. The duration must be specified according to the <a href="https://en.wikipedia.org/wiki/ISO_8601#Durations" target="_blank">ISO 8601 duration standard</a>.

    For example:
      * \`PT5S\` - waits 5 seconds
      * \`PT12H\` - waits 12 hours
      * \`token.current\` - uses the value of the current process token


  **Example**

  <div style="text-align: left; overflow-y: auto;">
    <img alt="Intermediate Timer Event Example" src="src/resources/images/intermediate_timer_event_example.svg" width="550px">
  </div>

  In this example, an Intermediate Timer Event is triggered, after the \`Perform work 1\` task has finished.
  It's a duration timer that pauses the process execution for 5 seconds (\`PT5S\`).
  After the 5 seconds are over, the process execution continues with the \`Perform work 2\` task.
  `),
};
