import {HelpText} from '../../../contracts/index';
import {removeMultilineIndent} from '../remove-multiline-indent';

export const DataObjectsUsage: HelpText = {
  title: 'How to use data objects',
  message: removeMultilineIndent(`
  DataObjects present a simple way of storing data for a ProcessInstance globally.

  ![DataObjects Symbol](src/resources/images/data_object_symbol.svg)

  Values are stored by connecting FlowNode Instances to it.

  **How to use it**

  You can place your DataObjects anywhere on your ProcessModel and connect your FlowNodes to it with so called "Data Associations".

  <div style="text-align: left; overflow-y: auto;">
    <img alt="DataObjects" src="src/resources/images/data_objects.svg" width="550px">
  </div>

  **Reading values from DataObjects**

  To read the content of a DataObject, you can use a \`DataInputAssociation\`, which points from the DataObject to the FlowNode.

  In the above example, the Script Task \`Read DataObject\` is connected to a DataObject by such an Association.

  FlowNodes will always receive the full content of the DataObject.

  **Writing values to DataObjects**

  To write content to a DataObject, you can use a \`DataOutputAssociation\`, which points from the FlowNode to the DataObject.

  In the above example, the Script Task \`Create Payload\` is connected to a DataObject by such an Association.

  By default the FlowNode writes the content of its \`onExit\` token to the DataObject.

  **Customized payloads**

  If you wish to customize the value written to the DataObject, you can do so, by configuring a \`dataSource\` property on the \`DataOutputAssociation\` connected to the DataObject.

  <div style="text-align: left; overflow-y: auto;">
    <img alt="DataObjects Custom Payload" src="src/resources/images/data_objects_custom_payload.png" width="450px">
  </div>

  Note that the content of the DataObject will be ***overwritten*** by such a write operation!

  If you want to preserve a value currently stored in the DataObject, you can do so by using the \`currentDataObject\` expression in your \`dataSource\` property.

  <div style="text-align: left; overflow-y: auto;">
    <img alt="DataObjects Current Data Object Expression" src="src/resources/images/data_objects_current_data_object_expression.png" width="450px">
  </div>

  **Using DataObject values**

  To make use of the DataObject values with your FlowNode Instance, you can make use of \`dataObjects\` expressions.
  These work the same way as \`token\` expressions, but will access the values of the connected DataObjects, instead of the token history.

  The syntax is \`dataObjects.<dataObjectId>.<propertyName>\`.

  Example:

  <div style="text-align: left; overflow-y: auto;">
    <img alt="DataObjects Expressions" src="src/resources/images/data_objects_expressions.png" width="450px">
  </div>

  Here we have an External Service Task which gets its values for topic and payload from the DataObject \`MyDataObject_1\`.

  **DataObjects and Sub Processes**

  You can also use DataObjects in a SubProcess.

  <div style="text-align: left; overflow-y: auto;">
    <img alt="DataObjects Subprocess" src="src/resources/images/data_objects_sub_process.png" width="450px">
  </div>

  Keep in mind that DataObjects contained in a SubProcess are only available to the FlowNodes contained within that SubProcess.

  FlowNodes outside the SubProcess ***cannot*** access these DataObjects.
   `),
};
