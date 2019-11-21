const exec = require('./exec_async').execAsync;
const os = require('os');

const packageName = 'bpmn-studio.tar.gz';

const tarballCommand = `tar -czf ${packageName} bin build config dist node_modules src/resources index.html favicon.ico package-lock.json package.json README.md`;

exec(tarballCommand)
  .then(() => console.log('Success!'))
  .catch((error) => {
    console.log(error);
    process.exit(1);
  });
