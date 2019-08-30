#!/usr/bin/env groovy

def cleanup_workspace() {
  cleanWs()
  dir("${env.WORKSPACE}@tmp") {
    deleteDir()
  }
  dir("${env.WORKSPACE}@script") {
    deleteDir()
  }
  dir("${env.WORKSPACE}@script@tmp") {
    deleteDir()
  }
}

pipeline {
  agent any
  tools {
    nodejs "node-lts"
  }
  environment {
    NPM_RC_FILE = 'developers5minds-token'
    NODE_JS_VERSION = 'node-lts'
  }
  stages {
    stage('Prepare version') {
      steps {
        sh('npm ci')
        // sh('node ./node_modules/.bin/ci_tools npm-install-only @process-engine/ @essential-projects/')

        // does prepare the version, but not commit it
        sh('node ./node_modules/.bin/ci_tools prepare-version --allow-dirty-workdir')

        stash(includes: 'package.json', name: 'package_json')
      }
    }
    stage('Build & test') {
      parallel {
        stage('Build & test npm package') {
          steps {
            unstash('package_json')

            sh('npm ci')
            // sh('node ./node_modules/.bin/ci_tools npm-install-only @process-engine/ @essential-projects/')

            sh('npm run build')

            sh('npm test')

            stash(includes: 'dist/web/@fortawesome/, dist/web/, config/', name: 'npm_package_results')
            stash(includes: 'node_modules/', name: 'npm_package_node_modules')
          }
        }
        stage('Build & test on MacOS') {
          agent {
            label "macos"
          }
          steps {
            unstash('package_json')

            sh('npm install') // TODO: replace with `npm ci`

            withCredentials([string(credentialsId: 'apple-mac-developer-certifikate', variable: 'CSC_LINK')]) {
              sh('npm run electron-build-macos')
            }

            sh('SPECTRON_APP_PATH=dist/electron/mac/BPMN Studio \\(Beta\\).app/Contents/MacOS/BPMN Studio \\(Beta\\) npm run test-electron-macos')

            stash(includes: 'dist/electron/*.*, dist/electron/mac/*', excludes: 'electron-builder-effective-config.yaml', name: 'macos_electron_results')
          }
          post {
            always {
              cleanup_workspace()
            }
          }
        }
        stage('Build & test on Windows') {
          agent {
            node {
              label "windows"
              customWorkspace "ws/b${System.currentTimeMillis()}"
            }
          }
          steps {
            unstash('package_json')

            bat('npm install') // TODO: replace with `npm ci`

            bat('npm run electron-build-windows')

            bat('npm run test-electron-windows')

            stash(includes: 'dist/electron/*.*', excludes: 'electron-builder-effective-config.yaml', name: 'windows_electron_results')
          }
          post {
            always {
              cleanup_workspace()
            }
          }
        }
      }
    }
    stage('Lint sources') {
      steps {
        unstash('npm_package_node_modules')
        unstash('package_json')

        sh('npm run lint')
      }
    }
    stage('Commit & tag version') {
      when {
        anyOf {
          branch "master"
          branch "beta"
          branch "develop"
        }
      }
      steps {
        unstash('npm_package_node_modules')
        unstash('package_json')

        withCredentials([
          usernamePassword(credentialsId: 'process-engine-ci_github-token', passwordVariable: 'GH_TOKEN', usernameVariable: 'GH_USER')
        ]) {
          // does not change the version, but commit and tag it
          sh('node ./node_modules/.bin/ci_tools commit-and-tag-version --only-on-primary-branches')

          sh('node ./node_modules/.bin/ci_tools update-github-release --only-on-primary-branches --use-title-and-text-from-git-tag');
        }

        stash(includes: 'package.json', name: 'package_json')
      }
    }
    stage('Publish') {
      parallel {
        stage('Publish npm package') {
          steps {
            unstash('npm_package_node_modules')
            unstash('package_json')

            nodejs(configId: env.NPM_RC_FILE, nodeJSInstallationName: env.NODE_JS_VERSION) {
              sh('node ./node_modules/.bin/ci_tools publish-npm-package --create-tag-from-branch-name')
            }
          }
        }
        stage('Publish desktop apps') {
          when {
            anyOf {
              branch "master"
              branch "beta"
              branch "develop"
            }
          }
          steps {
            unstash('npm_package_node_modules')
            unstash('macos_electron_results')
            unstash('windows_electron_results')

            withCredentials([
              usernamePassword(credentialsId: 'process-engine-ci_github-token', passwordVariable: 'GH_TOKEN', usernameVariable: 'GH_USER')
            ]) {
              sh("""
              node ./node_modules/.bin/ci_tools update-github-release \
                                                --assets dist/electron/bpmn-studio-setup-*.exe \
                                                --assets dist/electron/bpmn-studio-setup-*.exe.blockmap \
                                                --assets dist/electron/bpmn-studio-setup-*.zip \
                                                --assets dist/electron/bpmn-studio-setup-*.dmg \
                                                --assets dist/electron/bpmn-studio-setup-*.dmg.blockmap \
                                                --assets dist/electron/latest-mac.yml \
                                                --assets dist/electron/latest.yml
              """);
            }
          }
        }
      }
    }
    stage('Cleanup') {
      steps {
        script {
          // this stage just exists, so the cleanup-work that happens in the post-script
          // will show up in its own stage in Blue Ocean
          sh(script: ':', returnStdout: true);
        }
      }
    }
  }
  post {
    always {
      script {
        cleanup_workspace();
      }
    }
  }
}
