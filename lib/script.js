'use strict'

const fs = require('fs')
const path = require('path')

const assist = require('./assist.js')
const config = require('./config.js')
const simple = require('./simple.js')

module.exports = {
  readyRepo,
  updateRepo,
  findOrigin
}

/**
 * ready repository
 * verify .git, remote
 *
 * @param  {String} cwd
 * @param  {String} repo
 * @return {Promise} ready
 */
function readyRepo(cwd, repo) {
  function resetRepo() {
    return assist.chainPromise([
        assist.safeExecute('rm', ['-rf', cwd]),
        assist.safeExecute('mkdir', ['-p', cwd]),
      ])
      .then(function() { return false })
  }
  
  if (!assist.existsPath(cwd)) {
    return resetRepo()
  }
  var rootFiles = fs.readdirSync(cwd)
  if (rootFiles.indexOf('.git') < 0) {
    if (rootFiles.length > 0) {
      // fix .git not found
      return resetRepo()
    }
  } else {
    var gitFiles = fs.readdirSync(path.join(cwd, '/.git'))
    if (gitFiles.indexOf('config') >= 0) {
      var configText = fs.readFileSync(path.join(cwd, '/.git/config'))
      if (gitFiles.indexOf('HEAD') >= 0 && configText.indexOf(repo) >= 0) {
        return Promise.resolve(true)
      }
    }
    return resetRepo()
  }
  return Promise.resolve(false)
}

/**
 * update repository to revision
 *
 * @param  {String} cwd
 * @param  {String} rev
 */
function updateRepo(cwd, rev) {
  var sshkey = config.getSSHKey()
  if (!sshkey) {
    return assist.nullSSHKey()
  }
  
  var execOptsWithSSH = { cwd, sshkey, ignore: true }
  
  var scriptTryUpdateChains = [
    assist.safeExecute('git', ['checkout', '-qf', rev], execOptsWithSSH),
    assist.safeExecute('git', ['pull'], execOptsWithSSH),
    assist.safeExecute('git', ['reset', '--hard', `origin/${rev}`], execOptsWithSSH),
    assist.safeExecute('git', ['fetch', '--tags'], execOptsWithSSH),
  ]
  
  var scriptFixBranchChains = [
    assist.safeExecute('git', ['branch', '-D', 'branch_used_to_delete_branch'], execOptsWithSSH),
    assist.safeExecute('git', ['checkout', '-b', 'branch_used_to_delete_branch'], execOptsWithSSH),
    assist.safeExecute('git', ['branch', '-D', rev], execOptsWithSSH),
    assist.safeExecute('git', ['remote', 'update'], execOptsWithSSH),
    assist.safeExecute('git', ['fetch', 'origin', rev], execOptsWithSSH),
    assist.safeExecute('git', ['checkout', '-q', '-b', rev, `origin/${rev}`], execOptsWithSSH),
    assist.safeExecute('git', ['branch', '-D', 'branch_used_to_delete_branch'], execOptsWithSSH),
  ]
  
  var scriptCleanRepoChains = [
    assist.safeExecute('git', ['remote', 'prune', 'origin'], execOptsWithSSH),
    assist.safeExecute('git', ['gc'], execOptsWithSSH)
  ]
  
  return Promise.resolve()
    .then(() => assist.chainPromise(scriptCleanRepoChains))
    .then(() => assist.chainPromise(scriptTryUpdateChains))
    .catch(error => {
      console.log(error)
      return assist.chainPromise(scriptFixBranchChains)
        .then(function () {
          return assist.chainPromise(scriptTryUpdateChains)
        })
    })
}

/**
 * find origin commits with same blobs in rev
 *
 * @param  {String} cwd
 * @param  {String} rev - revision
 * @return {Promise} { file: { blob, zero } }
 */
function findOrigin(cwd, rev) {
  return Promise.all([
      // get ref blob table
      simple.getBlobTable(cwd, rev, '$4,$3').then(function (table) {
        var maps = {}
        for (var i = 0; i < table.length; i += 2) {
          maps[table[i]] = { blob: table[i + 1], zero: null }
        }
        return maps
      }),
      
      // get all revs about cwd
      simple.getFileTrack(cwd, cwd)
    ])
    .then(function (batch) {
      var maps = batch[0]
      var revs = batch[1]
      // from oldest rev to latest rev
      var steps = revs.reverse().map(function (revI, i) {
        return function () {
          return simple.getBlobTable(cwd, revI, '$4,$3')
            .then(function (table) {
              for (var k = 0; k < table.length; k += 2) {
                let map = maps[table[k]]
                if (map && !map.zero && map.blob === table[k + 1]) {
                  map.zero = [revI, i]
                }
              }
            })
        }
      })
      return assist.chainPromise(steps)
        .then(function () {
          return Promise.resolve(maps)
        })
    })
}
