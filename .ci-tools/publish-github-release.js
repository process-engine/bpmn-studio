const octokit = require('@octokit/rest')();
const fs = require('fs');
const mime = require('mime-types')

if (process.argv.length != 7) {
  console.error('Please supply arguments: <version_to_release> <version_for_filenames> <target_commit> <release_is_draft> <release_is_prerelease>');
  process.exit(1);
}

if (!process.env['RELEASE_GH_TOKEN']
  || process.env['RELEASE_GH_TOKEN'] === null
  || process.env['RELEASE_GH_TOKEN'] == undefined
  || process.env['RELEASE_GH_TOKEN'] == '') {
  console.error('Please supply github token via RELEASE_GH_TOKEN environment variable.');
  process.exit(1);
}

const version_to_release = process.argv[2];
const version_for_filenames = process.argv[3];
const target_commit = process.argv[4];
const release_is_draft = process.argv[5] === 'true';
const release_is_prerelease = process.argv[6] === 'true';

const github_auth_token = process.env['RELEASE_GH_TOKEN'];
const github_repo_namespace = process.env['RELEASE_GH_NAMESPACE'] || 'process-engine';
const github_repo_name = process.env['RELEASE_GH_NAMESPACE'] || 'bpmn-studio';

const version_tag = `v${version_to_release}`;

const files_to_upload = [
  `dist/bpmn-studio Setup ${version_for_filenames}.exe`,
  `dist/bpmn-studio Setup ${version_for_filenames}.exe.blockmap`,
  `dist/bpmn-studio-${version_for_filenames}-mac.zip`,
  `dist/bpmn-studio-${version_for_filenames}-x86_64.AppImage`,
  `dist/bpmn-studio-${version_for_filenames}.dmg`,
  `dist/bpmn-studio-${version_for_filenames}.dmg.blockmap`,
  `dist/bpmn-studio_${version_for_filenames}_amd64.snap`,
  `dist/github/latest-mac.json`,
  `dist/latest-linux.yml`,
  `dist/latest-mac.yml`,
  `dist/latest.yml`,
];

async function authenticate() {
  octokit.authenticate({
    type: 'token',
    token: github_auth_token,
  });
}

async function check_for_existing_release() {
  try {
    await octokit.repos.getReleaseByTag({
      owner: github_repo_namespace,
      repo: github_repo_name,
      tag: version_tag,
    });
  } catch(error) {
    return false;
  }
  return true;
}

async function create_release() {
  console.log('Creating GitHub Release');
  return octokit.repos.createRelease({
    owner: github_repo_namespace,
    repo: github_repo_name,
    tag_name: version_tag,
    target_commitish: target_commit,
    name: version_to_release,
    body: 'WIP',
    draft: release_is_draft,
    prerelease: release_is_prerelease,
  });
}

function get_filename(path) {
  const slash_at = path.lastIndexOf('/');
  if (slash_at < 0) {
    return path;
  }
  return path.substr(slash_at + 1);
}

async function upload_release_asset(upload_url, file) {
  const buffer = fs.readFileSync(file);
  const file_size = fs.statSync(file).size;
  // detect mine type
  const content_type = mime.lookup(file) || 'text/plain';
  const name = get_filename(file).replace(' ', '_');

  console.log(`Uploading Asset '${file}'. Content-Type '${content_type}'`);
  return octokit.repos.uploadAsset({
    url: upload_url,
    file: buffer,
    contentType: content_type,
    contentLength: file_size,
    name: name,
  });
}

async function main() {
  await authenticate();

  const release_already_exists = await check_for_existing_release();
  if (release_already_exists) {
    console.log(`A release with the tag ${version_tag} already exists.`);
    console.log('Skipping publish step.');
    process.exit(0);
  }

  const created_github_release = await create_release();
  const upload_url_for_assets = created_github_release.data.upload_url;

  const upload_promises = files_to_upload.map((file) => {
    return upload_release_asset(upload_url_for_assets, file);
  });

  await Promise.all(upload_promises);
}

main().catch((error) => {
  console.log(error);
})
