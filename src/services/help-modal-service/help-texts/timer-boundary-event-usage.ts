import {HelpText} from '../../../contracts/index';
import {removeMultilineIndent} from '../remove-multiline-indent';

export const TimerBoundaryEventUsage: HelpText = {
  title: 'How to use timer events',
  message: removeMultilineIndent(`
  #### Timer Boundary Event

  The Timer Boundary Event is triggered when the attached timer definition expires.

  **How to use it**

  A Timer Boundary Event can be of the \`Date\` or \`Duration\` type.

  * For a \`Date\` timer, it's the date and time at which the event should continue.
    The date must be specified according to the <a href="https://en.wikipedia.org/wiki/ISO_8601#Dates" target="_blank">ISO 8601 date standard</a>
    and may also include a time according to the <a href="https://en.wikipedia.org/wiki/ISO_8601#Times" target="_blank">ISO 8601 time standard</a>.
    To do so, <a href="https://en.wikipedia.org/wiki/ISO_8601#Combined_date_and_time_representations" target="_blank">the letter "T" must be used as a delimiter</a>.
    If a time is specified, a time zone according to the <a href="https://en.wikipedia.org/wiki/ISO_8601#Times" target="_blank">ISO 8601 timezone standard</a> can also be specified.

    For example:
      * \`2030-12-06\` - waits untill the 6th of December 2030
      * \`2030-12-06T19:15\` - waits untill the 6th of December 2030 at 19:15


  * For a \`Duration\` timer, it's the amount of time that the event should wait.
    The duration must be specified according to the <a href="https://en.wikipedia.org/wiki/ISO_8601#Durations" target="_blank">ISO 8601 duration standard</a>.

    For example:
      * \`PT5S\` - waits 5 seconds
      * \`PT12H\` - waits 12 hours
      * \`token.current\` - uses the value of the current process token


  A Timer Boundary Event can be interrupting, nor non-interrupting.

  Interrupting Timer Boundary Event:

  ![Timer Boundary Event](src/resources/images/timer_boundary_event.svg)

  Non-Interrupting Timer Boundary Event:

  ![Timer Boundary Event Non-Interrupting](src/resources/images/non-interrupting_timer_boundary_event.svg)

  **Example**

  <div style="text-align: left; overflow-y: auto;">
    <img alt="Timer Boundary Event Example" src="src/resources/images/timer_boundary_event_example.svg" width="550px">
  </div>

  In this example, a Timer Boundary Event is triggered, if the \`Do Stuff\` task has not finished within 15 minutes.
  It's a duration timer that waits for 15 minutes (\`PT15M\`) till it interrupts the \`Do Stuff\` task and executes the \`Do other Stuff\` task.
  `),
};
