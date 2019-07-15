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

def find_available_version_for_publish() {

  def availableVersionFound = false;

  def additionalIndex = 0;

  while (!availableVersionFound) {

    def first_seven_digits_of_git_hash = env.GIT_COMMIT.substring(0, 8);
    def publish_version = "${package_version}-${first_seven_digits_of_git_hash}-b${env.BUILD_NUMBER}-${additionalIndex}";

    try {
      echo "Attempting to use version ${publish_version} for publish";

      nodejs(configId: env.NPM_RC_FILE, nodeJSInstallationName: env.NODE_JS_VERSION) {
        sh('node --version')
        sh("npm version ${publish_version} --no-git-tag-version")
      }

      availableVersionFound = true;
    } catch (Exception error) {
      additionalIndex++
      echo "Version ${publish_version} already exists";
    }
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
    stage('prepare') {
      steps {
        script {
          raw_package_version = sh(script: 'node --print --eval "require(\'./package.json\').version"', returnStdout: true)
          package_version = raw_package_version.trim()
          echo("Package version is '${package_version}'")

          branch = env.BRANCH_NAME;
          branch_is_master = branch == 'master';
          branch_is_develop = branch == 'develop';
          branch_is_release = branch.startsWith('release/');

          if (branch_is_master) {
            full_electron_release_version_string = "${package_version}";
          } else {
            full_electron_release_version_string = "${package_version}-pre-b${env.BUILD_NUMBER}";
          }

          // When building a non master or develop branch the release will be a draft.
          release_will_be_draft = !branch_is_master && !branch_is_develop;

          echo("Branch is '${branch}'")
        }
        nodejs(configId: env.NPM_RC_FILE, nodeJSInstallationName: env.NODE_JS_VERSION) {
          sh('node --version')
          sh('npm cache clean --force')
          sh('npm install')
          sh('npm rebuild')
        }

        archiveArtifacts('package-lock.json')
      }
    }
    stage('lint') {
      steps {
        sh('node --version')
        sh('npm run lint')
      }
    }
    stage('build') {
      steps {
        sh('node --version')
        sh('npm run build')
        sh("npm version ${full_electron_release_version_string} --allow-same-version --force --no-git-tag-version")

        stash(includes: '@fortawesome/, bootstrap/, scripts/, config/, package.json', name: 'post_build')
        stash(includes: 'node_modules/', name: 'post_build_node_modules')
      }
    }
    // stage('end to end tests') {
    //   agent {
    //     label 'bpmn-studio-e2e'
    //   }
    //   steps {
    //     script {
    //       unstash('post_build')
    //       unstash('post_build_node_modules')

    //       def docker_e2e_image_name = "5minds/selenium_dockerized:latest"
    //       def docker_e2e_container_name = "bpmn-studio_e2e_test_container-b${env.BUILD_NUMBER}-${env.GIT_COMMIT}"

    //       try {
    //         def docker_run_cmd = 'docker run'
    //         docker_run_cmd += ' --user 1001:1001' // Use the jenkins system user.
    //         docker_run_cmd += " --env HOME=${env.WORKSPACE}" // Override home folder.
    //         docker_run_cmd += " --workdir \"${env.WORKSPACE}\"" // Use workspace as workdir.
    //         docker_run_cmd += " --volume=\"${env.WORKSPACE}:${env.WORKSPACE}:Z\"" // Mount workspace into the container. Z flags fixes the permissions.
    //         docker_run_cmd += ' --rm' // Delete container after run.
    //         docker_run_cmd += " --name ${docker_e2e_container_name}" // Set the container name.
    //         docker_run_cmd += " ${docker_e2e_image_name}" // The image to run.
    //         docker_run_cmd += ' test/jenkins_e2e.sh' // The command to run.

    //         sh("${docker_run_cmd} | tee e2e_test_results.txt")

    //       } finally {
    //         sh("docker rm ${docker_e2e_container_name} || true")
    //       }

    //       def parse_test_result_regex = /Executed\ (\d+)\ of\ \d+\ specs(.*?\((\d+)\ FAILED\))?/;

    //       def test_result_log = readFile "e2e_test_results.txt"
    //       def test_result_matcher = test_result_log =~ parse_test_result_regex

    //       def total_tests_run = test_result_matcher[0][1] as Integer;

    //       def some_tests_failed = test_result_matcher[0][2] != null;
    //       def tests_failed = some_tests_failed
    //                           ? test_result_matcher[0][3] as Integer
    //                           : 0;

    //       echo "${total_tests_run} Tests run. ${tests_failed} Tests failed."

    //       if (some_tests_failed) {
    //         error 'Some tests failed, build failed.';
    //       }
    //     }
    //   }
    // }
    stage('build electron') {
      when {
        expression {
          branch_is_master ||
          branch_is_develop ||
          branch_is_release
        }
      }
      parallel {
        stage('Build on MacOS') {
          agent {
            label "macos"
          }
          steps {
            unstash('post_build')
            unstash('post_build_node_modules')

            sh('node --version')

            // We copy the node_modules folder from the slave running
            // prepare and install steps. That slave may run another OS
            // than macos. Some dependencies may not be installed if
            // they have an os restriction in their package.json.
            sh('npm install')

            sh('npm run jenkins-electron-install-app-deps')
            sh('npm run jenkins-electron-rebuild-native')

            withCredentials([
              string(credentialsId: 'apple-mac-developer-certifikate', variable: 'CSC_LINK'),
            ]) {
              sh('npm run jenkins-electron-build-macos')
            }
            stash(includes: 'dist/*.*, dist/mac/*', excludes: 'electron-builder-effective-config.yaml', name: 'macos_results')
          }
          post {
            always {
              cleanup_workspace()
            }
          }
        }
        stage('Build on Windows') {
          agent {
            node {
              label "windows"
              customWorkspace "ws/b${System.currentTimeMillis()}"
            }
          }
          steps {
            unstash('post_build')
            bat('node --version')

            // On windows a complete reinstall is required.
            bat('npm install')

            bat('npm run jenkins-electron-rebuild-native')
            bat('npm run jenkins-electron-build-windows')

            stash(includes: 'dist/*.*', excludes: 'electron-builder-effective-config.yaml', name: 'windows_results')
          }
          post {
            always {
              cleanup_workspace()
            }
          }
        }
      }
    }
    stage('publish') {
      steps {
        script {
          def new_commit = env.GIT_PREVIOUS_COMMIT != env.GIT_COMMIT;

          if (branch_is_master) {

            def previous_build = currentBuild.getPreviousBuild();
            def previous_build_status = previous_build == null ? null : previous_build.result;

            def should_publish_to_npm = new_commit || previous_build_status == 'FAILURE';

            if (should_publish_to_npm) {
              script {
                // let the build fail if the version does not match normal semver
                def semver_matcher = package_version =~ /\d+\.\d+\.\d+/;
                def is_version_not_semver = semver_matcher.matches() == false;
                if (is_version_not_semver) {
                  error('Only non RC Versions are allowed in master')
                }
              }

              def raw_package_name = sh(script: 'node --print --eval "require(\'./package.json\').name"', returnStdout: true).trim();
              def current_published_version = sh(script: "npm show ${raw_package_name} version", returnStdout: true).trim();
              def version_has_changed = current_published_version != package_version;

              if (version_has_changed) {
                nodejs(configId: env.NPM_RC_FILE, nodeJSInstallationName: env.NODE_JS_VERSION) {
                  sh('node --version')
                  sh('npm publish --ignore-scripts')
                }
              } else {
                println 'Skipping publish for this version. Version unchanged.'
              }
            } else {
              println 'Skipped publishing for this version. No new commits pushed and previous build did not fail.'
            }

          } else {
            // when not on master, publish a prerelease based on the package version, the
            // current git commit and the build number.
            // the published version gets tagged as the branch name.
            def publish_tag = branch.replace("/", "~");

            find_available_version_for_publish();

            nodejs(configId: env.NPM_RC_FILE, nodeJSInstallationName: env.NODE_JS_VERSION) {
              sh('node --version')
              sh("npm publish --tag ${publish_tag} --ignore-scripts")
            }
          }
        }
      }
    }
    stage('publish electron') {
      when {
        expression {
          branch_is_master ||
          branch_is_develop ||
          branch_is_release
        }
      }
      steps {
        unstash('macos_results')
        unstash('windows_results')

        script {
          // On release branches we will just archive the artifacts of the build.
          // When we build master or develop, we upload the artifacts to the
          // GitHub release.
          if (branch_is_release) {

            archiveArtifacts 'dist/*, dist/**/*'

          } else {

            withCredentials([
              usernamePassword(credentialsId: 'process-engine-ci_github-token', passwordVariable: 'RELEASE_GH_TOKEN', usernameVariable: 'RELEASE_GH_USER')
            ]) {
              script {

                def files_to_upload = [
                  "dist/bpmn-studio-setup-${full_electron_release_version_string}.exe",
                  "dist/bpmn-studio-setup-${full_electron_release_version_string}.exe.blockmap",
                  "dist/bpmn-studio-${full_electron_release_version_string}-mac.zip",
                  "dist/bpmn-studio-${full_electron_release_version_string}-x86_64.AppImage",
                  "dist/bpmn-studio-${full_electron_release_version_string}.dmg",
                  "dist/bpmn-studio-${full_electron_release_version_string}.dmg.blockmap",
                  "dist/latest-mac.yml",
                  "dist/latest.yml",
                ];

                def create_github_release_command = 'create-github-release ';
                create_github_release_command += 'process-engine ';
                create_github_release_command += 'bpmn-studio ';
                create_github_release_command += "${full_electron_release_version_string} ";
                create_github_release_command += "${branch} ";
                create_github_release_command += "${release_will_be_draft} ";
                create_github_release_command += "${!branch_is_master} ";
                create_github_release_command += "${files_to_upload.join(' ')}";

                sh(create_github_release_command);
              }
            }
          }
        }
      }
    }
    stage('cleanup') {
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
