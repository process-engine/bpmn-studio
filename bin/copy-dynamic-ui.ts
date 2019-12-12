import fs from 'fs-extra';
import path from 'path';

const DYNAMICUI_PATH = path.join(process.cwd(), 'node_modules', '@process-engine', 'dynamic_ui_core');
const DESTINATION_PATH = path.join(process.cwd(), 'dist', 'web', 'dynamic_ui_core');

function copyDynamicUi(): void {
  try {
    fs.copySync(DYNAMICUI_PATH, DESTINATION_PATH, {dereference: true});
    console.log(`Successfully copied ${DYNAMICUI_PATH} to ${DESTINATION_PATH}`);
  } catch (err) {
    console.error(err);
  }
}

copyDynamicUi();
