#!/bin/bash
_VERSION="0.0.1"

############
# This script reinstalls the current developement setup by:
#   * Deletes the node_modules directory
#   * Clears the NPM - Cache
#   * Reinstalling all required node modules (the package-lock file is accounted for and must exist)
#   * Rebuilding
#
# Note: Please DO NOT ADD THIS SCRIPT TO THE Jenkinsfile!
#
# This script is meant to give you, the human developer, a convenient way, to
# reinstall your setup. Adding this script to the jenkinsfile would not make
# that much sense, because:
#   * The Jenkins *should* offer a clean setup anyway
#   * The Jenkins already executes npm install (Since npm does not seems to that
#     consistent, a multiple execution of npm install may lead to an undefined
#     behavior and is pointless anyways.
############

# Reset the current setup
echo "Removing Node Modules..."
rm -rf node_modules/

echo "Clearing npm cache..."
npm cache clean --force

# Reinstalling your node modules
echo "Installing node modules..."

# If an old path is set, use it.
# This is necessary because when executing this script from npm run ...,
# npm overrides the PATH - Variable and sets the path to npm to the current
# working directories 'node_modules' directory.
if [[ ! -z $OLD_PATH ]]; then
  PATH=$OLD_PATH
fi

# npm ci takes the package-lock file into account.
# npm i recreates it after each install.
npm ci

# If npm install fails, its likely that also the build process would fail,
# so we can exit here.
if [[ $? -ne 0 ]]; then
  echo "Error while running npm install. Exiting..."
  exit 1
fi

# Build all modules
echo "Building..."
npm run build
