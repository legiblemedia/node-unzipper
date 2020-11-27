'use strict';

var test = require('tap').test;
var fs = require('fs');
var path = require('path');
var unzip = require('../');
var spawn = require('cross-spawn');
var waitOn = require('wait-on');
var azureStorageBlob = require('@azure/storage-blob');
var rimraf = require('rimraf')

var account = 'devstoreaccount1';
var accountKey =
  'Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==';

var azuriteTempDir = path.join(__dirname, '../testData/.azurite');

test('get content of a single file entry out of a zip', function (t) {
  if (!fs.existsSync(azuriteTempDir)) {
    fs.mkdirSync(azuriteTempDir);
  }
  var azurite = spawn('azurite-blob', ['-s', '-l', azuriteTempDir], {
    detached: true,
    stdio: [process.stdin, process.stdout, process.stderr],
  });
  return waitOn({
    resources: ['tcp:10000'],
  }).then(function () {
    var sharedKeyCredential = new azureStorageBlob.StorageSharedKeyCredential(
      account,
      accountKey
    );
    var blobServiceClient = new azureStorageBlob.BlobServiceClient(
      'http://localhost:10000/devstoreaccount1',
      sharedKeyCredential
    );

    var containerClient = blobServiceClient.getContainerClient('unzipper');
    return containerClient
      .createIfNotExists({
        access: 'blob',
      })
      .then(function () {
        var blockBlobClient = containerClient.getBlockBlobClient('archive.zip');
        return blockBlobClient
          .uploadFile(
            path.join(__dirname, '../testData/compressed-standard/archive.zip')
          )
          .then(function () {
            return blockBlobClient;
          });
      })
      .then(function (blockBlobClient) {
        return unzip.Open.azureStorageBlob(blockBlobClient).then(function (d) {
          var file = d.files.filter(function (file) {
            return file.path == 'file.txt';
          })[0];

          return file.buffer().then(function (str) {
            var fileStr = fs.readFileSync(
              path.join(
                __dirname,
                '../testData/compressed-standard/inflated/file.txt'
              ),
              'utf8'
            );
            t.equal(str.toString(), fileStr);

            azurite.kill('SIGINT');
            rimraf.sync(azuriteTempDir);

            t.end();
          });
        });
      });
  });
});
