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

def buildIsRequired = true

pipeline {
  agent any
  options {
    buildDiscarder(logRotator(numToKeepStr: '20', artifactNumToKeepStr: '20'))
  }
  tools {
    nodejs "node-lts"
  }
  environment {
    NPM_RC_FILE = 'developers5minds-token'
    NODE_JS_VERSION = 'node-lts'
  }
  stages {
    stage('Check if build is required') {
      steps {
        script {
          // Taken from https://stackoverflow.com/questions/37755586/how-do-you-pull-git-committer-information-for-jenkins-pipeline
          sh 'git --no-pager show -s --format=\'%an\' > commit-author.txt'
          def commitAuthorName = readFile('commit-author.txt').trim()

          def ciAdminName = "admin" // jenkins will set this name after every restart, so we need to look out for this.
          def ciUserName = "process-engine-ci"

          echo(commitAuthorName)
          echo("Commiter is process-engine-ci: ${commitAuthorName == ciUserName}")

          buildIsRequired = commitAuthorName != ciAdminName && commitAuthorName != ciUserName

          if (!buildIsRequired) {
            echo("Commit was made by process-engine-ci. Skipping build.")
          }
        }
      }
    }
    stage('Prepare version') {
      when {
        expression {buildIsRequired == true}
      }
      steps {
        sh('npm ci')
        // sh('node ./node_modules/.bin/ci_tools npm-install-only @process-engine/ @essential-projects/')

        // does prepare the version, but not commit it
        sh('node ./node_modules/.bin/ci_tools prepare-version --allow-dirty-workdir')

        stash(includes: 'package.json', name: 'package_json')
        stash(includes: 'node_modules/', name: 'npm_package_node_modules')
      }
    }
    stage('Build & test') {
      when {
        expression {buildIsRequired == true}
      }
      parallel {
        stage('Lint sources') {
          steps {
            unstash('npm_package_node_modules')
            unstash('package_json')

            sh('npm run lint')
          }
        }
        stage('Build & test npm package') {
          steps {
            unstash('npm_package_node_modules')
            unstash('package_json')

            sh('npm run build')

            sh('npm test')

            stash(includes: 'dist/web/@fortawesome/, dist/web/, config/', name: 'npm_package_results')
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

            sh('npm run test')

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

            bat('npm test')

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
    stage('Commit & tag version') {
      when {
        allOf {
          expression {buildIsRequired == true}
          anyOf {
            branch "master"
            branch "beta"
            branch "develop"
          }
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
      when {
        expression {buildIsRequired == true}
      }
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
    stage('Create Tarball') {
      when {
        allOf {
          expression {buildIsRequired == true}
          anyOf {
            branch "master"
            branch "beta"
            branch "develop"
          }
        }
      }
      steps {
        sh('npm run create-tarball')

        stash('bpmn-studio.tar.gz')
      }
    }
    stage('Build Docker') {
      when {
        allOf {
          expression {buildIsRequired == true}
          anyOf {
            branch "master"
            branch "beta"
            branch "develop"
          }
        }
      }
      steps {
        script {
          unstash('package_json')
          unstash('bpmn-studio.tar.gz')


          script {
            bpmn_studio_raw_package_version = sh(script: 'node --print --eval "require(\'./package.json\').version"', returnStdout: true)
            bpmn_studio_version = bpmn_studio_raw_package_version.trim()
            echo("bpmn_studio_version is '${bpmn_studio_version}'")
          }

          def docker_image_name = '5minds/bpmn-studio-bundle';
          def docker_node_version = '10-alpine';


          full_image_name = "${docker_image_name}:${bpmn_studio_version}";

          sh("docker build --build-arg NODE_IMAGE_VERSION=${docker_node_version} \
                          --build-arg BPMN_STUDIO_VERSION=${bpmn_studio_version} \
                          --build-arg BUILD_DATE=${BUILD_TIMESTAMP} \
                          --no-cache \
                          --tag ${full_image_name} .");



          docker_image = docker.image(full_image_name);
        }
      }
    }
    stage('Publish Docker') {
      when {
        allOf {
          expression {buildIsRequired == true}
          anyOf {
            branch "master"
            branch "beta"
            branch "develop"
          }
        }
      }
      steps {
        script {
          try {
            def bpmn_studio_version = bpmn_studio_version

            withDockerRegistry([ credentialsId: "5mio-docker-hub-username-and-password" ]) {

              docker_image.push("${bpmn_studio_version}");
            }
          } finally {
            sh("docker rmi ${full_image_name} || true");
          }
        }
      }
    }
    stage('Cleanup') {
      when {
        expression {buildIsRequired == true}
      }
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
